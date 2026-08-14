export type Archetype = "FRANCHISE" | "LEGACY" | "SELECTIVE";

export type ClassTier = "TOP" | "MID" | "BASIC";

export type Subject = "KOREAN" | "MATH" | "ENGLISH" | "SCIENCE";

export type Trait =
  | "TOP_CLASS_SPECIALIST"
  | "MID_CLASS_SPECIALIST"
  | "BASIC_CLASS_SPECIALIST"
  | "MEDIA_FIGURE"
  | "PICKY"
  | "FACTION";

export type Contract = { teacherId: string; price: number; remainingTurns: number };

export type OperationOption =
  | "SELF_STUDY"
  | "COUNSELING"
  | "SCHOLARSHIP"
  | "TUITION_HIKE"
  | "NONE";

export type EventEffect = {
  reputation?: number;
  cash?: number;
  churn?: number;
  applicants?: number;
  grade?: number;
};

export interface ScoreSink {
  submit(run: { seed: string; archetype: string; share: number; turns: number }): Promise<void>;
}

export type TeacherCard = {
  id: string;
  name: string;
  subject: Subject;
  teaching: number;
  fame: number;
  askingPrice: number;
  trait: Trait;
  blurb: string;
};

export type EventCard = {
  id: string;
  trigger: {
    minTurn: number;
    maxTurn?: number;
    requires?:
      | "NONE"
      | "REPUTATION_BELOW_40"
      | "REPUTATION_ABOVE_60"
      | "CASH_BELOW_20"
      | "SHARE_LEADER"
      | "SHARE_LAST"
      | "NO_BID_LAST_TURN"
      | "TOP_CLASS_FULL";
  };
  headline: string;
  effect: EventEffect;
  weight: number;
};

export type HeadlineSituation =
  | "BID_WON"
  | "BID_LOST"
  | "BID_STOLEN"
  | "NO_BID"
  | "TOP_CLASS_SURGE"
  | "TOP_CLASS_EMPTY_SLOT"
  | "REPUTATION_UP"
  | "REPUTATION_DOWN"
  | "CASH_CRISIS"
  | "SHARE_TAKEOVER"
  | "SHARE_LOST"
  | "TUITION_RAISED"
  | "SCHOLARSHIP_EXPANDED";

export type HeadlineTone = "NEUTRAL" | "GOOD" | "BAD";

export type Headline = { text: string; tone: HeadlineTone };

export type GameStatus = "PLAYING" | "WON" | "LOST";

export type TurnBid = {
  teacherId: string;
  amount: number;
  winner?: Archetype;
};

export type HeadlineTemplate = {
  id: string;
  situation: HeadlineSituation;
  template: string;
  tone?: HeadlineTone;
  weight: number;
};

export type Academy = {
  archetype: Archetype;
  cash: number;
  reputation: number;
  applicants: number;
  enrollment: number;
  marketShare: number;
  teachers: TeacherCard[];
  assignments: Partial<Record<ClassTier, Partial<Record<Subject, string>>>>;
  contracts: Contract[];
  option: OperationOption;
  lastBidTurn: number | null;
  pendingEffect: EventEffect | null;
};

export type GameState = {
  seed: number;
  turn: number;
  playerArchetype: Archetype;
  academies: Academy[];
  market: TeacherCard[];
  events: EventCard[];
  headlineTemplates: HeadlineTemplate[];
  deck?: TeacherCard[];
  deficitStreak?: number;
  status?: GameStatus;
  winner?: Archetype | null;
  turnBid?: TurnBid;
  lastResult?: TurnResult;
};

export type Action =
  | { type: "BID"; teacherId: string; amount: number }
  | { type: "ASSIGN"; teacherId: string; classTier: ClassTier }
  | { type: "OPTION"; option: OperationOption }
  | { type: "SETTLE" };

export type TurnResult = {
  turn: number;
  academies: Academy[];
  headlines: Headline[];
  topClassScore: number;
  event?: EventCard;
};
