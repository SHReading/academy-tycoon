import eventContent from "../content/events.json" with { type: "json" };
import headlineContent from "../content/headlines.json" with { type: "json" };
import teacherContent from "../content/teachers.json" with { type: "json" };
import {
  EARLY_MARKET_TURNS,
  MARKET_SIZE,
  MAX_CARRIED_TEACHERS,
  MAX_EARLY_TEACHING,
  MIN_ASKING_PRICE_RATIO,
  STARTING_ACADEMY,
  STARTING_TEACHERS,
  TOTAL_TURNS,
  UNSOLD_PRICE_MULTIPLIER,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "./balance.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { mulberry32 } from "./rng.ts";
import type {
  Academy,
  Archetype,
  EventCard,
  GameState,
  HeadlineTemplate,
  TeacherCard,
} from "./types";

const ARCHETYPES: Archetype[] = ["FRANCHISE", "LEGACY", "SELECTIVE"];
const ORIGINAL_PRICES = new Map(
  (teacherContent as TeacherCard[]).map((teacher) => [teacher.id, teacher.askingPrice]),
);

const shuffle = <T>(items: T[], random: () => number): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

const dealStartingTeachers = (deck: TeacherCard[]): { hands: TeacherCard[][]; deck: TeacherCard[] } => {
  const window = deck.slice(0, 30);
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
      return { hands, deck: deck.filter((teacher) => !used.has(teacher.id)) };
    }
  }
  throw new Error("시작 강사 강의력 합을 동일하게 배분할 수 없다");
};

const drawMarket = (
  deck: TeacherCard[],
  turn: number,
  carried: TeacherCard[] = [],
): { market: TeacherCard[]; deck: TeacherCard[] } => {
  const remaining = [...deck];
  const skipped: TeacherCard[] = [];
  const market = [...carried];
  while (market.length < MARKET_SIZE && remaining.length) {
    const teacher = remaining.shift() as TeacherCard;
    if (turn <= EARLY_MARKET_TURNS && teacher.teaching > MAX_EARLY_TEACHING) {
      skipped.push(teacher);
    } else {
      market.push(teacher);
    }
  }
  return { market, deck: [...skipped, ...remaining] };
};

const discountUnsold = (teacher: TeacherCard): TeacherCard => {
  const originalPrice = ORIGINAL_PRICES.get(teacher.id) ?? teacher.askingPrice;
  return {
    ...teacher,
    askingPrice: Math.max(
      Math.ceil(originalPrice * MIN_ASKING_PRICE_RATIO),
      Math.floor(teacher.askingPrice * UNSOLD_PRICE_MULTIPLIER),
    ),
  };
};

const createAcademy = (archetype: Archetype, teachers: TeacherCard[]): Academy => ({
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
});

export function createInitialState(seed: number, playerArchetype: Archetype): GameState {
  const teachers = (teacherContent as TeacherCard[]).map((teacher) => ({ ...teacher }));
  const shuffled = shuffle(teachers, mulberry32(seed));
  const starting = dealStartingTeachers(shuffled);
  const dealt = drawMarket(starting.deck, 1);

  return {
    seed,
    turn: 1,
    playerArchetype,
    academies: ARCHETYPES.map((archetype, index) =>
      createAcademy(archetype, starting.hands[index].slice(0, STARTING_TEACHERS)),
    ),
    market: dealt.market,
    deck: dealt.deck,
    events: (eventContent as EventCard[]).map((event) => ({
      ...event,
      trigger: { ...event.trigger },
      effect: { ...event.effect },
    })),
    headlineTemplates: (headlineContent as HeadlineTemplate[]).map((headline) => ({ ...headline })),
    deficitStreak: 0,
    status: "PLAYING",
    winner: null,
  };
}

export function refillMarket(state: GameState): GameState {
  if (state.status && state.status !== "PLAYING") return state;
  const carried = state.market
    .map(discountUnsold)
    .sort((left, right) => left.askingPrice - right.askingPrice)
    .slice(0, MAX_CARRIED_TEACHERS);
  const dealt = drawMarket(state.deck ?? [], state.turn, carried);
  return { ...state, market: dealt.market, deck: dealt.deck };
}

const winnerOf = (academies: Academy[]): Archetype | null =>
  [...academies].sort(
    (left, right) =>
      right.marketShare - left.marketShare ||
      right.reputation - left.reputation ||
      right.cash - left.cash ||
      ARCHETYPES.indexOf(left.archetype) - ARCHETYPES.indexOf(right.archetype),
  )[0]?.archetype ?? null;

export function resolveGameEnd(state: GameState): GameState {
  if (state.status && state.status !== "PLAYING") return state;
  const player = state.academies.find(({ archetype }) => archetype === state.playerArchetype);
  if (!player) return state;

  const deficitStreak = player.cash < 0 ? (state.deficitStreak ?? 0) + 1 : 0;
  if (deficitStreak >= 2) {
    return {
      ...state,
      deficitStreak,
      status: "LOST",
      winner: winnerOf(state.academies.filter(({ archetype }) => archetype !== state.playerArchetype)),
    };
  }

  if (state.turn > TOTAL_TURNS) {
    const winner = winnerOf(state.academies);
    return {
      ...state,
      deficitStreak,
      status: winner === state.playerArchetype ? "WON" : "LOST",
      winner,
    };
  }

  return { ...state, deficitStreak, status: "PLAYING", winner: null };
}
