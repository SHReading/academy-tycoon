import { test } from "node:test";
import assert from "node:assert/strict";

import { loadPool, planAssignments, playGame, runBatch } from "./simulate.ts";
import { dealMarket, determineWinner, discountUnsold, syntheticPool } from "./setup.ts";
import { decideAssignments } from "../core/ai.ts";
import { mulberry32 } from "../core/rng.ts";

const pool = () => syntheticPool(mulberry32(1), 60);
const config = { games: 24, seed: 1, cards: 60 };

const academy = (over = {}) => ({
  archetype: "SELECTIVE",
  cash: 50,
  reputation: 45,
  applicants: 0,
  enrollment: 0,
  marketShare: 0,
  teachers: [],
  assignments: {},
  contracts: [],
  option: "NONE",
  lastBidTurn: null,
  pendingEffect: null,
  ...over,
});

const card = (id, subject, teaching, fame = 3, askingPrice = 18) => ({
  id,
  name: id,
  subject,
  teaching,
  fame,
  askingPrice,
  trait: "FACTION",
  blurb: "테스트",
});

test("같은 시드는 같은 결과를 낸다 (02 문서 3절 결정론)", () => {
  const first = runBatch(config);
  const second = runBatch(config);
  assert.deepEqual(first.winRateByStrategy, second.winRateByStrategy);
  assert.deepEqual(first.winRateByArchetype, second.winRateByArchetype);
  assert.deepEqual(first.gameLength, second.gameLength);
  assert.equal(first.bidWinRate, second.bidWinRate);
});

test("D-1 — 판별 시드는 seed + i 이고 리포트에 구간이 남는다", () => {
  const report = runBatch({ ...config, seed: 500 });
  assert.equal(report.seedFrom, 500);
  assert.equal(report.seedTo, 500 + config.games - 1);
});

test("D-3 — NO_BID 는 한 번도 입찰하지 않는다", () => {
  const { pool: cards } = loadPool(60);
  for (const archetype of ["FRANCHISE", "LEGACY", "SELECTIVE"]) {
    const outcome = playGame(7, archetype, "NO_BID", cards, []);
    assert.equal(outcome.bidAttempts, 0, `${archetype} 가 입찰했다`);
    assert.equal(outcome.bidWins, 0);
  }
});

test("D-3 — 나머지 전략은 실제로 입찰한다 (SELECTIVE 포함)", () => {
  const { pool: cards } = loadPool(60);
  for (const archetype of ["FRANCHISE", "LEGACY", "SELECTIVE"]) {
    const outcome = playGame(7, archetype, "BASELINE", cards, []);
    assert.ok(outcome.bidAttempts > 0, `${archetype} 가 한 번도 입찰하지 않았다`);
  }
});

test("D-3 — MID_EXPAND 는 중위반을 먼저 채우고 TOP_HEAVY 는 상위반을 먼저 채운다", () => {
  const teachers = [card("t_1", "KOREAN", 5), card("t_2", "KOREAN", 3), card("t_3", "MATH", 4)];
  const topFirst = planAssignments(academy({ teachers }), ["TOP", "UPPER_MID", "MID", "BASIC"]);
  const midFirst = planAssignments(academy({ teachers }), ["MID", "UPPER_MID", "TOP", "BASIC"]);

  assert.deepEqual(topFirst, { TOP: ["t_1", "t_3"], UPPER_MID: ["t_2"] });
  assert.deepEqual(midFirst, { MID: ["t_1", "t_3"], UPPER_MID: ["t_2"] });
});

test("기본 반 순서로 부른 planAssignments 는 core/ai.ts 의 decideAssignments 와 같아야 한다", () => {
  // 플레이어 전략만 반 순서를 바꾼다. 규칙이 갈라지면 여기서 걸린다.
  const teachers = [
    card("t_1", "KOREAN", 5),
    card("t_2", "KOREAN", 3),
    card("t_3", "MATH", 4),
    card("t_4", "MATH", 4, 5),
    card("t_5", "SCIENCE", 1),
  ];
  const target = academy({ teachers });
  assert.deepEqual(
    planAssignments(target, ["TOP", "UPPER_MID", "MID", "BASIC"]),
    decideAssignments(target),
  );
});

test("I-2·I-4·I-5 — 시장은 4장, 초반엔 강의력 5 제외, 이월은 2장까지", () => {
  const deck = [card("d_1", "KOREAN", 5), card("d_2", "MATH", 3), card("d_3", "ENGLISH", 2), card("d_4", "SCIENCE", 4), card("d_5", "KOREAN", 1)];

  const early = dealMarket(deck, 1, []);
  assert.equal(early.market.length, 4);
  assert.ok(early.market.every((c) => c.teaching <= 4), "1턴에 강의력 5가 나왔다");
  assert.ok(early.deck.some((c) => c.id === "d_1"), "제외한 카드가 덱에 남지 않았다");

  const late = dealMarket(deck, 3, []);
  assert.ok(late.market.some((c) => c.teaching === 5), "3턴부터는 강의력 5가 나와야 한다");

  const carried = dealMarket(deck, 3, [card("u_1", "MATH", 3, 3, 10), card("u_2", "MATH", 3, 3, 12), card("u_3", "MATH", 3, 3, 14)]);
  assert.equal(carried.market.length, 4);
  assert.deepEqual(carried.market.slice(0, 2).map((c) => c.id), ["u_1", "u_2"]);
});

test("I-4 — 유찰가는 10%씩 내려가되 원가의 50% 아래로는 안 간다", () => {
  assert.equal(discountUnsold(card("x", "MATH", 3, 3, 20), 20).askingPrice, 18);
  assert.equal(discountUnsold(card("x", "MATH", 3, 3, 11), 20).askingPrice, 10);
  assert.equal(discountUnsold(card("x", "MATH", 3, 3, 10), 20).askingPrice, 10);
});

test("W-1 — 점유율 동률이면 평판, 그다음 자금 순", () => {
  const tie = (over) => academy({ marketShare: 0.33, ...over });
  assert.equal(
    determineWinner(
      [tie({ archetype: "FRANCHISE", reputation: 50 }), tie({ archetype: "LEGACY", reputation: 70 })],
      new Set(),
    ),
    "LEGACY",
  );
  assert.equal(
    determineWinner(
      [tie({ archetype: "FRANCHISE", reputation: 50, cash: 10 }), tie({ archetype: "LEGACY", reputation: 50, cash: 90 })],
      new Set(),
    ),
    "LEGACY",
  );
});

test("W-1 — 폐원한 학원은 승자 후보에서 빠진다", () => {
  const academies = [
    academy({ archetype: "FRANCHISE", marketShare: 0.9 }),
    academy({ archetype: "LEGACY", marketShare: 0.1 }),
  ];
  assert.equal(determineWinner(academies, new Set(["FRANCHISE"])), "LEGACY");
  assert.equal(determineWinner(academies, new Set(["FRANCHISE", "LEGACY"])), null);
});

test("D-4·D-6 — 승률과 게임 길이가 판수와 맞아떨어진다", () => {
  const report = runBatch(config);
  const played = Object.values(report.gameLength).reduce((sum, count) => sum + count, 0);
  assert.equal(played, config.games);
  assert.ok(Object.keys(report.gameLength).every((turn) => Number(turn) >= 1 && Number(turn) <= 6));
  for (const value of Object.values(report.winRateByStrategy)) {
    assert.ok(value >= 0 && value <= 1);
  }
  assert.ok(report.notes.length > 0, "전제 없이 수치만 내보내면 안 된다");
});

test("합성 강사 풀은 검증기 값 범위 안에 들어온다", () => {
  for (const teacher of pool()) {
    assert.ok(teacher.teaching >= 1 && teacher.teaching <= 5);
    assert.ok(teacher.fame >= 1 && teacher.fame <= 5);
    const base = (teacher.teaching + teacher.fame) * 3;
    assert.ok(
      teacher.askingPrice >= base * 0.7 && teacher.askingPrice <= base * 1.3,
      `${teacher.id} 요구연봉 ${teacher.askingPrice} 가 ±30% 밖`,
    );
  }
});
