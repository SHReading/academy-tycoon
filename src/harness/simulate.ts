// 밸런싱 하네스 — npm run sim -- --games 100000 --seed 1
//
// stdout 은 JSON 한 덩어리만, 진행 로그는 stderr 로 나간다. (D-6)
// 파일로 받을 때는 npm 배너가 섞이지 않도록 --silent 를 붙인다.
//   npm run --silent sim -- --games 100000 --seed 1 > sim.json
//
// 규격은 docs/SPEC_GAPS.md C절(D-1~D-7) 확정본이다.
// 답해야 하는 질문은 정확히 3개다 (01 문서 6절 / 07 문서 작업 D)
//   1. 무입찰 전략이 지배전략인가          → 무입찰 승률 > 40% 면 실패
//   2. 상위반 몰빵/중위반 확장 중 하나가 항상 이기는가 → 한쪽 > 60% 면 실패
//   3. 3개 아키타입 승률이 40:30:30 안에 드는가        → 최대 편차 > 15%p 면 실패
//
// AI 2사의 입찰·배치·옵션은 전부 core/ai.ts 와 reducer 가 맡는다. 하네스는 사본을 두지 않는다.
// 이 트랙은 문제를 발견해서 보고만 한다. 결과를 보고 밸런스를 고치지 않는다. (07 문서 작업 D)

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { decideAssignments, decideBid, decideOption } from "../core/ai.ts";
import {
  CLASS_TEACHER_LIMIT,
  TOTAL_TURNS,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "../core/balance.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { reducer } from "../core/reducer.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { mulberry32 } from "../core/rng.ts";
import type {
  Academy,
  Archetype,
  ClassTier,
  EventCard,
  GameState,
  TeacherCard,
} from "../core/types";
import {
  ARCHETYPES,
  createInitialState,
  dealMarket,
  determineWinner,
  discountUnsold,
  syntheticPool,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "./setup.ts";

export const STRATEGIES = ["NO_BID", "TOP_HEAVY", "MID_EXPAND", "BASELINE"] as const;
export type Strategy = (typeof STRATEGIES)[number];

// D-3 — 전략은 "어느 아키타입의 입찰 규칙을 쓰는가"와 "어느 반부터 채우는가" 둘로 정의된다.
// 입찰 규칙 자체는 ai.ts 의 decideBid 를 그대로 쓴다. null 이면 입찰하지 않는다.
const STRATEGY_BID_AS: Record<Strategy, Archetype | null> = {
  NO_BID: null,
  TOP_HEAVY: "LEGACY", // 강의력 목표 ×1.1
  MID_EXPAND: "FRANCHISE", // 인지도 목표 ×1.2
  BASELINE: null, // 자기 아키타입 규칙 — 게임마다 채운다
};

const STRATEGY_TIER_ORDER: Record<Strategy, ClassTier[]> = {
  NO_BID: ["TOP", "UPPER_MID", "MID", "BASIC"],
  TOP_HEAVY: ["TOP", "UPPER_MID", "MID", "BASIC"],
  MID_EXPAND: ["MID", "UPPER_MID", "TOP", "BASIC"],
  BASELINE: ["TOP", "UPPER_MID", "MID", "BASIC"],
};

/**
 * 플레이어의 반 편성. 반 순서만 전략마다 다르고 나머지는 ai.ts 의 decideAssignments 와 같은 규칙이다.
 * 기본 순서로 부르면 decideAssignments 와 결과가 일치해야 한다 — simulate.test.mjs 가 지킨다.
 */
export function planAssignments(academy: Academy, order: ClassTier[]): Academy["assignments"] {
  const plan: Academy["assignments"] = {};
  const sorted = [...academy.teachers].sort(
    (left, right) =>
      right.teaching - left.teaching ||
      right.fame - left.fame ||
      left.id.localeCompare(right.id),
  );
  for (const teacher of sorted) {
    const tier = order.find(
      (candidate) => (plan[candidate]?.length ?? 0) < CLASS_TEACHER_LIMIT,
    );
    if (!tier) continue;
    plan[tier] = [...(plan[tier] ?? []), teacher.id];
  }
  return plan;
}

// ─────────────────────────────── 한 판

export type Outcome = {
  strategy: Strategy;
  archetype: Archetype;
  won: boolean;
  turns: number;
  bankrupt: boolean;
  bidAttempts: number;
  bidWins: number;
};

export function playGame(
  seed: number,
  archetype: Archetype,
  strategy: Strategy,
  pool: TeacherCard[],
  events: EventCard[],
): Outcome {
  const random = mulberry32(seed);
  const setup = createInitialState(archetype, seed, pool, events, random);
  let state: GameState = setup.state;
  let deck = setup.deck;

  const bidAs = strategy === "BASELINE" ? archetype : STRATEGY_BID_AS[strategy];
  const tierOrder = STRATEGY_TIER_ORDER[strategy];
  const originalPrice = new Map(pool.map((card) => [card.id, card.askingPrice]));

  const bankruptStreak = new Map<Archetype, number>(ARCHETYPES.map((name) => [name, 0]));
  const bankrupt = new Set<Archetype>();
  let bidAttempts = 0;
  let bidWins = 0;
  let turns = 0;

  const playerIndex = () => state.academies.findIndex((a) => a.archetype === archetype);

  for (let turn = 1; turn <= TOTAL_TURNS; turn += 1) {
    turns = turn;
    const player = state.academies[playerIndex()];
    const before = player.teachers.length;

    // 전략이 지정한 아키타입의 입찰 규칙을 플레이어 자금·평판에 적용한다.
    const bid = bidAs ? decideBid({ ...player, archetype: bidAs }, state.market) : undefined;
    if (bid) bidAttempts += 1;
    // AI 2사의 입찰은 리듀서의 BID 처리 안에서만 일어난다. 무입찰 전략도 액션 자체는 보내야 한다.
    state = reducer(state, { type: "BID", teacherId: bid?.teacherId ?? "", amount: bid?.amount ?? 0 });
    if (bid && state.academies[playerIndex()].teachers.length > before) bidWins += 1;

    // 플레이어의 반 편성과 운영 옵션은 리듀서를 통과시킨다. AI 2사는 SETTLE 안에서 처리된다.
    const plan = planAssignments(state.academies[playerIndex()], tierOrder);
    for (const tier of ["TOP", "UPPER_MID", "MID", "BASIC"] as ClassTier[]) {
      for (const teacherId of plan[tier] ?? []) {
        state = reducer(state, { type: "ASSIGN", teacherId, classTier: tier });
      }
    }
    state = reducer(state, {
      type: "OPTION",
      option: decideOption(state.academies[playerIndex()]),
    });

    const unsold = state.market;
    state = reducer(state, { type: "SETTLE" });

    // W-2 — 자금이 0 아래면 카운터 +1, 0 이상이면 리셋. 2가 되는 턴에 폐원
    for (const academy of state.academies) {
      const streak = academy.cash < 0 ? (bankruptStreak.get(academy.archetype) ?? 0) + 1 : 0;
      bankruptStreak.set(academy.archetype, streak);
      if (streak >= 2) bankrupt.add(academy.archetype);
    }
    if (bankrupt.has(archetype)) break; // W-4 — 플레이어 폐원은 즉시 종료

    const carried = unsold.map((card) =>
      discountUnsold(card, originalPrice.get(card.id) ?? card.askingPrice),
    );
    const dealt = dealMarket(deck, turn + 1, carried);
    deck = dealt.deck;
    state = { ...state, market: dealt.market };
  }

  return {
    strategy,
    archetype,
    won: determineWinner(state.academies, bankrupt) === archetype,
    turns,
    bankrupt: bankrupt.has(archetype),
    bidAttempts,
    bidWins,
  };
}

// ─────────────────────────────── 배치 집계

export type Config = {
  games: number;
  seed: number;
  strategy?: Strategy;
  archetype?: Archetype;
  cards: number;
};

export type Report = {
  games: number;
  seedFrom: number;
  seedTo: number;
  elapsedMs: number;
  deckSource: "content" | "synthetic";
  verdicts: { noBidDominant: boolean; strategySkew: boolean; archetypeSkew: boolean };
  winRateByStrategy: Record<string, number>;
  winRateByArchetype: Record<string, number>;
  bidWinRate: number;
  gameLength: Record<string, number>;
  bankruptRate: number;
  // 아키타입 편차(판정 3)가 어디서 오는지 보려면 승률만으로는 부족하다
  bankruptRateByArchetype: Record<string, number>;
  bidsPerGameByArchetype: Record<string, number>;
  notes: string[];
};

const rate = (won: number, total: number) => (total ? won / total : 0);
const round4 = (value: number) => Math.round(value * 10000) / 10000;

export function loadPool(cards: number): { pool: TeacherCard[]; source: Report["deckSource"] } {
  const fromContent = JSON.parse(readFileSync("src/content/teachers.json", "utf8")) as TeacherCard[];
  if (fromContent.length) return { pool: fromContent, source: "content" };
  return { pool: syntheticPool(mulberry32(1), cards), source: "synthetic" };
}

function loadEvents(): EventCard[] {
  return JSON.parse(readFileSync("src/content/events.json", "utf8")) as EventCard[];
}

export function runBatch(config: Config): Report {
  const started = Date.now();
  const { pool, source } = loadPool(config.cards);
  const events = loadEvents();

  const strategies = config.strategy ? [config.strategy] : [...STRATEGIES];
  const archetypes = config.archetype ? [config.archetype] : [...ARCHETYPES];
  // D-1·D-5 — 시드는 seed + i, 전략·아키타입은 라운드로빈이라 시드 구간이 한쪽에 몰리지 않는다
  const cells = strategies.flatMap((strategy) =>
    archetypes.map((archetype) => ({ strategy, archetype })),
  );

  const outcomes: Outcome[] = [];
  for (let index = 0; index < config.games; index += 1) {
    const cell = cells[index % cells.length];
    outcomes.push(playGame(config.seed + index, cell.archetype, cell.strategy, pool, events));
  }

  const byKey = <T extends string>(key: (o: Outcome) => T, keys: T[]) =>
    Object.fromEntries(
      keys.map((value) => {
        const subset = outcomes.filter((outcome) => key(outcome) === value);
        return [value, round4(rate(subset.filter((o) => o.won).length, subset.length))];
      }),
    ) as Record<T, number>;

  const winRateByStrategy = byKey((o) => o.strategy, strategies);
  const winRateByArchetype = byKey((o) => o.archetype, archetypes);

  const perArchetype = <T>(reduce: (subset: Outcome[]) => T) =>
    Object.fromEntries(
      archetypes.map((value) => [
        value,
        reduce(outcomes.filter((outcome) => outcome.archetype === value)),
      ]),
    ) as Record<string, T>;

  const archetypeRates = Object.values(winRateByArchetype);
  const duelRates = [winRateByStrategy.TOP_HEAVY, winRateByStrategy.MID_EXPAND].filter(
    (value) => value !== undefined,
  );

  const gameLength: Record<string, number> = {};
  for (const outcome of outcomes) {
    gameLength[outcome.turns] = (gameLength[outcome.turns] ?? 0) + 1;
  }

  const attempts = outcomes.reduce((sum, o) => sum + o.bidAttempts, 0);
  const wins = outcomes.reduce((sum, o) => sum + o.bidWins, 0);

  return {
    games: config.games,
    seedFrom: config.seed,
    seedTo: config.seed + config.games - 1,
    elapsedMs: Date.now() - started,
    deckSource: source,
    verdicts: {
      noBidDominant: (winRateByStrategy.NO_BID ?? 0) > 0.4,
      strategySkew: duelRates.some((value) => value > 0.6),
      archetypeSkew:
        archetypeRates.length > 1
          ? Math.max(...archetypeRates) - Math.min(...archetypeRates) > 0.15
          : false,
    },
    winRateByStrategy,
    winRateByArchetype,
    bidWinRate: round4(rate(wins, attempts)),
    gameLength,
    bankruptRate: round4(rate(outcomes.filter((o) => o.bankrupt).length, outcomes.length)),
    bankruptRateByArchetype: perArchetype((subset) =>
      round4(rate(subset.filter((o) => o.bankrupt).length, subset.length)),
    ),
    bidsPerGameByArchetype: perArchetype((subset) =>
      round4(rate(subset.reduce((sum, o) => sum + o.bidAttempts, 0), subset.length)),
    ),
    notes: caveats(source, events.length),
  };
}

/** 이 수치를 밸런스 판단에 쓰기 전에 반드시 읽어야 하는 전제들 */
function caveats(source: Report["deckSource"], eventCount: number): string[] {
  const notes = [
    "게임 초기 상태·시장 배포·승자 판정을 harness/setup.ts 가 별도로 갖고 있다. core 에 같은 규칙이 이미 있어 사본이 두 벌이다. 밸런스 확정 뒤 지운다.",
  ];
  if (source === "synthetic") {
    notes.push(
      "트랙 C 콘텐츠가 비어 있어 03 문서 3절 분포로 만든 합성 강사 풀을 썼다. 실제 카드가 들어오면 다시 돌려야 한다.",
    );
  }
  if (!eventCount) notes.push("이벤트 카드가 0장이라 이벤트 효과가 전혀 반영되지 않았다.");
  return notes;
}

// ─────────────────────────────── CLI

function main(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      games: { type: "string", default: "1000" },
      seed: { type: "string", default: "1" },
      strategy: { type: "string" },
      archetype: { type: "string" },
      cards: { type: "string", default: "200" },
    },
  });

  const config: Config = {
    games: Number(values.games),
    seed: Number(values.seed),
    strategy: values.strategy as Strategy | undefined,
    archetype: values.archetype as Archetype | undefined,
    cards: Number(values.cards),
  };
  if (config.strategy && !STRATEGIES.includes(config.strategy)) {
    console.error(`알 수 없는 전략: ${config.strategy}. ${STRATEGIES.join(" / ")} 중 하나여야 한다.`);
    return 1;
  }

  console.error(`시뮬레이션 ${config.games}판 (시드 ${config.seed}~${config.seed + config.games - 1})`);
  const report = runBatch(config);
  console.error(`완료 ${(report.elapsedMs / 1000).toFixed(1)}초`);
  // D-7 — 10만 판 5분이 목표다. 넘으면 판수를 줄여 돌리고 표본 수를 리포트에 남긴다.
  if (report.elapsedMs > 300_000) {
    console.error("실행 시간 예산(5분) 초과. --games 10000 으로 낮춰 돌리고 표본 수를 리포트에 적을 것.");
  }
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

if (process.argv[1]?.endsWith("simulate.ts")) {
  process.exit(main(process.argv.slice(2)));
}
