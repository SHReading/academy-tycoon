import {
  BASE_OPERATING_COST,
  FRANCHISE_BID_MULTIPLIER,
  LEGACY_BID_CASH_LIMIT,
  LEGACY_BID_MULTIPLIER,
  CLASS_TEACHER_LIMIT,
  SELECTIVE_BID_CASH_LIMIT,
  SELECTIVE_BID_MULTIPLIER,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "./balance.ts";
import type { Academy, OperationOption, TeacherCard } from "./types";

const activeContractCost = (academy: Academy): number =>
  academy.contracts
    .filter((contract) => contract.remainingTurns > 0)
    .reduce((sum, contract) => sum + contract.price, 0);

export function decideBid(academy: Academy, market: TeacherCard[]) {
  const metric = (teacher: TeacherCard): number => {
    if (academy.archetype === "FRANCHISE") return teacher.fame;
    if (academy.archetype === "LEGACY") return teacher.teaching;
    return teacher.teaching + teacher.fame;
  };
  const multiplier =
    academy.archetype === "FRANCHISE"
      ? FRANCHISE_BID_MULTIPLIER
      : academy.archetype === "LEGACY"
        ? LEGACY_BID_MULTIPLIER
        : SELECTIVE_BID_MULTIPLIER;
  const cashLimit =
    academy.archetype === "LEGACY"
      ? academy.cash * LEGACY_BID_CASH_LIMIT
      : academy.archetype === "SELECTIVE"
        ? academy.cash * SELECTIVE_BID_CASH_LIMIT
        : Infinity;
  const limit = Math.min(
    academy.cash - activeContractCost(academy) - BASE_OPERATING_COST,
    cashLimit,
  );
  const teacher = [...market]
    .sort(
      (left, right) => metric(right) - metric(left) || left.askingPrice - right.askingPrice,
    )
    .find((card) => Math.ceil(card.askingPrice * multiplier) <= limit);

  return teacher
    ? { teacherId: teacher.id, amount: Math.ceil(teacher.askingPrice * multiplier) }
    : undefined;
}

export function decideAssignments(academy: Academy): Academy["assignments"] {
  const assignments: Academy["assignments"] = {};
  const teachers = [...academy.teachers].sort(
    (left, right) =>
      right.teaching - left.teaching ||
      right.fame - left.fame ||
      left.id.localeCompare(right.id),
  );

  for (const teacher of teachers) {
    const tier = (["TOP", "UPPER_MID", "MID", "BASIC"] as const).find(
      (candidate) => (assignments[candidate]?.length ?? 0) < CLASS_TEACHER_LIMIT,
    );
    if (!tier) continue;
    assignments[tier] = [...(assignments[tier] ?? []), teacher.id];
  }

  return assignments;
}

export function decideOption(academy: Academy): OperationOption {
  if (academy.cash - activeContractCost(academy) - BASE_OPERATING_COST < 0) {
    return "NONE";
  }
  if (academy.archetype === "FRANCHISE") return "SCHOLARSHIP";
  return academy.archetype === "SELECTIVE" ? "SELF_STUDY" : "NONE";
}
