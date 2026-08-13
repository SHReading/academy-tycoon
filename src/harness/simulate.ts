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
// 이 트랙은 문제를 발견해서 보고만 한다. 결과를 보고 밸런스를 고치지 않는다. (07 문서 작업 D)

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import {
  BASE_OPERATING_COST,
  FRANCHISE_BID_MULTIPLIER,
  LEGACY_BID_CASH_LIMIT,
  LEGACY_BID_MULTIPLIER,
  PICKY_REPUTATION_MINIMUM,
  SUBJECT_SLOT_COUNT,
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
  OperationOption,
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

// A-2 확정값(×1.3 / 잔액 30%)이지만 balance.ts 에 아직 없어서 여기서 들고 있다.
// ponytail: balance.ts 에 SELECTIVE_BID_* 가 생기면 import 로 바꾼다.
const SELECTIVE_BID_MULTIPLIER = 1.3;
const SELECTIVE_BID_CASH_LIMIT = 0.3;

const AI_REPUTATION_FLOOR = PICKY_REPUTATION_MINIMUM;

export const STRATEGIES = ["NO_BID", "TOP_HEAVY", "MID_EXPAND", "BASELINE"] as const;
export type Strategy = (typeof STRATEGIES)[number];

// ─────────────────────────────── 입찰 규칙 (D-3)

type BidRule = { multiplier: number; cashLimit: number; priority: "teaching" | "fame" | "total" };

const ARCHETYPE_BID_RULE: Record<Archetype, BidRule> = {
  FRANCHISE: { multiplier: FRANCHISE_BID_MULTIPLIER, cashLimit: Infinity, priority: "fame" },
  LEGACY: { multiplier: LEGACY_BID_MULTIPLIER, cashLimit: LEGACY_BID_CASH_LIMIT, priority: "teaching" },
  SELECTIVE: { multiplier: SELECTIVE_BID_MULTIPLIER, cashLimit: SELECTIVE_BID_CASH_LIMIT, priority: "total" },
};

const STRATEGY_BID_RULE: Record<Strategy, BidRule | null> = {
  NO_BID: null,
  TOP_HEAVY: ARCHETYPE_BID_RULE.LEGACY,
  MID_EXPAND: ARCHETYPE_BID_RULE.FRANCHISE,
  BASELINE: ARCHETYPE_BID_RULE.FRANCHISE, // 자기 아키타입 규칙으로 게임마다 교체한다
};

const STRATEGY_TIER_ORDER: Record<Strategy, ClassTier[]> = {
  NO_BID: ["TOP", "MID", "BASIC"],
  TOP_HEAVY: ["TOP", "MID", "BASIC"],
  MID_EXPAND: ["MID", "TOP", "BASIC"],
  BASELINE: ["TOP", "MID", "BASIC"],
};

const rank = (card: TeacherCard, priority: BidRule["priority"]): number =>
  priority === "total" ? card.teaching + card.fame : card[priority];

/** A-3 — 이번 턴 정산 후에도 자금이 0 이상 남을 입찰가까지만 지른다 */
const bidLimit = (academy: Academy): number =>
  academy.cash -
  academy.contracts
    .filter((contract) => contract.remainingTurns > 0)
    .reduce((sum, contract) => sum + contract.price, 0) -
  BASE_OPERATING_COST;

/** A-4 — PICKY 는 평판 45 미만 학원의 입찰을 무효로 만든다 */
const canBid = (card: TeacherCard, academy: Academy): boolean =>
  card.trait !== "PICKY" || academy.reputation >= AI_REPUTATION_FLOOR;

function chooseBid(
  market: TeacherCard[],
  academy: Academy,
  rule: BidRule,
): { teacherId: string; amount: number } | null {
  const limit = Math.min(bidLimit(academy), academy.cash * rule.cashLimit);
  const card = [...market]
    .filter((candidate) => canBid(candidate, academy))
    .sort(
      (left, right) =>
        rank(right, rule.priority) - rank(left, rule.priority) ||
        left.askingPrice - right.askingPrice ||
        left.id.localeCompare(right.id),
    )
    .find((candidate) => Math.ceil(candidate.askingPrice * rule.multiplier) <= limit);
  if (!card) return null;
  return { teacherId: card.id, amount: Math.ceil(card.askingPrice * rule.multiplier) };
}

// ─────────────────────────────── AI 정책 (주입 지점)

/**
 * A-4(ai.ts)가 아직 비어 있어서 하네스가 임시로 들고 있다.
 * ai.ts 가 decideAssignments·decideOption 을 export 하면 runBatch 에 그것을 넘긴다.
 */
export type AiPolicy = {
  assignments(academy: Academy): Academy["assignments"];
  option(academy: Academy): OperationOption;
};

/** A-5 — 강의력 내림차순 → 인지도 내림차순 → id 오름차순으로 상위·중위·기초 중 빈 슬롯 첫 반에 */
export function planAssignments(academy: Academy, order: ClassTier[]): Academy["assignments"] {
  const plan: Academy["assignments"] = {};
  const sorted = [...academy.teachers].sort(
    (left, right) =>
      right.teaching - left.teaching ||
      right.fame - left.fame ||
      left.id.localeCompare(right.id),
  );
  for (const teacher of sorted) {
    const tier = order.find((candidate) => !plan[candidate]?.[teacher.subject]);
    if (!tier) continue;
    plan[tier] = { ...(plan[tier] ?? {}), [teacher.subject]: teacher.id };
  }
  return plan;
}

/** A-8 — 자금 위험이면 수강료 인상, 평판이 낮으면 상담, 그 외는 아키타입 기본 */
export function chooseOption(academy: Academy): OperationOption {
  if (bidLimit(academy) < 0) return "TUITION_HIKE";
  if (academy.reputation < AI_REPUTATION_FLOOR) return "COUNSELING";
  return academy.archetype === "FRANCHISE"
    ? "SCHOLARSHIP"
    : academy.archetype === "LEGACY"
      ? "COUNSELING"
      : "SELF_STUDY";
}

export const defaultAiPolicy: AiPolicy = {
  assignments: (academy) => planAssignments(academy, ["TOP", "MID", "BASIC"]),
  option: chooseOption,
};

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
  policy: AiPolicy,
): Outcome {
  const random = mulberry32(seed);
  const setup = createInitialState(archetype, seed, pool, events, random);
  let state: GameState = setup.state;
  let deck = setup.deck;

  const rule = strategy === "BASELINE" ? ARCHETYPE_BID_RULE[archetype] : STRATEGY_BID_RULE[strategy];
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
    const before = state.academies[playerIndex()].teachers.length;

    // 입찰. AI 2사의 입찰은 리듀서 안에서만 일어나므로, 무입찰 전략도 BID 액션 자체는 보내야 한다.
    const bid = rule ? chooseBid(state.market, state.academies[playerIndex()], rule) : null;
    if (bid) bidAttempts += 1;
    state = reducer(state, { type: "BID", teacherId: bid?.teacherId ?? "", amount: bid?.amount ?? 0 });
    if (bid && state.academies[playerIndex()].teachers.length > before) bidWins += 1;

    // 플레이어 반 편성과 운영 옵션은 리듀서를 통과시킨다
    const plan = planAssignments(state.academies[playerIndex()], tierOrder);
    for (const tier of ["TOP", "MID", "BASIC"] as ClassTier[]) {
      for (const teacherId of Object.values(plan[tier] ?? {})) {
        state = reducer(state, { type: "ASSIGN", teacherId, classTier: tier });
      }
    }
    state = reducer(state, { type: "OPTION", option: policy.option(state.academies[playerIndex()]) });

    // AI 2사는 리듀서가 아직 다루지 못한다. 정책을 직접 얹는다. (A-5·A-7·A-8)
    state = {
      ...state,
      academies: state.academies.map((academy) =>
        academy.archetype === archetype
          ? academy
          : { ...academy, assignments: policy.assignments(academy), option: policy.option(academy) },
      ),
    };

    const unsold = state.market;
    state = reducer(state, { type: "SETTLE" });

    // W-2 — 자금이 0 아래면 카운터 +1, 0 이상이면 리셋. 2가 되는 턴에 폐원
    for (const academy of state.academies) {
      const streak = academy.cash < 0 ? (bankruptStreak.get(academy.archetype) ?? 0) + 1 : 0;
      bankruptStreak.set(academy.archetype, streak);
      if (streak >= 2) bankrupt.add(academy.archetype);
    }
    if (bankrupt.has(archetype)) break; // W-4 — 플레이어 폐원은 즉시 종료

    const carried = unsold.map((card) => discountUnsold(card, originalPrice.get(card.id) ?? card.askingPrice));
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

export function runBatch(config: Config, policy: AiPolicy = defaultAiPolicy): Report {
  const started = Date.now();
  const { pool, source } = loadPool(config.cards);
  const events = loadEvents();

  const strategies = config.strategy ? [config.strategy] : [...STRATEGIES];
  const archetypes = config.archetype ? [config.archetype] : [...ARCHETYPES];
  // D-1·D-5 — 시드는 seed + i, 전략·아키타입은 라운드로빈이라 시드 구간이 한쪽에 몰리지 않는다
  const cells = strategies.flatMap((strategy) => archetypes.map((archetype) => ({ strategy, archetype })));

  const outcomes: Outcome[] = [];
  for (let index = 0; index < config.games; index += 1) {
    const cell = cells[index % cells.length];
    outcomes.push(
      playGame(config.seed + index, cell.archetype, cell.strategy, pool, events, policy),
    );
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
      archetypeSkew: archetypeRates.length > 1
        ? Math.max(...archetypeRates) - Math.min(...archetypeRates) > 0.15
        : false,
    },
    winRateByStrategy,
    winRateByArchetype,
    bidWinRate: round4(rate(wins, attempts)),
    gameLength,
    bankruptRate: round4(rate(outcomes.filter((o) => o.bankrupt).length, outcomes.length)),
    notes: caveats(source, events.length),
  };
}

/** 이 수치를 밸런스 판단에 쓰기 전에 반드시 읽어야 하는 전제들 */
function caveats(source: Report["deckSource"], eventCount: number): string[] {
  const notes = [
    "AI 2사의 반 편성·운영 옵션은 core/ai.ts 가 비어 있어 하네스가 임시 정책으로 대신한다. 실제 ai.ts 가 다르면 수치가 달라진다.",
    "SELECTIVE AI 의 입찰은 reducer 안에 구현돼 있지 않다. 플레이어가 FRANCHISE·LEGACY 를 잡은 판에서 SELECTIVE 는 강사를 한 명도 영입하지 못한다 — 아키타입 승률(판정 3)을 아직 신뢰하면 안 된다.",
    "성적·평판 하한 0(X-3 승인)이 scoring.ts 에 반영돼 있지 않다. 초반 저성적 구간이 음수로 흐를 수 있다.",
    "이벤트 조건 8종(E-1)의 판정식이 없어 requires 가 NONE 인 카드만 발동한다.",
  ];
  if (source === "synthetic") {
    notes.push("트랙 C 콘텐츠가 비어 있어 03 문서 3절 분포로 만든 합성 강사 풀을 썼다. 실제 카드가 들어오면 다시 돌려야 한다.");
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

export { SUBJECT_SLOT_COUNT };
