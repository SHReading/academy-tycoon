import {
  BASE_OPERATING_COST,
  CONTRACT_TURNS,
  FRANCHISE_BID_MULTIPLIER,
  LEGACY_BID_CASH_LIMIT,
  LEGACY_BID_MULTIPLIER,
  PICKY_REPUTATION_MINIMUM,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "./balance.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { mulberry32 } from "./rng.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { scoreTurn } from "./scoring.ts";
import type { Academy, Action, Archetype, GameState, TeacherCard } from "./types";

const academyIndex = (state: GameState, archetype: Archetype): number =>
  state.academies.findIndex((academy) => academy.archetype === archetype);

const bidLimit = (academy: Academy): number =>
  academy.cash -
  academy.contracts
    .filter((contract) => contract.remainingTurns > 0)
    .reduce((sum, contract) => sum + contract.price, 0) -
  BASE_OPERATING_COST;

const canBid = (teacher: TeacherCard, academy: Academy): boolean =>
  teacher.trait !== "PICKY" || academy.reputation >= PICKY_REPUTATION_MINIMUM;

const aiBid = (state: GameState, archetype: "FRANCHISE" | "LEGACY") => {
  if (state.playerArchetype === archetype) return undefined;
  const academy = state.academies[academyIndex(state, archetype)];
  if (!academy || academy.lastBidTurn === state.turn) return undefined;
  const multiplier = archetype === "FRANCHISE" ? FRANCHISE_BID_MULTIPLIER : LEGACY_BID_MULTIPLIER;
  const limit = Math.min(
    bidLimit(academy),
    archetype === "LEGACY" ? academy.cash * LEGACY_BID_CASH_LIMIT : Infinity,
  );
  const priority = archetype === "FRANCHISE" ? "fame" : "teaching";
  const teacher = [...state.market]
    .filter((card) => canBid(card, academy))
    .sort(
      (left, right) =>
        right[priority] - left[priority] ||
        left.askingPrice - right.askingPrice ||
        left.id.localeCompare(right.id),
    )
    .find((card) => Math.ceil(card.askingPrice * multiplier) <= limit);
  if (!teacher) return undefined;
  return { archetype, teacherId: teacher.id, amount: Math.ceil(teacher.askingPrice * multiplier) };
};

const resolveBid = (state: GameState, action: Extract<Action, { type: "BID" }>): GameState => {
  const playerIndex = academyIndex(state, state.playerArchetype);
  const player = state.academies[playerIndex];
  const teacher = state.market.find((card) => card.id === action.teacherId);
  const aiBids = [aiBid(state, "FRANCHISE"), aiBid(state, "LEGACY")].filter(
    (bid) => bid !== undefined,
  );
  const playerBid =
    teacher &&
    player &&
    player.lastBidTurn !== state.turn &&
    action.amount >= teacher.askingPrice &&
    canBid(teacher, player)
      ? { archetype: state.playerArchetype, teacherId: teacher.id, amount: action.amount }
      : undefined;
  const bids = [...aiBids, ...(playerBid ? [playerBid] : [])];

  const academies = state.academies.map((academy) => ({ ...academy }));
  for (const bid of bids) academies[academyIndex(state, bid.archetype)].lastBidTurn = state.turn;

  const wonIds = new Set<string>();
  for (const teacherId of new Set(bids.map((bid) => bid.teacherId))) {
    const winner = bids
      .filter((bid) => bid.teacherId === teacherId)
      .sort(
        (left, right) =>
          right.amount - left.amount ||
          state.academies[academyIndex(state, right.archetype)].reputation -
            state.academies[academyIndex(state, left.archetype)].reputation,
      )[0];
    const wonTeacher = state.market.find((card) => card.id === teacherId);
    if (!winner || !wonTeacher) continue;
    const index = academyIndex(state, winner.archetype);
    academies[index] = {
      ...academies[index],
      teachers: [...academies[index].teachers, wonTeacher],
      contracts: [
        ...academies[index].contracts,
        { teacherId, price: winner.amount, remainingTurns: CONTRACT_TURNS },
      ],
    };
    wonIds.add(teacherId);
  }
  return { ...state, academies, market: state.market.filter((card) => !wonIds.has(card.id)) };
};

const assign = (state: GameState, action: Extract<Action, { type: "ASSIGN" }>): GameState => {
  const index = academyIndex(state, state.playerArchetype);
  const player = state.academies[index];
  const teacher = player?.teachers.find((card) => card.id === action.teacherId);
  if (!player || !teacher) return state;
  const assignments = Object.fromEntries(
    Object.entries(player.assignments).map(([tier, slots]) => [
      tier,
      Object.fromEntries(Object.entries(slots).filter(([, id]) => id !== teacher.id)),
    ]),
  );
  assignments[action.classTier] = {
    ...(assignments[action.classTier] ?? {}),
    [teacher.subject]: teacher.id,
  };
  const academies = [...state.academies];
  academies[index] = { ...player, assignments };
  return { ...state, academies };
};

const settle = (state: GameState): GameState => {
  const settled = scoreTurn(state);
  const candidates = state.events.filter(
    (event) =>
      event.trigger.minTurn <= state.turn &&
      (event.trigger.maxTurn ?? Infinity) >= state.turn &&
      (event.trigger.requires === undefined || event.trigger.requires === "NONE"),
  );
  const random = mulberry32(state.seed + state.turn)();
  const totalWeight = candidates.reduce((sum, event) => sum + event.weight, 0);
  let cursor = random * totalWeight;
  const event = candidates.find((candidate) => (cursor -= candidate.weight) < 0);
  const academies = settled.map((academy) => ({ ...academy, option: "NONE" as const }));
  if (event) {
    const index = academyIndex(state, state.playerArchetype);
    academies[index] = { ...academies[index], pendingEffect: { ...event.effect } };
  }
  return {
    ...state,
    turn: state.turn + 1,
    academies,
    lastResult: { turn: state.turn, academies: settled, headlines: [], event },
  };
};

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "BID": return resolveBid(state, action);
    case "ASSIGN": return assign(state, action);
    case "OPTION": {
      const index = academyIndex(state, state.playerArchetype);
      const academies = [...state.academies];
      academies[index] = { ...academies[index], option: action.option };
      return { ...state, academies };
    }
    case "SETTLE": return settle(state);
  }
}
