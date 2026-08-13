import type { ScoreSink } from "./types";

export type { ScoreSink } from "./types";

export const noopScoreSink: ScoreSink = {
  async submit() {},
};
