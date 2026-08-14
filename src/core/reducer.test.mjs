import assert from "node:assert/strict";
import test from "node:test";

const { reducer } = await import("./reducer.ts");

const teacher = (id, subject, teaching, fame, askingPrice, trait = "FACTION") => ({
  id,
  name: id,
  subject,
  teaching,
  fame,
  askingPrice,
  trait,
  blurb: id,
});

const academy = (archetype, cash, reputation) => ({
  archetype,
  cash,
  reputation,
  applicants: 0,
  enrollment: 100,
  marketShare: 1 / 3,
  teachers: [],
  assignments: {},
  contracts: [],
  option: "NONE",
  lastBidTurn: null,
  pendingEffect: null,
});

const makeState = () => ({
  seed: 1,
  turn: 1,
  playerArchetype: "SELECTIVE",
  academies: [academy("FRANCHISE", 100, 40), academy("LEGACY", 70, 60), academy("SELECTIVE", 50, 45)],
  market: [
    teacher("fame", "KOREAN", 2, 5, 10),
    teacher("teaching", "MATH", 5, 2, 10),
    teacher("player", "ENGLISH", 3, 3, 12),
  ],
  events: [],
  headlineTemplates: [],
});

test("BID resolves player, FRANCHISE, and LEGACY bids immediately within cash caps", () => {
  const input = makeState();
  input.academies[0].contracts.push({ teacherId: "old", price: 70, remainingTurns: 3 });
  const snapshot = structuredClone(input);
  const result = reducer(input, { type: "BID", teacherId: "player", amount: 15 });

  assert.deepEqual(input, snapshot);
  assert.deepEqual(result.market.map(({ id }) => id), ["fame"]);
  assert.deepEqual(result.academies[0].teachers.map(({ id }) => id), []);
  assert.deepEqual(result.academies[1].teachers.map(({ id }) => id), ["teaching"]);
  assert.deepEqual(result.academies[2].teachers.map(({ id }) => id), ["player"]);
  assert.deepEqual(result.academies[1].contracts, [{ teacherId: "teaching", price: 11, remainingTurns: 6 }]);
  assert.deepEqual(result.academies[2].contracts, [{ teacherId: "player", price: 15, remainingTurns: 6 }]);
  assert.equal(result.academies[2].lastBidTurn, 1);
});

test("BID resolves the SELECTIVE AI target within its 30 percent cash cap", () => {
  const input = makeState();
  input.playerArchetype = "FRANCHISE";
  const result = reducer(input, { type: "BID", teacherId: "player", amount: 15 });

  assert.deepEqual(result.academies[2].teachers.map(({ id }) => id), ["fame"]);
  assert.deepEqual(result.academies[2].contracts, [
    { teacherId: "fame", price: 13, remainingTurns: 6 },
  ]);
  assert.equal(result.academies[2].lastBidTurn, 1);
});

test("BID can resolve at most once per academy each turn", () => {
  const input = makeState();
  input.market.push(teacher("leftover", "SCIENCE", 1, 1, 5));
  const first = reducer(input, { type: "BID", teacherId: "player", amount: 15 });
  const second = reducer(first, { type: "BID", teacherId: "leftover", amount: 20 });

  assert.deepEqual(second, first);
});

test("LEGACY bid respects its existing 40 percent cash cap", () => {
  const input = makeState();
  input.market = [teacher("expensive", "MATH", 5, 1, 30)];
  const result = reducer(input, { type: "BID", teacherId: "missing", amount: 0 });

  assert.deepEqual(result.academies[1].teachers, []);
});

test("PICKY accepts a player bid but excludes an ineligible academy from winning", () => {
  const input = makeState();
  input.academies[0].lastBidTurn = 1;
  input.academies[1].lastBidTurn = 1;
  input.academies[2].reputation = 44;
  input.market = [teacher("picky", "MATH", 5, 5, 10, "PICKY")];

  const result = reducer(input, { type: "BID", teacherId: "picky", amount: 20 });

  assert.equal(result.academies[2].lastBidTurn, 1);
  assert.deepEqual(result.academies[2].contracts, []);
  assert.deepEqual(result.market.map(({ id }) => id), ["picky"]);
});

test("ASSIGN moves a teacher to its subject slot and OPTION updates the player academy", () => {
  const input = makeState();
  input.academies[2].teachers = [input.market[2]];
  input.academies[2].assignments = { TOP: { ENGLISH: "player" } };

  const assigned = reducer(input, { type: "ASSIGN", teacherId: "player", classTier: "MID" });
  const optioned = reducer(assigned, { type: "OPTION", option: "COUNSELING" });

  assert.deepEqual(assigned.academies[2].assignments, { TOP: {}, MID: { ENGLISH: "player" } });
  assert.equal(optioned.academies[2].option, "COUNSELING");
});

test("SETTLE scores the turn and stores one weighted event for the next turn", () => {
  const input = makeState();
  input.events = [
    { id: "e_0001", trigger: { minTurn: 1 }, headline: "첫 번째 이벤트 발생", effect: { cash: 5 }, weight: 1 },
    { id: "e_0002", trigger: { minTurn: 1 }, headline: "두 번째 이벤트 발생", effect: { reputation: 3 }, weight: 9 },
  ];
  const result = reducer(input, { type: "SETTLE" });
  const player = result.academies.find(({ archetype }) => archetype === "SELECTIVE");

  assert.equal(result.turn, 2);
  assert.deepEqual(player.pendingEffect, { reputation: 3 });
  assert.equal(player.option, "NONE");
  assert.equal(result.lastResult.event.id, "e_0002");
  assert.deepEqual(result.lastResult.headlines, [
    { text: "두 번째 이벤트 발생", tone: "GOOD" },
  ]);
});

test("SETTLE selects three prioritized, bound headline templates with tone", () => {
  const input = makeState();
  input.academies[2].cash = 0;
  input.headlineTemplates = [
    { id: "h_0001", situation: "NO_BID", template: "{academy}, 이번 학기 영입 없어", tone: "NEUTRAL", weight: 1 },
    { id: "h_0002", situation: "TOP_CLASS_EMPTY_SLOT", template: "상위반 {subject} 포함 {n}자리 공석", tone: "BAD", weight: 1 },
    { id: "h_0003", situation: "CASH_CRISIS", template: "{academy} 잔액 {n}, 비상 운영", tone: "BAD", weight: 1 },
  ];

  const result = reducer(input, { type: "SETTLE" });

  assert.deepEqual(result.lastResult.headlines, [
    { text: "선발형 학원 잔액 11, 비상 운영", tone: "BAD" },
    { text: "상위반 국어 포함 4자리 공석", tone: "BAD" },
    { text: "선발형 학원, 이번 학기 영입 없어", tone: "NEUTRAL" },
  ]);
});

test("SETTLE draws events whose approved requires condition matches the settled player", () => {
  const input = makeState();
  input.events = [
    { id: "e_0001", trigger: { minTurn: 1, requires: "REPUTATION_ABOVE_60" }, headline: "높은 평판 이벤트", effect: { cash: 1 }, weight: 1 },
    { id: "e_0002", trigger: { minTurn: 1, requires: "REPUTATION_BELOW_40" }, headline: "낮은 평판 이벤트", effect: { cash: -1 }, weight: 1 },
  ];

  const result = reducer(input, { type: "SETTLE" });

  assert.equal(result.lastResult.event.id, "e_0002");
  assert.deepEqual(result.academies[2].pendingEffect, { cash: -1 });
});

test("SETTLE decides AI assignments and options before scoring", () => {
  const input = makeState();
  input.academies[0].reputation = 50;
  input.academies[0].teachers = [
    teacher("f-low", "MATH", 3, 2, 10),
    teacher("f-high", "MATH", 5, 1, 10),
  ];
  input.academies[1].teachers = [teacher("l", "ENGLISH", 4, 1, 10)];

  const result = reducer(input, { type: "SETTLE" });
  const franchise = result.lastResult.academies.find(({ archetype }) => archetype === "FRANCHISE");
  const legacy = result.lastResult.academies.find(({ archetype }) => archetype === "LEGACY");

  assert.deepEqual(franchise.assignments, { TOP: { MATH: "f-high" }, MID: { MATH: "f-low" } });
  assert.equal(franchise.option, "SCHOLARSHIP");
  assert.deepEqual(legacy.assignments, { TOP: { ENGLISH: "l" } });
  assert.equal(legacy.option, "COUNSELING");
});

test("same seed and action sequence produces the same state 100 times", () => {
  const actions = [
    { type: "BID", teacherId: "player", amount: 15 },
    { type: "ASSIGN", teacherId: "player", classTier: "TOP" },
    { type: "OPTION", option: "SELF_STUDY" },
    { type: "SETTLE" },
  ];
  const run = () => {
    const input = makeState();
    input.events = [
      { id: "e_0001", trigger: { minTurn: 1 }, headline: "결정성 이벤트 발생", effect: { cash: 5 }, weight: 1 },
      { id: "e_0002", trigger: { minTurn: 1 }, headline: "두 번째 결정성 이벤트", effect: { reputation: 3 }, weight: 9 },
    ];
    return actions.reduce(reducer, input);
  };
  const expected = run();

  for (let index = 0; index < 100; index += 1) assert.deepEqual(run(), expected);
});
