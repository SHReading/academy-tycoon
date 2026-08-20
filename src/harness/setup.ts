// 하네스 전용 게임 셋업 — core가 아직 갖고 있지 않은 부분을 임시로 채운다.
//
// 여기 있는 규칙은 전부 docs/SPEC_GAPS.md 확정본을 그대로 옮긴 것이고, 새로 정한 값은 없다.
//   I-1 시장 4장 추출 / I-2 턴별 카드 등급 제한 / I-3 시작 보유 강사
//   I-4·I-5 유찰 이월 / I-6 Academy 초기값 / W-1 점유율 동률
//
// ponytail: core가 createInitialState·dealMarket·getWinner 를 export하면 이 파일은 통째로 지운다.
// 규칙의 단일 출처는 01 문서이므로, 사본이 두 벌 남는 상태를 오래 두지 않는다.

import {
  CLASS_CAPACITY,
  MARKET_SIZE,
  STARTING_ACADEMY,
  UNSOLD_PRICE_MULTIPLIER,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "../core/balance.ts";
import type {
  Academy,
  Archetype,
  EventCard,
  GameState,
  Subject,
  TeacherCard,
  Trait,
} from "../core/types";

export const ARCHETYPES: Archetype[] = ["FRANCHISE", "LEGACY", "SELECTIVE"];

/** I-2 — 1~2턴 시장에는 강의력 5가 나오지 않는다 */
const MAX_TEACHING_EARLY = 4;
const EARLY_TURNS = 2;

/** I-3 — 각 학원이 강사 2명으로 시작한다 */
const STARTING_TEACHERS = 2;

/** I-5 — 유찰 이월 상한과 요구연봉 하한 */
const MAX_CARRIED = 2;
const MIN_PRICE_RATIO = 0.5;

// ─────────────────────────────── 강사 풀

// 03 문서 3절 분포 조건. 트랙 C 생산물이 들어오기 전까지 이 분포로 합성 덱을 만든다.
const SUBJECT_WEIGHTS: Array<[Subject, number]> = [
  ["KOREAN", 25],
  ["MATH", 30],
  ["ENGLISH", 25],
  ["SCIENCE", 20],
];
const TEACHING_WEIGHTS: Array<[number, number]> = [
  [1, 20],
  [2, 20],
  [3, 35],
  [4, 20],
  [5, 5],
];
const TRAITS: Trait[] = [
  "CLASS_SPECIALIST",
  "MEDIA_FIGURE",
  "FACTION",
];

function pick<T>(weights: Array<[T, number]>, roll: number): T {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = roll * total;
  for (const [value, weight] of weights) {
    if ((cursor -= weight) < 0) return value;
  }
  return weights[weights.length - 1][0];
}

/** 트랙 C 콘텐츠가 비어 있을 때 쓰는 합성 강사 풀. 분포는 03 문서 3절을 따른다. */
export function syntheticPool(random: () => number, count: number): TeacherCard[] {
  return Array.from({ length: count }, (_unused, index) => {
    const subject = pick(SUBJECT_WEIGHTS, random());
    const teaching = pick(TEACHING_WEIGHTS, random());
    const fame = 1 + Math.floor(random() * 5);
    const spread = 1 + (random() - 0.5) * 0.4; // 기준식의 ±20% — 검증기 허용 범위(±30%) 안
    return {
      id: `t_${String(index + 1).padStart(4, "0")}`,
      name: `강사${index + 1}`,
      subject,
      teaching,
      fame,
      askingPrice: Math.max(1, Math.round((teaching + fame) * 3 * spread)),
      trait: TRAITS[index % TRAITS.length],
      blurb: "합성 카드",
    };
  });
}

/** I-1 — 시드 RNG로 셔플한 덱. 매 턴 앞에서 꺼낸다. */
export function shuffle<T>(cards: T[], random: () => number): T[] {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

// ─────────────────────────────── 시장

export type Market = { market: TeacherCard[]; deck: TeacherCard[] };

/**
 * I-1·I-2·I-4·I-5 — 유찰분을 먼저 채우고 모자란 만큼 덱에서 꺼낸다.
 * 이월은 2장까지, 초과분은 요구연봉이 높은 순으로 버린다.
 */
export function dealMarket(deck: TeacherCard[], turn: number, unsold: TeacherCard[]): Market {
  const carried = [...unsold]
    .sort((left, right) => left.askingPrice - right.askingPrice)
    .slice(0, MAX_CARRIED);

  const remaining = [...deck];
  const market = [...carried];
  const skipped: TeacherCard[] = [];
  while (market.length < MARKET_SIZE && remaining.length) {
    const card = remaining.shift() as TeacherCard;
    if (turn <= EARLY_TURNS && card.teaching > MAX_TEACHING_EARLY) skipped.push(card);
    else market.push(card);
  }
  return { market, deck: [...skipped, ...remaining] };
}

/** I-4 — 유찰 카드는 요구연봉이 10% 내려간 채 다음 턴에 다시 나온다. 하한은 원가의 50%. */
export function discountUnsold(card: TeacherCard, originalPrice: number): TeacherCard {
  const floor = Math.ceil(originalPrice * MIN_PRICE_RATIO);
  return {
    ...card,
    askingPrice: Math.max(floor, Math.floor(card.askingPrice * UNSOLD_PRICE_MULTIPLIER)),
  };
}

// ─────────────────────────────── 초기 상태

/**
 * I-3 — 3사에 강사 2명씩, 세 학원의 강의력 합이 같아지도록 나눈다.
 * 덱 앞쪽에서 합이 같은 짝 3쌍을 찾는다. 못 찾으면 시작 강사 없이 간다.
 */
function dealStartingTeachers(deck: TeacherCard[]): { hands: TeacherCard[][]; deck: TeacherCard[] } {
  const window = deck.slice(0, 30);
  // 합이 중간값에 가까운 쪽부터 본다 — 극단값은 짝이 잘 안 맞는다
  for (const target of [6, 5, 7, 4, 8, 3, 9, 2, 10]) {
    const used = new Set<string>();
    const hands: TeacherCard[][] = [];
    for (let left = 0; left < window.length && hands.length < ARCHETYPES.length; left += 1) {
      if (used.has(window[left].id)) continue;
      for (let right = left + 1; right < window.length; right += 1) {
        if (used.has(window[right].id)) continue;
        if (window[left].teaching + window[right].teaching !== target) continue;
        used.add(window[left].id);
        used.add(window[right].id);
        hands.push([window[left], window[right]]);
        break;
      }
    }
    if (hands.length === ARCHETYPES.length) {
      return { hands, deck: deck.filter((card) => !used.has(card.id)) };
    }
  }
  return { hands: ARCHETYPES.map(() => []), deck };
}

/** I-6 — applicants·enrollment·marketShare 는 0에서 시작한다 */
function createAcademy(archetype: Archetype, teachers: TeacherCard[]): Academy {
  return {
    archetype,
    cash: STARTING_ACADEMY[archetype].cash,
    reputation: STARTING_ACADEMY[archetype].reputation,
    applicants: 0,
    enrollment: 0,
    marketShare: 0,
    teachers,
    assignments: {},
    contracts: [],
    option: "NONE",
    lastBidTurn: null,
    pendingEffect: null,
  };
}

export type Setup = { state: GameState; deck: TeacherCard[] };

/** I-6·I-7 — 학원 순서는 항상 FRANCHISE, LEGACY, SELECTIVE 고정이고 플레이어는 playerArchetype 으로 식별한다 */
export function createInitialState(
  playerArchetype: Archetype,
  seed: number,
  pool: TeacherCard[],
  events: EventCard[],
  random: () => number,
): Setup {
  const shuffled = shuffle(pool, random);
  const { hands, deck } = dealStartingTeachers(shuffled);
  const academies = ARCHETYPES.map((archetype, index) =>
    createAcademy(archetype, hands[index].slice(0, STARTING_TEACHERS)),
  );
  const { market, deck: rest } = dealMarket(deck, 1, []);
  return {
    state: {
      seed,
      turn: 1,
      playerArchetype,
      academies,
      market,
      events,
      headlineTemplates: [],
    },
    deck: rest,
  };
}

// ─────────────────────────────── 승자

/** W-1 — 점유율 1위. 동률이면 평판 → 자금 → FRANCHISE > LEGACY > SELECTIVE 순 */
export function determineWinner(academies: Academy[], bankrupt: Set<Archetype>): Archetype | null {
  const alive = academies.filter((academy) => !bankrupt.has(academy.archetype));
  if (!alive.length) return null;
  return [...alive].sort(
    (left, right) =>
      right.marketShare - left.marketShare ||
      right.reputation - left.reputation ||
      right.cash - left.cash ||
      ARCHETYPES.indexOf(left.archetype) - ARCHETYPES.indexOf(right.archetype),
  )[0].archetype;
}

export { CLASS_CAPACITY };
