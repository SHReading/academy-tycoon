import {
  ARCHETYPE_MODIFIERS,
  BASE_APPLICANT_POOL,
  BASE_CHURN_RATE,
  BASE_OPERATING_COST,
  BASIC_SCORE_CHURN_REDUCTION,
  CLASS_CAPACITY,
  CLASS_SCORE_MULTIPLIER,
  CLASS_SPECIALIST_TEACHING_BONUS,
  CLASS_TEACHER_LIMIT,
  FACTION_TEACHING_BONUS,
  FAME_INDEX_MULTIPLIER,
  MEDIA_FIGURE_FAME_BONUS,
  MEDIA_FIGURE_TEACHING_PENALTY,
  MIN_CHURN_RATE,
  MIN_CLASS_SCORE,
  MIN_REPUTATION,
  OPERATION_MODIFIERS,
  TOTAL_CAPACITY,
  TUITION_PER_STUDENT,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "./balance.ts";
import type { Academy, ClassTier, GameState, TeacherCard } from "./types";

const assignedTeachers = (academy: Academy, tier: ClassTier): TeacherCard[] =>
  (academy.assignments[tier] ?? [])
    .slice(0, CLASS_TEACHER_LIMIT)
    .map((id) => academy.teachers.find((teacher) => teacher.id === id))
    .filter((teacher): teacher is TeacherCard => teacher !== undefined);

const teaching = (teacher: TeacherCard, classmates: TeacherCard[]): number =>
  teacher.teaching -
  (teacher.trait === "MEDIA_FIGURE" ? MEDIA_FIGURE_TEACHING_PENALTY : 0) +
  (teacher.trait === "CLASS_SPECIALIST" ? CLASS_SPECIALIST_TEACHING_BONUS : 0) +
  (teacher.trait === "FACTION" &&
  classmates.some((classmate) => classmate.id !== teacher.id)
    ? FACTION_TEACHING_BONUS
    : 0);

export function scoreClass(academy: Academy, tier: ClassTier): number {
  const teachers = assignedTeachers(academy, tier);
  const raw = teachers.reduce((sum, teacher) => sum + teaching(teacher, teachers), 0) *
    CLASS_SCORE_MULTIPLIER[tier];
  const archetype = tier === "TOP" ? ARCHETYPE_MODIFIERS[academy.archetype].score : 1;
  return Math.max(
    MIN_CLASS_SCORE,
    raw * archetype * OPERATION_MODIFIERS[academy.option].score * (1 + (academy.pendingEffect?.grade ?? 0)),
  );
}

export const allocateEnrollment = (enrollment: number): Record<ClassTier, number> => ({
  TOP: Math.min(
    Math.round((enrollment * CLASS_CAPACITY.TOP) / TOTAL_CAPACITY),
    CLASS_CAPACITY.TOP,
  ),
  UPPER_MID: Math.min(
    Math.round((enrollment * CLASS_CAPACITY.UPPER_MID) / TOTAL_CAPACITY),
    CLASS_CAPACITY.UPPER_MID,
  ),
  MID: Math.min(
    Math.round((enrollment * CLASS_CAPACITY.MID) / TOTAL_CAPACITY),
    CLASS_CAPACITY.MID,
  ),
  BASIC: Math.min(
    Math.round((enrollment * CLASS_CAPACITY.BASIC) / TOTAL_CAPACITY),
    CLASS_CAPACITY.BASIC,
  ),
});

export function scoreTurn(state: GameState): Academy[] {
  // ① 반별 성적
  const scores = state.academies.map((academy) => ({
    TOP: scoreClass(academy, "TOP"),
    UPPER_MID: scoreClass(academy, "UPPER_MID"),
    MID: scoreClass(academy, "MID"),
    BASIC: scoreClass(academy, "BASIC"),
  }));

  // ② 입시 실적
  const results = state.academies.map((academy, index) => {
    const enrollment = allocateEnrollment(academy.enrollment);
    return scores[index].TOP * Math.min(1, enrollment.TOP / CLASS_CAPACITY.TOP);
  });

  // ③ 평판
  const reputations = state.academies.map((academy, index) => {
    const modifier = ARCHETYPE_MODIFIERS[academy.archetype];
    return Math.max(
      MIN_REPUTATION,
      academy.reputation * modifier.previousReputation +
        results[index] * modifier.result +
        OPERATION_MODIFIERS[academy.option].reputation +
        (academy.pendingEffect?.reputation ?? 0),
    );
  });

  // ④ 지원자
  const indexes = state.academies.map((academy, index) => {
    const fame = academy.teachers.reduce(
      (sum, teacher) => sum + teacher.fame + (teacher.trait === "MEDIA_FIGURE" ? MEDIA_FIGURE_FAME_BONUS : 0),
      0,
    );
    return reputations[index] + fame * FAME_INDEX_MULTIPLIER;
  });
  const indexTotal = indexes.reduce((sum, value) => sum + value, 0);
  const applicants = state.academies.map(
    (academy, index) =>
      BASE_APPLICANT_POOL *
      (indexes[index] / indexTotal) *
      ARCHETYPE_MODIFIERS[academy.archetype].applicants *
      OPERATION_MODIFIERS[academy.option].applicants *
      (1 + (academy.pendingEffect?.applicants ?? 0)),
  );

  // ⑤ 이탈률과 등록 인원
  const enrollments = state.academies.map((academy, index) => {
    const baseChurn = Math.max(
      MIN_CHURN_RATE,
      BASE_CHURN_RATE - scores[index].BASIC * BASIC_SCORE_CHURN_REDUCTION,
    );
    const churn =
      baseChurn *
      OPERATION_MODIFIERS[academy.option].churn *
      (1 + (academy.pendingEffect?.churn ?? 0));
    return Math.min(applicants[index] * (1 - churn), TOTAL_CAPACITY);
  });

  // ⑥ 자금
  const settled = state.academies.map((academy, index) => {
    const contractCost = academy.contracts
      .filter((contract) => contract.remainingTurns > 0)
      .reduce((sum, contract) => sum + contract.price, 0);
    const contracts = academy.contracts
      .map((contract) => ({ ...contract, remainingTurns: contract.remainingTurns - 1 }))
      .filter((contract) => contract.remainingTurns > 0);
    const option = OPERATION_MODIFIERS[academy.option];
    const cash =
      academy.cash +
      enrollments[index] * TUITION_PER_STUDENT * option.revenue -
      contractCost -
      option.cost -
      BASE_OPERATING_COST +
      (academy.pendingEffect?.cash ?? 0);
    return {
      ...academy,
      cash,
      reputation: reputations[index],
      applicants: applicants[index],
      enrollment: enrollments[index],
      contracts,
      pendingEffect: null,
    };
  });

  // ⑦ 점유율
  const enrollmentTotal = enrollments.reduce((sum, value) => sum + value, 0);
  return settled.map((academy, index) => ({
    ...academy,
    marketShare: enrollments[index] / enrollmentTotal,
  }));
}
