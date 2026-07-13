// tests/test-logic.js
// Run with: npm test  (uses Node's built-in test runner, no extra dependency)

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  simulateCrowdDensity,
  getCrowdLevel,
  estimateQueueMinutes,
  findNearestAmenity,
  STADIUM_SECTIONS,
} = require("../js/stadiumData.js");

describe("getCrowdLevel", () => {
  test("classifies low occupancy correctly", () => {
    assert.equal(getCrowdLevel(0.1), "Low");
  });

  test("classifies moderate occupancy correctly", () => {
    assert.equal(getCrowdLevel(0.5), "Moderate");
  });

  test("classifies high occupancy correctly", () => {
    assert.equal(getCrowdLevel(0.85), "High");
  });

  test("handles boundary values consistently", () => {
    assert.equal(getCrowdLevel(0.34), "Low");
    assert.equal(getCrowdLevel(0.35), "Moderate");
    assert.equal(getCrowdLevel(0.69), "Moderate");
    assert.equal(getCrowdLevel(0.7), "High");
  });
});

describe("estimateQueueMinutes", () => {
  test("returns a higher wait during the halftime rush window", () => {
    const rush = estimateQueueMinutes(0.6, 50);
    const normal = estimateQueueMinutes(0.6, 25);
    assert.ok(rush > normal, `expected rush (${rush}) > normal (${normal})`);
  });

  test("returns a higher wait during the pre-kickoff rush window", () => {
    const rush = estimateQueueMinutes(0.6, 5);
    const normal = estimateQueueMinutes(0.6, 25);
    assert.ok(rush > normal);
  });

  test("never returns a negative number", () => {
    assert.ok(estimateQueueMinutes(0, 30) >= 0);
  });

  test("scales with occupancy", () => {
    const low = estimateQueueMinutes(0.1, 30);
    const high = estimateQueueMinutes(0.9, 30);
    assert.ok(high > low);
  });
});

describe("findNearestAmenity", () => {
  test("prefers a same-section match over a same-gate match", () => {
    const result = findNearestAmenity("A1", "restroom", false);
    assert.equal(result.id, "rr-1");
    assert.equal(result.distance, 0);
  });

  test("respects the accessibleOnly filter", () => {
    const result = findNearestAmenity("B1", "restroom", true);
    assert.equal(result.accessible, true);
    assert.notEqual(result.id, "rr-2");
  });

  test("returns null when no amenity of that type exists", () => {
    assert.equal(findNearestAmenity("A1", "nonexistent_type", false), null);
  });
});

describe("simulateCrowdDensity", () => {
  test("returns one entry per stadium section", () => {
    const result = simulateCrowdDensity(30, 42);
    assert.equal(result.length, STADIUM_SECTIONS.length);
  });

  test("always returns occupancy ratios between 0 and 1", () => {
    const result = simulateCrowdDensity(50, 7);
    for (const r of result) {
      assert.ok(r.occupancyRatio >= 0 && r.occupancyRatio <= 1);
    }
  });

  test("is reproducible with the same seed", () => {
    const a = simulateCrowdDensity(30, 99);
    const b = simulateCrowdDensity(30, 99);
    assert.deepEqual(a, b);
  });
});
