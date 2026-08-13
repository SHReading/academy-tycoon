import {
  EVENT_CASH_LOW,
  EVENT_REPUTATION_HIGH,
  EVENT_REPUTATION_LOW,
  SUBJECT_SLOT_COUNT,
  // @ts-expect-error Node runs source tests directly and requires the .ts extension.
} from "./balance.ts";
import type { Academy, EventCard, GameState } from "./types";

export function isEventEligible(
  event: EventCard,
  state: GameState,
  settled: Academy[],
): boolean {
  if (event.trigger.minTurn > state.turn || (event.trigger.maxTurn ?? Infinity) < state.turn) {
    return false;
  }
  const player = settled.find((academy) => academy.archetype === state.playerArchetype);
  if (!player) return false;
  const previousPlayer = state.academies.find(
    (academy) => academy.archetype === state.playerArchetype,
  );

  switch (event.trigger.requires ?? "NONE") {
    case "NONE": return true;
    case "REPUTATION_BELOW_40": return player.reputation < EVENT_REPUTATION_LOW;
    case "REPUTATION_ABOVE_60": return player.reputation > EVENT_REPUTATION_HIGH;
    case "CASH_BELOW_20": return player.cash < EVENT_CASH_LOW;
    case "SHARE_LEADER":
      return player.marketShare === Math.max(...settled.map((academy) => academy.marketShare));
    case "SHARE_LAST": {
      const active = settled.filter((academy) => {
        const previous = state.academies.find(
          (candidate) => candidate.archetype === academy.archetype,
        );
        return !(previous && previous.cash < 0 && academy.cash < 0);
      });
      return active.includes(player) &&
        player.marketShare === Math.min(...active.map((academy) => academy.marketShare));
    }
    case "NO_BID_LAST_TURN": return previousPlayer?.lastBidTurn !== state.turn;
    case "TOP_CLASS_FULL":
      return Object.keys(player.assignments.TOP ?? {}).length === SUBJECT_SLOT_COUNT;
  }
}
