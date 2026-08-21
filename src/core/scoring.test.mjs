import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";

const { allocateEnrollment, scoreClass, scoreTurn } = await import("./scoring.ts");
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10);

const academy = (overrides = {}) => ({
  archetype: "FRANCHISE",
  cash: 100,
  reputation: 40,
  applicants: 0,
  enrollment: 100,
  marketShare: 0,
  teachers: [],
  assignments: {},
  contracts: [],
  option: "NONE",
  lastBidTurn: null,
  pendingEffect: null,
  ...overrides,
});

const state = (academies) => ({
  seed: 1,
  turn: 1,
  playerArchetype: academies[0].archetype,
  academies,
  market: [],
  events: [],
  headlineTemplates: [],
});

const teacher = (id, subject, trait, teaching = 2, fame = 1) => ({
  id,
  name: id,
  subject,
  teaching,
  fame,
  askingPrice: 10,
  trait,
  blurb: id,
});

test("hand calculation 1: empty classes score zero without a slot penalty", () => {
  const input = state([academy(), academy(), academy()]);
  const snapshot = structuredClone(input);
  const result = scoreTurn(input);

  for (const settled of result) {
    assert.equal(settled.reputation, 34);
    assert.equal(settled.applicants, 120);
    assert.equal(settled.enrollment, 96);
    assert.equal(settled.cash, 128);
    closeTo(settled.marketShare, 1 / 3);
    assert.equal(settled.pendingEffect, null);
  }
  assert.deepEqual(input, snapshot);
});

test("enrollment uses the approved 20/30/30/20 class split", () => {
  assert.deepEqual(allocateEnrollment(103), { TOP: 21, UPPER_MID: 31, MID: 31, BASIC: 21 });
  assert.deepEqual(allocateEnrollment(300), { TOP: 40, UPPER_MID: 60, MID: 60, BASIC: 40 });
});

test("class score ignores subjects, caps teachers at two, and applies the class specialist bonus", () => {
  const teachers = [
    teacher("specialist", "KOREAN", "CLASS_SPECIALIST", 2),
    teacher("media", "KOREAN", "MEDIA_FIGURE", 3),
    teacher("ignored", "KOREAN", "CLASS_SPECIALIST", 5),
  ];
  const input = academy({ teachers, assignments: { TOP: teachers.map(({ id }) => id) } });

  assert.equal(scoreClass(input, "TOP"), 15);
  assert.equal(scoreClass(input, "UPPER_MID"), 0);
});

test("faction gains its existing bonus from a classmate without reading subjects", () => {
  const teachers = [
    teacher("faction", "KOREAN", "FACTION"),
    teacher("classmate", "MATH", "MEDIA_FIGURE"),
  ];
  const input = academy({ teachers, assignments: { TOP: teachers.map(({ id }) => id) } });

  assert.equal(scoreClass(input, "TOP"), 12);
});

test("hand calculation 2: four class scores and contracts settle with three options", () => {
  const teachers = ["top", "upper", "mid", "basic"].map((id) =>
    teacher(id, "MATH", "CLASS_SPECIALIST"),
  );
  const legacy = academy({
    archetype: "LEGACY",
    cash: 70,
    reputation: 60,
    enrollment: 200,
    teachers,
    assignments: { TOP: ["top"], UPPER_MID: ["upper"], MID: ["mid"], BASIC: ["basic"] },
    contracts: [{ teacherId: "top", price: 10, remainingTurns: 6 }],
  });
  const result = scoreTurn(state([legacy, structuredClone(legacy), structuredClone(legacy)]));

  for (const settled of result) {
    closeTo(settled.reputation, 55.08);
    assert.equal(settled.applicants, 100);
    closeTo(settled.enrollment, 81.5);
    closeTo(settled.cash, 80.75);
    assert.deepEqual(settled.contracts, [{ teacherId: "top", price: 10, remainingTurns: 5 }]);
  }
});

test("hand calculation 3: media and pending event effects apply once", () => {
  const teachers = [
    teacher("media", "KOREAN", "MEDIA_FIGURE", 3, 2),
    teacher("specialist", "KOREAN", "CLASS_SPECIALIST"),
  ];
  const selective = academy({
    archetype: "SELECTIVE",
    cash: 50,
    reputation: 45,
    enrollment: 50,
    teachers,
    assignments: { TOP: ["media", "specialist"] },
    pendingEffect: { reputation: 5, cash: -3, churn: -0.1, applicants: 0.2, grade: 0.1 },
  });
  const result = scoreTurn(state([selective, structuredClone(selective), structuredClone(selective)]));

  for (const settled of result) {
    closeTo(settled.reputation, 43.930625);
    closeTo(settled.applicants, 144);
    closeTo(settled.enrollment, 118.08);
    closeTo(settled.cash, 86.04);
    closeTo(settled.marketShare, 1 / 3);
    assert.equal(settled.pendingEffect, null);
  }
});

test("one settlement completes within 16ms", () => {
  const teachers = ["a", "b", "c", "d"].map((id) =>
    teacher(id, "MATH", "CLASS_SPECIALIST", 5, 5),
  );
  const full = academy({
    teachers,
    assignments: { TOP: ["a", "b"], UPPER_MID: ["c", "d"] },
    contracts: teachers.map(({ id }) => ({ teacherId: id, price: 10, remainingTurns: 6 })),
    option: "SELF_STUDY",
    pendingEffect: { churn: -0.1, applicants: 0.2, grade: 0.1 },
  });
  const input = state([full, structuredClone(full), structuredClone(full)]);
  const start = performance.now();
  scoreTurn(input);
  assert.ok(performance.now() - start < 16);
});

test("churn floor is applied before option and event ratios", () => {
  const teachers = ["a", "b"].map((id) => teacher(id, "SCIENCE", "CLASS_SPECIALIST", 5, 1));
  const input = academy({
    teachers,
    assignments: { BASIC: ["a", "b"] },
    option: "SELF_STUDY",
    pendingEffect: { churn: -0.1, grade: 10 },
  });
  const [result] = scoreTurn(state([input, academy(), academy()]));
  const expectedApplicants = 300 * ((result.reputation + 4) / ((result.reputation + 4) + 34 + 34)) * 1.2;

  closeTo(result.enrollment, expectedApplicants * (1 - 0.05 * 0.8 * 0.9));
});

test("class scores and reputation cannot fall below zero", () => {
  const weak = academy({ archetype: "LEGACY", reputation: 10, enrollment: 200 });
  const insolvent = academy({ reputation: -10 });
  const [weakResult, insolventResult] = scoreTurn(state([weak, insolvent, academy()]));

  assert.equal(weakResult.reputation, 9);
  assert.equal(insolventResult.reputation, 0);
});
