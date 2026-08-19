import type {
  Action,
  Academy,
  Archetype,
  ClassTier,
  Contract,
  EventCard,
  EventEffect,
  GameState,
  HeadlineTemplate,
  OperationOption,
  ScoreSink,
  Subject,
  TeacherCard,
  Trait,
  TurnResult,
} from "./types";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type Assert<T extends true> = T;

type _TeacherCard = Assert<
  Equal<
    TeacherCard,
    {
      id: string;
      name: string;
      subject: Subject;
      teaching: number;
      fame: number;
      askingPrice: number;
      trait: Trait;
      blurb: string;
    }
  >
>;

type _EventCard = Assert<
  Equal<
    EventCard,
    {
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
      effect: {
        reputation?: number;
        cash?: number;
        churn?: number;
        applicants?: number;
        grade?: number;
      };
      weight: number;
    }
  >
>;

type _HeadlineTemplate = Assert<
  Equal<
    HeadlineTemplate,
    {
      id: string;
      situation:
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
      template: string;
      tone?: "NEUTRAL" | "GOOD" | "BAD";
      weight: number;
    }
  >
>;

type _Subject = Assert<Equal<Subject, "KOREAN" | "MATH" | "ENGLISH" | "SCIENCE">>;
type _Trait = Assert<
  Equal<Trait, "CLASS_SPECIALIST" | "MEDIA_FIGURE" | "FACTION">
>;
type _Archetype = Assert<Equal<Archetype, "FRANCHISE" | "LEGACY" | "SELECTIVE">>;
type _ClassTier = Assert<Equal<ClassTier, "TOP" | "UPPER_MID" | "MID" | "BASIC">>;
type _Contract = Assert<
  Equal<Contract, { teacherId: string; price: number; remainingTurns: number }>
>;
type _OperationOption = Assert<
  Equal<OperationOption, "SELF_STUDY" | "SCHOLARSHIP" | "NONE">
>;
type _EventEffect = Assert<Equal<EventEffect, EventCard["effect"]>>;
type _ScoreSink = Assert<
  Equal<
    Parameters<ScoreSink["submit"]>[0],
    { seed: string; archetype: string; share: number; turns: number }
  >
>;
type _Academy = Assert<
  Equal<
    Academy,
    {
      archetype: Archetype;
      cash: number;
      reputation: number;
      applicants: number;
      enrollment: number;
      marketShare: number;
      teachers: TeacherCard[];
      assignments: Partial<Record<ClassTier, string[]>>;
      contracts: Contract[];
      option: OperationOption;
      lastBidTurn: number | null;
      pendingEffect: EventEffect | null;
    }
  >
>;
type _Action = Assert<
  Equal<
    Action,
    | { type: "BID"; teacherId: string; amount: number }
      | { type: "ASSIGN"; teacherId: string; classTier: ClassTier }
      | { type: "OPTION"; option: OperationOption }
      | { type: "SETTLE" }
  >
>;

type _RequiredTypesExist = [GameState, Academy, TurnResult];
