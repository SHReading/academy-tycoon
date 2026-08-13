import assert from "node:assert/strict";
import test from "node:test";

const { mulberry32 } = await import("./rng.ts");

test("mulberry32 returns the same sequence for the same seed", () => {
  assert.equal(typeof mulberry32, "function");

  const expected = [
    0.6270739405881613,
    0.002735721180215478,
    0.5274470399599522,
    0.9810509674716741,
    0.9683778982143849,
  ];

  assert.deepEqual(Array.from({ length: 5 }, mulberry32(1)), expected);
  assert.deepEqual(Array.from({ length: 5 }, mulberry32(1)), expected);
});
