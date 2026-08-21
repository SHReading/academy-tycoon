import assert from "node:assert/strict";
import test from "node:test";

import { mulberry32 } from "./rng.ts";
import { playGame } from "../harness/simulate.ts";
import { createInitialState, syntheticPool } from "../harness/setup.ts";

const pool = () => syntheticPool(mulberry32(1), 60);

test("초기 상태에서 BID→ASSIGN→OPTION→SETTLE을 6턴 완주하고 점유율 1위를 승자로 판정한다", () => {
  const cards = pool();
  const { state } = createInitialState("FRANCHISE", 1, cards, [], mulberry32(1));
  const teachingTotals = state.academies.map((academy) =>
    academy.teachers.reduce((sum, teacher) => sum + teacher.teaching, 0),
  );

  assert.ok(state.academies.every((academy) => academy.teachers.length === 2));
  assert.equal(new Set(teachingTotals).size, 1);

  const outcome = playGame(1, "FRANCHISE", "BASELINE", cards, []);
  assert.equal(outcome.turns, 6);
  assert.equal(outcome.bankrupt, false);
  assert.equal(outcome.won, true);
});

test("자금이 0 미만인 상태가 2턴 연속이면 6턴 전에 폐원하고 패배한다", () => {
  const outcome = playGame(204, "FRANCHISE", "BASELINE", pool(), []);

  assert.equal(outcome.turns, 5);
  assert.equal(outcome.bankrupt, true);
  assert.equal(outcome.won, false);
});
