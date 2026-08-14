import assert from "node:assert/strict";
import test from "node:test";

const { selectHeadlines } = await import("./headlines.ts");

const teacher = (id = "target", subject = "MATH", teaching = 5) => ({
  id,
  name: "가상 강사",
  subject,
  teaching,
  fame: 3,
  askingPrice: 20,
  trait: "FACTION",
  blurb: "테스트 카드",
});

const academy = (archetype, over = {}) => ({
  archetype,
  cash: 50,
  reputation: 45,
  applicants: 0,
  enrollment: 100,
  marketShare: 1 / 3,
  teachers: [],
  assignments: {},
  contracts: [],
  option: "NONE",
  lastBidTurn: null,
  pendingEffect: null,
  ...over,
});

const makeState = () => ({
  seed: 1,
  turn: 2,
  playerArchetype: "SELECTIVE",
  academies: [academy("FRANCHISE"), academy("LEGACY"), academy("SELECTIVE")],
  market: [],
  events: [],
  headlineTemplates: [],
  lastResult: { turn: 1, academies: [], headlines: [], topClassScore: 8 },
});

const one = (state, settled, situation, template) => {
  state.headlineTemplates = [{ id: "h_0001", situation, template, weight: 1 }];
  return selectHeadlines(state, settled, undefined, () => 0)[0]?.text;
};

test("bid outcomes bind the won price, teacher, subject, and stealing rival", () => {
  const card = teacher();

  const won = makeState();
  won.academies[2] = academy("SELECTIVE", { teachers: [card], lastBidTurn: 2 });
  won.turnBid = { teacherId: card.id, amount: 22, winner: "SELECTIVE" };
  assert.equal(
    one(won, won.academies, "BID_WON", "{academy}, {teacher} {subject} 낙찰 {n}"),
    "선발형 학원, 가상 강사 수학 낙찰 22",
  );

  const lost = makeState();
  lost.academies[2].lastBidTurn = 2;
  lost.market = [card];
  lost.turnBid = { teacherId: card.id, amount: 21 };
  assert.equal(
    one(lost, lost.academies, "BID_LOST", "{teacher} {subject} 영입 무산"),
    "가상 강사 수학 영입 무산",
  );

  const stolen = makeState();
  stolen.academies[1] = academy("LEGACY", { teachers: [card] });
  stolen.academies[2].lastBidTurn = 2;
  stolen.turnBid = { teacherId: card.id, amount: 21, winner: "LEGACY" };
  assert.equal(
    one(stolen, stolen.academies, "BID_STOLEN", "{rival}, {teacher} {subject} 가로채"),
    "명문형 학원, 가상 강사 수학 가로채",
  );
});

test("settlement comparisons detect score, reputation, and share changes after turn one", () => {
  const surge = makeState();
  const card = teacher();
  surge.academies[2] = academy("SELECTIVE", {
    teachers: [card],
    assignments: { TOP: { MATH: card.id } },
  });
  assert.equal(one(surge, surge.academies, "TOP_CLASS_SURGE", "상위반 성적 급등"), "상위반 성적 급등");

  const reputationUp = makeState();
  const upSettled = reputationUp.academies.map((item) =>
    item.archetype === "SELECTIVE" ? { ...item, reputation: 49 } : item,
  );
  assert.equal(one(reputationUp, upSettled, "REPUTATION_UP", "평판 {n} 상승"), "평판 4 상승");

  const reputationDown = makeState();
  const downSettled = reputationDown.academies.map((item) =>
    item.archetype === "SELECTIVE" ? { ...item, reputation: 41 } : item,
  );
  assert.equal(one(reputationDown, downSettled, "REPUTATION_DOWN", "평판 {n} 하락"), "평판 4 하락");

  const takeover = makeState();
  takeover.academies[0].marketShare = 0.5;
  takeover.academies[1].marketShare = 0.3;
  takeover.academies[2].marketShare = 0.2;
  const takeoverSettled = takeover.academies.map((item) =>
    item.archetype === "SELECTIVE"
      ? { ...item, marketShare: 0.6 }
      : { ...item, marketShare: 0.2 },
  );
  assert.equal(
    one(takeover, takeoverSettled, "SHARE_TAKEOVER", "{rival} 제치고 점유율 {n}%"),
    "확장형 학원 제치고 점유율 60%",
  );

  const lost = makeState();
  lost.academies[0].marketShare = 0.2;
  lost.academies[1].marketShare = 0.2;
  lost.academies[2].marketShare = 0.6;
  const lostSettled = lost.academies.map((item) =>
    item.archetype === "FRANCHISE"
      ? { ...item, marketShare: 0.5 }
      : item.archetype === "SELECTIVE"
        ? { ...item, marketShare: 0.3 }
        : { ...item, marketShare: 0.2 },
  );
  assert.equal(
    one(lost, lostSettled, "SHARE_LOST", "{rival}에 밀려 점유율 {n}%"),
    "확장형 학원에 밀려 점유율 30%",
  );
});

test("TOP_CLASS_SURGE includes an exact 20 percent increase", () => {
  const state = makeState();
  const card = teacher();
  state.lastResult.topClassScore = 8.25;
  state.academies[2] = academy("SELECTIVE", {
    teachers: [card],
    assignments: { TOP: { MATH: card.id } },
  });

  assert.equal(
    one(state, state.academies, "TOP_CLASS_SURGE", "상위반 성적 20% 상승"),
    "상위반 성적 20% 상승",
  );
});

test("TOP_CLASS_SURGE excludes an unchanged zero score", () => {
  const state = makeState();
  state.lastResult.topClassScore = 0;
  state.headlineTemplates = [
    { id: "h_0001", situation: "TOP_CLASS_SURGE", template: "상위반 성적 상승", weight: 1 },
  ];

  assert.deepEqual(selectHeadlines(state, state.academies, undefined, () => 0), []);
});

test("share transitions use reputation, cash, then archetype to break ties", () => {
  const takeover = makeState();
  takeover.academies[0] = academy("FRANCHISE", { marketShare: 0.5, reputation: 50 });
  takeover.academies[1] = academy("LEGACY", { marketShare: 0.3, reputation: 50 });
  takeover.academies[2] = academy("SELECTIVE", { marketShare: 0.2, reputation: 60 });
  const takeoverSettled = takeover.academies.map((item) =>
    item.archetype === "SELECTIVE" ? { ...item, marketShare: 0.5 } : item,
  );
  assert.equal(
    one(takeover, takeoverSettled, "SHARE_TAKEOVER", "{rival} 제치고 점유율 {n}%"),
    "확장형 학원 제치고 점유율 50%",
  );

  const lost = makeState();
  lost.academies[0] = academy("FRANCHISE", { marketShare: 0.5, reputation: 50, cash: 40 });
  lost.academies[1] = academy("LEGACY", { marketShare: 0, reputation: 50, cash: 50 });
  lost.academies[2] = academy("SELECTIVE", { marketShare: 0.5, reputation: 50, cash: 60 });
  const lostSettled = lost.academies.map((item) =>
    item.archetype === "FRANCHISE"
      ? { ...item, marketShare: 0.6 }
      : item.archetype === "SELECTIVE"
        ? { ...item, marketShare: 0.4 }
        : item,
  );
  assert.equal(
    one(lost, lostSettled, "SHARE_LOST", "{rival}에 밀려 점유율 {n}%"),
    "확장형 학원에 밀려 점유율 40%",
  );

  const archetypeTie = makeState();
  archetypeTie.academies[2].marketShare = 0.6;
  const tied = archetypeTie.academies.map((item) => ({
    ...item,
    marketShare: 1 / 3,
    reputation: 50,
    cash: 50,
  }));
  assert.equal(
    one(archetypeTie, tied, "SHARE_LOST", "{rival} 우선순위 승리"),
    "확장형 학원 우선순위 승리",
  );
});

test("operation options detect tuition hikes and scholarships", () => {
  const tuition = makeState();
  tuition.academies[2].option = "TUITION_HIKE";
  assert.equal(one(tuition, tuition.academies, "TUITION_RAISED", "수강료 인상"), "수강료 인상");

  const scholarship = makeState();
  scholarship.academies[2].option = "SCHOLARSHIP";
  assert.equal(
    one(scholarship, scholarship.academies, "SCHOLARSHIP_EXPANDED", "장학금 확대"),
    "장학금 확대",
  );
});

test("turn one suppresses all previous-turn comparison situations", () => {
  const state = makeState();
  state.turn = 1;
  delete state.lastResult;
  state.academies[2].reputation = 10;
  state.academies[2].marketShare = 0;
  state.headlineTemplates = [
    { id: "h_0001", situation: "TOP_CLASS_SURGE", template: "성적", weight: 1 },
    { id: "h_0002", situation: "REPUTATION_UP", template: "평판", weight: 1 },
    { id: "h_0003", situation: "SHARE_TAKEOVER", template: "점유율", weight: 1 },
  ];
  const settled = state.academies.map((item) => ({ ...item, reputation: 100, marketShare: 1 }));

  assert.deepEqual(selectHeadlines(state, settled, undefined, () => 0), []);
});

test("event headline is unchanged and fixed last without consuming headline RNG", () => {
  const state = makeState();
  state.academies[2].cash = 0;
  state.headlineTemplates = [
    { id: "h_0001", situation: "CASH_CRISIS", template: "자금 위기", tone: "BAD", weight: 1 },
    { id: "h_0002", situation: "TOP_CLASS_EMPTY_SLOT", template: "상위반 공석", tone: "BAD", weight: 1 },
    { id: "h_0003", situation: "NO_BID", template: "무입찰", weight: 1 },
  ];
  let calls = 0;
  const event = { id: "e_0001", trigger: { minTurn: 1 }, headline: "원문 이벤트", effect: { cash: 5 }, weight: 1 };

  const headlines = selectHeadlines(state, state.academies, event, () => (calls += 1, 0));

  assert.deepEqual(headlines, [
    { text: "자금 위기", tone: "BAD" },
    { text: "상위반 공석", tone: "BAD" },
    { text: "원문 이벤트", tone: "GOOD" },
  ]);
  assert.equal(calls, 2);
});

test("event effect signs map to GOOD, BAD, and mixed NEUTRAL tones", () => {
  const state = makeState();
  state.academies[2].assignments = {
    TOP: { KOREAN: "k", MATH: "m", ENGLISH: "e", SCIENCE: "s" },
  };
  state.academies[2].lastBidTurn = 2;
  const event = (effect) => ({ id: "e_0001", trigger: { minTurn: 1 }, headline: "이벤트", effect, weight: 1 });
  const tone = (effect) => selectHeadlines(state, state.academies, event(effect), () => 0).at(-1)?.tone;

  assert.equal(tone({ churn: -0.1 }), "GOOD");
  assert.equal(tone({ cash: -1 }), "BAD");
  assert.equal(tone({ cash: 1, churn: 0.1 }), "NEUTRAL");
});
