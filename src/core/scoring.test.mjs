import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";

const { allocateEnrollment, scoreTurn } = await import("./scoring.ts");
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

test("hand calculation 1: base settlement follows steps 1 through 7", () => {
  const input = state([academy(), academy(), academy()]);
  const snapshot = structuredClone(input);
  const result = scoreTurn(input);

  for (const settled of result) {
    assert.equal(settled.reputation, 26.8);
    assert.equal(settled.applicants, 120);
    assert.equal(settled.enrollment, 91.2);
    assert.equal(settled.cash, 125.6);
    assert.equal(settled.marketShare, 1 / 3);
    assert.equal(settled.pendingEffect, null);
  }
  assert.deepEqual(input, snapshot);
});

test("enrollment is rounded and capped at the 20/40/40 class split", () => {
  assert.deepEqual(allocateEnrollment(103), { TOP: 21, MID: 41, BASIC: 41 });
  assert.deepEqual(allocateEnrollment(300), { TOP: 40, MID: 80, BASIC: 80 });
});

test("hand calculation 2: per-teacher traits, counseling, and contracts stack", () => {
  const teachers = [
    teacher("top", "KOREAN", "TOP_CLASS_SPECIALIST"),
    teacher("mid-1", "MATH", "MID_CLASS_SPECIALIST"),
    teacher("mid-2", "ENGLISH", "MID_CLASS_SPECIALIST"),
    teacher("basic", "SCIENCE", "BASIC_CLASS_SPECIALIST"),
  ];
  const legacy = academy({
    archetype: "LEGACY",
    cash: 70,
    reputation: 60,
    enrollment: 200,
    teachers,
    assignments: {
      TOP: { KOREAN: "top" },
      MID: { MATH: "mid-1", ENGLISH: "mid-2" },
      BASIC: { SCIENCE: "basic" },
    },
    contracts: [{ teacherId: "top", price: 10, remainingTurns: 6 }],
    option: "COUNSELING",
  });
  const result = scoreTurn(state([legacy, structuredClone(legacy), structuredClone(legacy)]));

  for (const settled of result) {
    assert.equal(settled.reputation, 50.756);
    assert.equal(settled.applicants, 100);
    closeTo(settled.enrollment, 105.17);
    closeTo(settled.cash, 84.585);
    assert.deepEqual(settled.contracts, [{ teacherId: "top", price: 10, remainingTurns: 5 }]);
  }
});

test("hand calculation 3: pending ratios and absolutes apply once", () => {
  const teachers = [
    teacher("media", "KOREAN", "MEDIA_FIGURE", 3, 2),
    teacher("faction-top", "MATH", "FACTION"),
    teacher("faction-mid", "MATH", "FACTION"),
  ];
  const selective = academy({
    archetype: "SELECTIVE",
    cash: 50,
    reputation: 45,
    enrollment: 50,
    teachers,
    assignments: { TOP: { KOREAN: "media", MATH: "faction-top" }, MID: { MATH: "faction-mid" } },
    option: "TUITION_HIKE",
    pendingEffect: { reputation: 5, cash: -3, churn: -0.1, applicants: 0.2, grade: 0.1 },
  });
  const result = scoreTurn(state([selective, structuredClone(selective), structuredClone(selective)]));

  for (const settled of result) {
    closeTo(settled.reputation, 34.49825);
    closeTo(settled.applicants, 91.8);
    closeTo(settled.enrollment, 71.64072);
    closeTo(settled.cash, 71.77545);
    assert.equal(settled.marketShare, 1 / 3);
    assert.equal(settled.pendingEffect, null);
  }
});

test("one settlement completes within 16ms", () => {
  const teachers = [
    teacher("top", "KOREAN", "TOP_CLASS_SPECIALIST", 5, 5),
    teacher("mid", "MATH", "MID_CLASS_SPECIALIST", 5, 5),
    teacher("basic", "ENGLISH", "BASIC_CLASS_SPECIALIST", 5, 5),
    teacher("faction", "MATH", "FACTION", 5, 5),
  ];
  const full = academy({
    teachers,
    assignments: { TOP: { KOREAN: "top" }, MID: { MATH: "mid" }, BASIC: { ENGLISH: "basic" } },
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
  const strongBasic = ["KOREAN", "MATH", "ENGLISH", "SCIENCE"].map((subject) =>
    teacher(`basic-${subject}`, subject, "BASIC_CLASS_SPECIALIST", 5, 1),
  );
  const input = academy({
    teachers: strongBasic,
    assignments: {
      BASIC: Object.fromEntries(strongBasic.map(({ subject, id }) => [subject, id])),
    },
    option: "SELF_STUDY",
    pendingEffect: { churn: -0.1 },
  });
  const [result] = scoreTurn(state([input, academy(), academy()]));
  const expectedApplicants = 300 * ((result.reputation + 8) / ((result.reputation + 8) + 26.8 + 26.8)) * 1.2;

  closeTo(result.enrollment, expectedApplicants * (1 - 0.05 * 0.8 * 0.9));
});
