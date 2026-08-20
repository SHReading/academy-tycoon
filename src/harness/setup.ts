// 하네스 전용 셋업 — core 규칙을 그대로 쓰고, 하네스에만 필요한 것만 여기 남긴다.
//
// 규칙(셔플·시작 강사 배분·시장 추출·유찰 할인·승자 판정)은 전부 core/game.ts 소유다.
// 이 파일에는 합성 강사 풀과, core 함수를 하네스 호출 형태로 묶는 얇은 래퍼만 있다.

import {
  ARCHETYPES,
  createAcademy,
  dealStartingTeachers,
  discountUnsold,
  drawMarket,
  shuffle,
  winnerOf,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "../core/game.ts";
import {
  CLASS_CAPACITY,
  MAX_CARRIED_TEACHERS,
  STARTING_TEACHERS,
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

export { ARCHETYPES, discountUnsold, CLASS_CAPACITY };

// ─────────────────────────────── 강사 풀 (하네스 전용)

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

// ─────────────────────────────── core 래퍼

export type Market = { market: TeacherCard[]; deck: TeacherCard[] };

/** 이월분을 요구연봉이 싼 순으로 2장까지 남기고 core 의 시장 추출에 넘긴다. (I-5) */
export function dealMarket(deck: TeacherCard[], turn: number, unsold: TeacherCard[]): Market {
  const carried = [...unsold]
    .sort((left, right) => left.askingPrice - right.askingPrice)
    .slice(0, MAX_CARRIED_TEACHERS);
  return drawMarket(deck, turn, carried);
}

export type Setup = { state: GameState; deck: TeacherCard[] };

/** 하네스는 강사 풀·이벤트·난수를 직접 주입한다. core 의 createInitialState 는 콘텐츠 고정이라 쓸 수 없다. */
export function createInitialState(
  playerArchetype: Archetype,
  seed: number,
  pool: TeacherCard[],
  events: EventCard[],
  random: () => number,
): Setup {
  const shuffled = shuffle(pool, random);
  const { hands, deck } = dealStartingTeachers(shuffled);
  const academies = ARCHETYPES.map((archetype: Archetype, index: number) =>
    createAcademy(archetype, hands[index].slice(0, STARTING_TEACHERS)),
  );
  const { market, deck: rest } = dealMarket(deck, 1, []);
  return {
    state: { seed, turn: 1, playerArchetype, academies, market, events, headlineTemplates: [] },
    deck: rest,
  };
}

/** W-1 — 폐원한 학원을 뺀 뒤 core 의 승자 판정에 넘긴다. */
export function determineWinner(academies: Academy[], bankrupt: Set<Archetype>): Archetype | null {
  return winnerOf(academies.filter((academy) => !bankrupt.has(academy.archetype)));
}
