import assert from "node:assert/strict";
import test from "node:test";

const { isEventEligible } = await import("./events.ts");

const academy = (archetype, overrides = {}) => ({
  archetype,
  cash: 50,
  reputation: 50,
  applicants: 0,
  enrollment: 100,
  marketShare: 1 / 3,
  teachers: [],
  assignments: {},
  contracts: [],
  option: "NONE",
  lastBidTurn: null,
  pendingEffect: null,
  ...overrides,
});

const state = () => ({
  seed: 1,
  turn: 2,
  playerArchetype: "SELECTIVE",
  academies: [
    academy("FRANCHISE", { cash: -1 }),
    academy("LEGACY", { marketShare: 0.6 }),
    academy("SELECTIVE", { lastBidTurn: 1, assignments: { TOP: ["k", "m"] } }),
  ],
  market: [],
  events: [],
  headlineTemplates: [],
});

const event = (requires) => ({
  id: "e_0001",
  trigger: { minTurn: 2, requires },
  headline: "조건 이벤트 발생",
  effect: {},
  weight: 1,
});

test("isEventEligible evaluates all eight approved requires codes after settlement", () => {
  const input = state();
  const settled = [
    academy("FRANCHISE", { cash: -2, marketShare: 0.1 }),
    academy("LEGACY", { marketShare: 0.7 }),
    academy("SELECTIVE", { cash: 19, reputation: 39, marketShare: 0.2, assignments: input.academies[2].assignments }),
  ];

  for (const requires of ["NONE", "REPUTATION_BELOW_40", "CASH_BELOW_20", "SHARE_LAST", "NO_BID_LAST_TURN", "TOP_CLASS_FULL"]) {
    assert.equal(isEventEligible(event(requires), input, settled), true, requires);
  }
  assert.equal(isEventEligible({ ...event(undefined), trigger: { minTurn: 2 } }, input, settled), true);

  settled[2].reputation = 61;
  settled[2].marketShare = 0.8;
  assert.equal(isEventEligible(event("REPUTATION_ABOVE_60"), input, settled), true);
  assert.equal(isEventEligible(event("SHARE_LEADER"), input, settled), true);

  assert.equal(isEventEligible({ ...event("NONE"), trigger: { minTurn: 3, maxTurn: 4, requires: "NONE" } }, input, settled), false);
  input.academies[2].lastBidTurn = 2;
  assert.equal(isEventEligible(event("NO_BID_LAST_TURN"), input, settled), false);
});
