export const TOTAL_TURNS = 6;
export const MARKET_SIZE = 4;
export const CONTRACT_TURNS = 6;
export const UNSOLD_PRICE_MULTIPLIER = 0.9;
export const EARLY_MARKET_TURNS = 2;
export const MAX_EARLY_TEACHING = 4;
export const STARTING_TEACHERS = 2;
export const MAX_CARRIED_TEACHERS = 2;
export const MIN_ASKING_PRICE_RATIO = 0.5;

export const CLASS_TEACHER_LIMIT = 2;
export const CLASS_SCORE_MULTIPLIER = { TOP: 3, UPPER_MID: 2, MID: 1.5, BASIC: 1 } as const;
export const CLASS_CAPACITY = { TOP: 40, UPPER_MID: 60, MID: 60, BASIC: 40 } as const;
export const TOTAL_CAPACITY = 200;

export const STARTING_ACADEMY = {
  FRANCHISE: { cash: 100, reputation: 40 },
  LEGACY: { cash: 70, reputation: 60 },
  SELECTIVE: { cash: 50, reputation: 45 },
} as const;

export const ARCHETYPE_MODIFIERS = {
  FRANCHISE: { score: 1, applicants: 1.2, previousReputation: 0.7, result: 0.3 },
  LEGACY: { score: 1.2, applicants: 1, previousReputation: 0.8, result: 0.2 },
  SELECTIVE: { score: 1.1, applicants: 1.2, previousReputation: 0.7, result: 0.3 },
} as const;

export const OPERATION_MODIFIERS = {
  SELF_STUDY: { score: 1, reputation: 0, applicants: 1, churn: 0.8, revenue: 1, cost: 8 },
  SCHOLARSHIP: { score: 1, reputation: 0, applicants: 1.3, churn: 1, revenue: 1, cost: 15 },
  NONE: { score: 1, reputation: 0, applicants: 1, churn: 1, revenue: 1, cost: 0 },
} as const;

export const BASE_APPLICANT_POOL = 300;
export const FAME_INDEX_MULTIPLIER = 2;
export const BASE_CHURN_RATE = 0.2;
export const MIN_CHURN_RATE = 0.05;
export const BASIC_SCORE_CHURN_REDUCTION = 0.005;
export const TUITION_PER_STUDENT = 0.5;
export const BASE_OPERATING_COST = 20;
export const MIN_CLASS_SCORE = 0;
export const MIN_REPUTATION = 0;

export const CLASS_SPECIALIST_TEACHING_BONUS = 1;
export const MEDIA_FIGURE_TEACHING_PENALTY = 1;
export const MEDIA_FIGURE_FAME_BONUS = 2;
export const FACTION_TEACHING_BONUS = 1;

export const FRANCHISE_BID_MULTIPLIER = 1.2;
export const LEGACY_BID_MULTIPLIER = 1.1;
export const LEGACY_BID_CASH_LIMIT = 0.4;
export const SELECTIVE_BID_MULTIPLIER = 1.3;
export const SELECTIVE_BID_CASH_LIMIT = 0.3;

export const EVENT_REPUTATION_LOW = 40;
export const EVENT_REPUTATION_HIGH = 60;
export const EVENT_CASH_LOW = 20;
