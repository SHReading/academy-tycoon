import assert from "node:assert/strict";
import test from "node:test";

const game = await import("./game.ts").catch(() => ({}));

test("createInitialState builds a deterministic playable state from content", () => {
  assert.equal(typeof game.createInitialState, "function");

  const state = game.createInitialState(17, "SELECTIVE");
  const teachingTotals = state.academies.map((academy) =>
    academy.teachers.reduce((sum, teacher) => sum + teacher.teaching, 0),
  );
  const cardIds = [
    ...state.academies.flatMap((academy) => academy.teachers),
    ...state.market,
    ...state.deck,
  ].map((teacher) => teacher.id);

  assert.deepEqual(game.createInitialState(17, "SELECTIVE"), state);
  assert.notDeepEqual(game.createInitialState(18, "SELECTIVE").market, state.market);
  assert.equal(state.turn, 1);
  assert.equal(state.playerArchetype, "SELECTIVE");
  assert.ok(state.academies.every((academy) => academy.teachers.length === 2));
  assert.equal(new Set(teachingTotals).size, 1);
  assert.equal(state.market.length, 4);
  assert.ok(state.market.every((teacher) => teacher.teaching <= 4));
  assert.equal(state.events.length, 20);
  assert.equal(state.headlineTemplates.length, 30);
  assert.equal(state.deficitStreak, 0);
  assert.equal(state.status, "PLAYING");
  assert.equal(state.winner, null);
  assert.equal(cardIds.length, 40);
  assert.equal(new Set(cardIds).size, 40);
});

test("refillMarket discounts and carries at most two unsold teachers before drawing", () => {
  assert.equal(typeof game.refillMarket, "function");

  const initial = game.createInitialState(1, "FRANCHISE");
  const teachers = new Map(
    [
      ...initial.academies.flatMap((academy) => academy.teachers),
      ...initial.market,
      ...initial.deck,
    ].map((teacher) => [teacher.id, teacher]),
  );
  const state = {
    ...initial,
    turn: 3,
    market: ["t_0001", "t_0013", "t_0011"].map((id) => ({ ...teachers.get(id) })),
    deck: ["t_0006", "t_0007", "t_0008", "t_0009"].map((id) => ({ ...teachers.get(id) })),
  };
  const snapshot = structuredClone(state);

  const refilled = game.refillMarket(state);

  assert.deepEqual(state, snapshot);
  assert.deepEqual(refilled.market.map(({ id }) => id), ["t_0001", "t_0013", "t_0006", "t_0007"]);
  assert.deepEqual(refilled.market.slice(0, 2).map(({ askingPrice }) => askingPrice), [8, 16]);
  assert.deepEqual(refilled.deck.map(({ id }) => id), ["t_0008", "t_0009"]);
  assert.ok(!refilled.deck.some(({ id }) => id === "t_0011"));

  const atFloor = game.refillMarket({
    ...initial,
    turn: 3,
    market: [{ ...teachers.get("t_0011"), askingPrice: 15 }],
    deck: ["t_0006", "t_0007", "t_0008"].map((id) => ({ ...teachers.get(id) })),
  });
  assert.equal(atFloor.market[0].askingPrice, 15);

  const early = game.refillMarket({
    ...initial,
    turn: 2,
    market: [],
    deck: ["t_0011", "t_0006", "t_0007", "t_0008", "t_0009"].map((id) => ({ ...teachers.get(id) })),
  });
  assert.equal(early.market.length, 4);
  assert.ok(early.market.every((teacher) => teacher.teaching <= 4));
  assert.ok(early.deck.some(({ id }) => id === "t_0011"));
});

test("resolveGameEnd tracks consecutive player deficits and resets on recovery", () => {
  assert.equal(typeof game.resolveGameEnd, "function");

  const initial = game.createInitialState(1, "SELECTIVE");
  const withPlayer = (state, cash) => ({
    ...state,
    academies: state.academies.map((academy) =>
      academy.archetype === state.playerArchetype ? { ...academy, cash } : academy,
    ),
  });
  const first = game.resolveGameEnd(withPlayer({ ...initial, turn: 2 }, -1));
  assert.equal(first.deficitStreak, 1);
  assert.equal(first.status, "PLAYING");
  assert.equal(first.winner, null);

  const recovered = game.resolveGameEnd(withPlayer({ ...first, turn: 3 }, 0));
  assert.equal(recovered.deficitStreak, 0);
  assert.equal(recovered.status, "PLAYING");

  const second = game.resolveGameEnd({
    ...withPlayer({ ...first, turn: 3 }, -1),
    academies: withPlayer({ ...first, turn: 3 }, -1).academies.map((academy) =>
      academy.archetype === "LEGACY"
        ? { ...academy, marketShare: 0.7 }
        : { ...academy, marketShare: 0.15 },
    ),
  });
  assert.equal(second.deficitStreak, 2);
  assert.equal(second.status, "LOST");
  assert.equal(second.winner, "LEGACY");
  assert.equal(game.resolveGameEnd(second), second);
});

test("resolveGameEnd decides the turn-six winner with approved tie breakers", () => {
  assert.equal(typeof game.resolveGameEnd, "function");

  const tied = game.createInitialState(2, "FRANCHISE");
  tied.turn = 7;
  tied.academies = tied.academies.map((academy) => ({
    ...academy,
    cash: 50,
    reputation: 50,
    marketShare: 1 / 3,
  }));

  const won = game.resolveGameEnd(tied);
  assert.equal(won.status, "WON");
  assert.equal(won.winner, "FRANCHISE");

  const finalNegative = game.resolveGameEnd({
    ...tied,
    academies: tied.academies.map((academy) =>
      academy.archetype === "FRANCHISE"
        ? { ...academy, cash: -1, marketShare: 0.8 }
        : { ...academy, marketShare: 0.1 },
    ),
  });
  assert.equal(finalNegative.deficitStreak, 1);
  assert.equal(finalNegative.status, "WON");
  assert.equal(finalNegative.winner, "FRANCHISE");

  const losing = game.createInitialState(2, "SELECTIVE");
  losing.turn = 7;
  losing.academies = losing.academies.map((academy) => ({
    ...academy,
    marketShare: academy.archetype === "LEGACY" ? 0.6 : 0.2,
  }));
  const lost = game.resolveGameEnd(losing);
  assert.equal(lost.status, "LOST");
  assert.equal(lost.winner, "LEGACY");
});
