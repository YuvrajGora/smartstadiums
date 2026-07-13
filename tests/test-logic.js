// tests/test-logic.js
// Run with: node tests/test-logic.js
// Plain Node assertions -- no framework dependency, keeps repo small and fast to run.

const assert = require("assert");
const {
  simulateCrowdDensity,
  getCrowdLevel,
  estimateQueueMinutes,
  findNearestAmenity,
  STADIUM_SECTIONS,
} = require("../js/stadiumData.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

test("getCrowdLevel classifies low occupancy correctly", () => {
  assert.strictEqual(getCrowdLevel(0.1), "Low");
});

test("getCrowdLevel classifies moderate occupancy correctly", () => {
  assert.strictEqual(getCrowdLevel(0.5), "Moderate");
});

test("getCrowdLevel classifies high occupancy correctly", () => {
  assert.strictEqual(getCrowdLevel(0.85), "High");
});

test("estimateQueueMinutes returns higher wait during halftime rush window", () => {
  const rush = estimateQueueMinutes(0.6, 50); // halftime window
  const normal = estimateQueueMinutes(0.6, 25); // mid first half
  assert.ok(rush > normal, `expected rush (${rush}) > normal (${normal})`);
});

test("estimateQueueMinutes never returns a negative number", () => {
  const result = estimateQueueMinutes(0, 30);
  assert.ok(result >= 0);
});

test("findNearestAmenity prefers same-section match over same-gate match", () => {
  const result = findNearestAmenity("A1", "restroom", false);
  assert.strictEqual(result.id, "rr-1");
  assert.strictEqual(result.distance, 0);
});

test("findNearestAmenity respects accessibleOnly filter", () => {
  const result = findNearestAmenity("B1", "restroom", true);
  // rr-2 (near B1) is NOT accessible, so it must fall back to a different accessible restroom
  assert.ok(result.accessible === true);
  assert.notStrictEqual(result.id, "rr-2");
});

test("findNearestAmenity returns null when no amenity of that type exists", () => {
  const result = findNearestAmenity("A1", "nonexistent_type", false);
  assert.strictEqual(result, null);
});

test("simulateCrowdDensity returns one entry per stadium section", () => {
  const result = simulateCrowdDensity(30, 42);
  assert.strictEqual(result.length, STADIUM_SECTIONS.length);
});

test("simulateCrowdDensity always returns occupancy ratios between 0 and 1", () => {
  const result = simulateCrowdDensity(50, 7);
  result.forEach((r) => {
    assert.ok(r.occupancyRatio >= 0 && r.occupancyRatio <= 1);
  });
});

test("simulateCrowdDensity is reproducible with the same seed", () => {
  const a = simulateCrowdDensity(30, 99);
  const b = simulateCrowdDensity(30, 99);
  assert.deepStrictEqual(a, b);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
