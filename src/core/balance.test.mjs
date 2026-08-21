import assert from "node:assert/strict";
import test from "node:test";

test("balance constants match the approved settlement rules", async () => {
  const balance = await import("./balance.ts");

  assert.equal(balance.CLASS_TEACHER_LIMIT, 2);
  assert.deepEqual(balance.CLASS_SCORE_MULTIPLIER, { TOP: 3, UPPER_MID: 2, MID: 1.5, BASIC: 1 });
  assert.deepEqual(balance.CLASS_CAPACITY, { TOP: 40, UPPER_MID: 60, MID: 60, BASIC: 40 });
  assert.deepEqual(balance.ARCHETYPE_MODIFIERS, {
    FRANCHISE: { score: 1, applicants: 1.2, previousReputation: 0.85, result: 0.15 },
    LEGACY: { score: 1.2, applicants: 1, previousReputation: 0.9, result: 0.1 },
    SELECTIVE: { score: 1.1, applicants: 1.2, previousReputation: 0.85, result: 0.15 },
  });
  assert.deepEqual(balance.OPERATION_MODIFIERS, {
    SELF_STUDY: { score: 1, reputation: 0, applicants: 1, churn: 0.8, revenue: 1, cost: 8 },
    SCHOLARSHIP: { score: 1, reputation: 0, applicants: 1.3, churn: 1, revenue: 1, cost: 15 },
    NONE: { score: 1, reputation: 0, applicants: 1, churn: 1, revenue: 1, cost: 0 },
  });
  assert.equal(balance.BASE_APPLICANT_POOL, 300);
  assert.equal(balance.EMPTY_SLOT_PENALTY, undefined);
  assert.equal(balance.FAME_INDEX_MULTIPLIER, 2);
  assert.equal(balance.BASE_CHURN_RATE, 0.2);
  assert.equal(balance.MIN_CHURN_RATE, 0.05);
  assert.equal(balance.BASIC_SCORE_CHURN_REDUCTION, 0.005);
  assert.equal(balance.CLASS_SPECIALIST_TEACHING_BONUS, 1);
  assert.equal(balance.BASIC_SPECIALIST_CHURN_REDUCTION, undefined);
  assert.equal(balance.TUITION_PER_STUDENT, 0.5);
  assert.equal(balance.BASE_OPERATING_COST, 20);
  assert.equal(balance.MIN_CLASS_SCORE, 0);
  assert.equal(balance.MIN_REPUTATION, 0);
  assert.equal(balance.CONTRACT_TURNS, 6);
  assert.equal(balance.FRANCHISE_BID_MULTIPLIER, 1.2);
  assert.equal(balance.LEGACY_BID_MULTIPLIER, 1.1);
  assert.equal(balance.LEGACY_BID_CASH_LIMIT, 0.4);
  assert.equal(balance.SELECTIVE_BID_MULTIPLIER, 1.3);
  assert.equal(balance.SELECTIVE_BID_CASH_LIMIT, 0.3);
  assert.equal(balance.EVENT_REPUTATION_LOW, 40);
  assert.equal(balance.EVENT_REPUTATION_HIGH, 60);
  assert.equal(balance.EVENT_CASH_LOW, 20);
});
