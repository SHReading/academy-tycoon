import assert from "node:assert/strict";
import test from "node:test";

const { noopScoreSink } = await import("./telemetry.ts");

test("noopScoreSink accepts a completed run without transmitting", async () => {
  const result = await noopScoreSink.submit({
    seed: "1",
    archetype: "SELECTIVE",
    share: 0.5,
    turns: 6,
  });

  assert.equal(result, undefined);
});
