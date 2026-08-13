import assert from "node:assert/strict";
import test from "node:test";

const { decideAssignments, decideBid, decideOption } = await import("./ai.ts");

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

const academy = (archetype, cash = 200, reputation = 60) => ({
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

test("decideBid uses each archetype's approved target and multiplier", () => {
  const market = [
    teacher("teaching", "MATH", 9, 1, 10),
    teacher("fame", "KOREAN", 1, 9, 10),
    teacher("combined", "ENGLISH", 6, 6, 10),
  ];

  assert.deepEqual(decideBid(academy("FRANCHISE"), market), { teacherId: "fame", amount: 12 });
  assert.deepEqual(decideBid(academy("LEGACY"), market), { teacherId: "teaching", amount: 11 });
  assert.deepEqual(decideBid(academy("SELECTIVE"), market), { teacherId: "combined", amount: 13 });
});

test("decideBid applies contract reserve, archetype cash caps, and PICKY eligibility", () => {
  const selective = academy("SELECTIVE", 100, 44);
  selective.contracts = [{ teacherId: "old", price: 20, remainingTurns: 2 }];
  const market = [
    teacher("picky", "MATH", 10, 10, 10, "PICKY"),
    teacher("over-cap", "KOREAN", 8, 8, 24),
    teacher("affordable", "ENGLISH", 6, 6, 20),
  ];

  assert.deepEqual(decideBid(selective, market), { teacherId: "affordable", amount: 26 });
  assert.equal(decideBid(academy("LEGACY", 70), [teacher("too-expensive", "MATH", 9, 1, 30)]), undefined);
  const franchise = academy("FRANCHISE", 50);
  franchise.contracts = [{ teacherId: "old", price: 15, remainingTurns: 1 }];
  assert.equal(decideBid(franchise, [teacher("over-reserve", "MATH", 9, 1, 13)]), undefined);
});

test("decideAssignments fills subject slots by teaching, fame, and id without mutation", () => {
  const input = academy("FRANCHISE");
  input.teachers = [
    teacher("d", "MATH", 3, 1, 10),
    teacher("a", "MATH", 5, 1, 10),
    teacher("aa", "MATH", 5, 1, 10),
    teacher("c", "MATH", 4, 1, 10),
    teacher("b", "MATH", 5, 2, 10),
    teacher("e", "ENGLISH", 6, 1, 10),
  ];
  const snapshot = structuredClone(input);

  assert.deepEqual(decideAssignments(input), {
    TOP: { ENGLISH: "e", MATH: "b" },
    MID: { MATH: "a" },
    BASIC: { MATH: "aa" },
  });
  assert.deepEqual(input, snapshot);
});

test("decideOption picks the first true rule and never NONE", () => {
  const atRisk = academy("FRANCHISE", 29, 30);
  atRisk.contracts = [{ teacherId: "old", price: 10, remainingTurns: 1 }];
  assert.equal(decideOption(atRisk), "TUITION_HIKE");
  assert.equal(decideOption(academy("SELECTIVE", 30, 44)), "COUNSELING");
  assert.equal(decideOption(academy("FRANCHISE")), "SCHOLARSHIP");
  assert.equal(decideOption(academy("LEGACY")), "COUNSELING");
  assert.equal(decideOption(academy("SELECTIVE")), "SELF_STUDY");
});
