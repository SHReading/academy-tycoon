import {
  CONTRACT_TURNS,
  PICKY_REPUTATION_MINIMUM,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "./balance.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { decideAssignments, decideBid, decideOption } from "./ai.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { isEventEligible } from "./events.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { selectHeadlines } from "./headlines.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { mulberry32 } from "./rng.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { scoreClass, scoreTurn } from "./scoring.ts";
import type { Action, Archetype, GameState } from "./types";

const academyIndex = (state: GameState, archetype: Archetype): number =>
  state.academies.findIndex((academy) => academy.archetype === archetype);

const resolveBid = (state: GameState, action: Extract<Action, { type: "BID" }>): GameState => {
  const playerIndex = academyIndex(state, state.playerArchetype);
  const player = state.academies[playerIndex];
  const teacher = state.market.find((card) => card.id === action.teacherId);
  const aiBids = state.academies.flatMap((academy) => {
    if (academy.archetype === state.playerArchetype || academy.lastBidTurn === state.turn) return [];
    const bid = decideBid(academy, state.market);
    return bid ? [{ archetype: academy.archetype, ...bid }] : [];
  });
  const playerBid =
    teacher &&
    player &&
    player.lastBidTurn !== state.turn &&
    action.amount >= teacher.askingPrice
      ? { archetype: state.playerArchetype, teacherId: teacher.id, amount: action.amount }
      : undefined;
  const bids = [...aiBids, ...(playerBid ? [playerBid] : [])];

  const academies = state.academies.map((academy) => ({ ...academy }));
  for (const bid of bids) academies[academyIndex(state, bid.archetype)].lastBidTurn = state.turn;

  const wonIds = new Set<string>();
  let playerWinner: Archetype | undefined;
  for (const teacherId of new Set(bids.map((bid) => bid.teacherId))) {
    const wonTeacher = state.market.find((card) => card.id === teacherId);
    if (!wonTeacher) continue;
    const winner = bids
      .filter(
        (bid) =>
          bid.teacherId === teacherId &&
          (wonTeacher.trait !== "PICKY" ||
            state.academies[academyIndex(state, bid.archetype)].reputation >=
              PICKY_REPUTATION_MINIMUM),
      )
      .sort(
        (left, right) =>
          right.amount - left.amount ||
          state.academies[academyIndex(state, right.archetype)].reputation -
            state.academies[academyIndex(state, left.archetype)].reputation,
      )[0];
    if (!winner) continue;
    if (playerBid?.teacherId === teacherId) playerWinner = winner.archetype;
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
  return {
    ...state,
    academies,
    market: state.market.filter((card) => !wonIds.has(card.id)),
    ...(playerBid
      ? { turnBid: { teacherId: playerBid.teacherId, amount: playerBid.amount, winner: playerWinner } }
      : {}),
  };
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
  const prepared = {
    ...state,
    academies: state.academies.map((academy) =>
      academy.archetype === state.playerArchetype
        ? academy
        : {
            ...academy,
            assignments: decideAssignments(academy),
            option: decideOption(academy),
          },
    ),
  };
  const settled = scoreTurn(prepared);
  const candidates = state.events.filter((event) => isEventEligible(event, state, settled));
  const random = mulberry32(state.seed + state.turn);
  const totalWeight = candidates.reduce((sum, event) => sum + event.weight, 0);
  let cursor = random() * totalWeight;
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
    turnBid: undefined,
    lastResult: {
      turn: state.turn,
      academies: settled,
      headlines: selectHeadlines(state, settled, event, random),
      topClassScore: scoreClass(
        prepared.academies[academyIndex(prepared, state.playerArchetype)],
        "TOP",
      ),
      event,
    },
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
