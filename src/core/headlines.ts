// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { SUBJECT_SLOT_COUNT } from "./balance.ts";
// @ts-expect-error Node runs source tests directly and requires the .ts extension.
import { scoreClass } from "./scoring.ts";
import type {
  Academy,
  Archetype,
  EventCard,
  GameState,
  Headline,
  HeadlineSituation,
  HeadlineTemplate,
  Subject,
} from "./types";

const ACADEMY_NAMES: Record<Archetype, string> = {
  FRANCHISE: "확장형 학원",
  LEGACY: "명문형 학원",
  SELECTIVE: "선발형 학원",
};

const SUBJECTS: Subject[] = ["KOREAN", "MATH", "ENGLISH", "SCIENCE"];
const SUBJECT_NAMES: Record<Subject, string> = {
  KOREAN: "국어",
  MATH: "수학",
  ENGLISH: "영어",
  SCIENCE: "탐구",
};

type Detected = { situation: HeadlineSituation; values: Record<string, string | number> };

const PRIORITY: HeadlineSituation[] = [
  "BID_STOLEN",
  "BID_WON",
  "SHARE_TAKEOVER",
  "SHARE_LOST",
  "CASH_CRISIS",
  "TOP_CLASS_SURGE",
  "REPUTATION_DOWN",
  "REPUTATION_UP",
  "TOP_CLASS_EMPTY_SLOT",
  "TUITION_RAISED",
  "SCHOLARSHIP_EXPANDED",
  "BID_LOST",
  "NO_BID",
];

const draw = (templates: HeadlineTemplate[], random: () => number): HeadlineTemplate => {
  let cursor = random() * templates.reduce((sum, template) => sum + template.weight, 0);
  return templates.find((template) => (cursor -= template.weight) < 0) as HeadlineTemplate;
};

const bind = (template: string, values: Detected["values"]): string =>
  template.replace(/\{(academy|rival|teacher|subject|n)\}/g, (match, name: string) =>
    values[name] === undefined ? match : String(values[name]),
  );

const leader = (academies: Academy[]): Academy | undefined =>
  [...academies].sort((left, right) => right.marketShare - left.marketShare)[0];

const eventTone = (event: EventCard): Headline["tone"] => {
  const signs = Object.entries(event.effect)
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => Math.sign((key === "churn" ? -1 : 1) * (value ?? 0)));
  if (signs.length && signs.every((sign) => sign > 0)) return "GOOD";
  if (signs.length && signs.every((sign) => sign < 0)) return "BAD";
  return "NEUTRAL";
};

export function selectHeadlines(
  state: GameState,
  settled: Academy[],
  event: EventCard | undefined,
  random: () => number,
): Headline[] {
  const before = state.academies.find((academy) => academy.archetype === state.playerArchetype);
  const after = settled.find((academy) => academy.archetype === state.playerArchetype);
  if (!before || !after) return [];

  const academy = ACADEMY_NAMES[state.playerArchetype];
  const emptySubjects = SUBJECTS.filter((subject) => before.assignments.TOP?.[subject] === undefined);
  const detected: Detected[] = [];
  const bidTeacher = state.turnBid
    ? [...state.market, ...state.academies.flatMap((item) => item.teachers)].find(
        (item) => item.id === state.turnBid?.teacherId,
      )
    : undefined;
  const bidValues = {
    academy,
    teacher: bidTeacher?.name ?? "",
    subject: bidTeacher ? SUBJECT_NAMES[bidTeacher.subject] : "",
  };
  if (state.turnBid?.winner && state.turnBid.winner !== state.playerArchetype) {
    detected.push({
      situation: "BID_STOLEN",
      values: { ...bidValues, rival: ACADEMY_NAMES[state.turnBid.winner] },
    });
  }
  if (state.turnBid?.winner === state.playerArchetype) {
    detected.push({ situation: "BID_WON", values: { ...bidValues, n: state.turnBid.amount } });
  } else if (state.turnBid) {
    detected.push({ situation: "BID_LOST", values: bidValues });
  } else if (before.lastBidTurn !== state.turn) {
    detected.push({ situation: "NO_BID", values: { academy } });
  }

  if (state.lastResult) {
    const currentTopScore = scoreClass(before, "TOP");
    if (currentTopScore > state.lastResult.topClassScore * 1.2) {
      detected.push({ situation: "TOP_CLASS_SURGE", values: { academy } });
    }
    const reputationChange = after.reputation - before.reputation;
    if (reputationChange >= 3) {
      detected.push({
        situation: "REPUTATION_UP",
        values: { academy, n: Math.round(Math.abs(reputationChange)) },
      });
    } else if (reputationChange <= -3) {
      detected.push({
        situation: "REPUTATION_DOWN",
        values: { academy, n: Math.round(Math.abs(reputationChange)) },
      });
    }
    const previousLeader = leader(state.academies);
    const currentLeader = leader(settled);
    if (previousLeader && previousLeader.archetype !== state.playerArchetype && currentLeader?.archetype === state.playerArchetype) {
      detected.push({
        situation: "SHARE_TAKEOVER",
        values: {
          academy,
          rival: ACADEMY_NAMES[previousLeader.archetype],
          n: Math.round(after.marketShare * 100),
        },
      });
    } else if (previousLeader?.archetype === state.playerArchetype && currentLeader?.archetype !== state.playerArchetype) {
      detected.push({
        situation: "SHARE_LOST",
        values: {
          academy,
          rival: currentLeader ? ACADEMY_NAMES[currentLeader.archetype] : "",
          n: Math.round(after.marketShare * 100),
        },
      });
    }
  }
  if (after.cash < 20) {
    detected.push({ situation: "CASH_CRISIS", values: { academy, n: Math.round(after.cash) } });
  }
  if (emptySubjects.length) {
    detected.push({
      situation: "TOP_CLASS_EMPTY_SLOT",
      values: {
        academy,
        subject: SUBJECT_NAMES[emptySubjects[0]],
        n: SUBJECT_SLOT_COUNT - Object.keys(before.assignments.TOP ?? {}).length,
      },
    });
  }
  if (before.option === "TUITION_HIKE") {
    detected.push({ situation: "TUITION_RAISED", values: { academy } });
  } else if (before.option === "SCHOLARSHIP") {
    detected.push({ situation: "SCHOLARSHIP_EXPANDED", values: { academy } });
  }
  detected.sort((left, right) => PRIORITY.indexOf(left.situation) - PRIORITY.indexOf(right.situation));

  const headlines: Headline[] = [];
  const slots = event ? 2 : 3;
  for (const item of detected) {
    const templates = state.headlineTemplates.filter(
      (template) => template.situation === item.situation,
    );
    if (!templates.length) continue;
    const template = draw(templates, random);
    headlines.push({ text: bind(template.template, item.values), tone: template.tone ?? "NEUTRAL" });
    if (headlines.length === slots) break;
  }
  if (event) headlines.push({ text: event.headline, tone: eventTone(event) });
  return headlines;
}
