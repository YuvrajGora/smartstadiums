// stadiumData.js
// Mock data representing a FIFA World Cup 2026 host stadium.
// In a real deployment this would come from a stadium IoT / ticketing API.
// Kept as static + simulated data here so the project stays lightweight (<10MB repo).

const STADIUM_SECTIONS = [
  { id: "A1", gate: "Gate 1", zone: "North Lower", capacity: 4000 },
  { id: "A2", gate: "Gate 1", zone: "North Upper", capacity: 3500 },
  { id: "B1", gate: "Gate 2", zone: "East Lower", capacity: 4200 },
  { id: "B2", gate: "Gate 2", zone: "East Upper", capacity: 3600 },
  { id: "C1", gate: "Gate 3", zone: "South Lower", capacity: 4000 },
  { id: "C2", gate: "Gate 3", zone: "South Upper", capacity: 3500 },
  { id: "D1", gate: "Gate 4", zone: "West Lower", capacity: 4500 },
  { id: "D2", gate: "Gate 4", zone: "West Upper", capacity: 3700 },
];

const AMENITIES = [
  { id: "rr-1", type: "restroom", nearSection: "A1", accessible: true },
  { id: "rr-2", type: "restroom", nearSection: "B1", accessible: false },
  { id: "rr-3", type: "restroom", nearSection: "C2", accessible: true },
  { id: "rr-4", type: "restroom", nearSection: "D1", accessible: true },
  { id: "med-1", type: "medical", nearSection: "A2", accessible: true },
  { id: "med-2", type: "medical", nearSection: "C1", accessible: true },
  { id: "food-1", type: "food", nearSection: "A1", accessible: true, name: "North Grill" },
  { id: "food-2", type: "food", nearSection: "B2", accessible: false, name: "East Snacks" },
  { id: "food-3", type: "food", nearSection: "C1", accessible: true, name: "South Deli" },
  { id: "food-4", type: "food", nearSection: "D2", accessible: true, name: "West Fan Kitchen" },
  { id: "prayer-1", type: "prayer_room", nearSection: "B1", accessible: true },
  { id: "transit-1", type: "transit_stop", nearSection: "D1", accessible: true, name: "Metro Gate 4" },
];

// Simple deterministic pseudo-random generator so demo runs are reproducible
function seededRandom(seed) {
  let value = seed;
  return function () {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

/**
 * Simulates live crowd occupancy for every section based on match minute.
 * Occupancy naturally rises before kickoff and at halftime (concession rushes),
 * and dips during active play.
 * @param {number} matchMinute - 0 to 90+
 * @param {number} seed - controls per-section variation
 * @returns {Array<{id, zone, occupancyRatio}>}
 */
function simulateCrowdDensity(matchMinute, seed = Date.now()) {
  const rand = seededRandom(seed);
  const isRushWindow = matchMinute < 10 || (matchMinute >= 44 && matchMinute <= 60);
  return STADIUM_SECTIONS.map((section) => {
    const base = isRushWindow ? 0.55 : 0.2;
    const variation = rand() * 0.4;
    const occupancyRatio = Math.min(0.98, base + variation);
    return {
      id: section.id,
      zone: section.zone,
      gate: section.gate,
      occupancyRatio: Number(occupancyRatio.toFixed(2)),
    };
  });
}

/**
 * Converts a raw occupancy ratio into a human-facing crowd level label.
 * Pure function -> easy to unit test.
 */
function getCrowdLevel(occupancyRatio) {
  if (occupancyRatio < 0.35) return "Low";
  if (occupancyRatio < 0.7) return "Moderate";
  return "High";
}

/**
 * Estimates concession/restroom queue wait time (minutes) from occupancy and match minute.
 * Pure function -> easy to unit test.
 */
function estimateQueueMinutes(occupancyRatio, matchMinute) {
  const isRushWindow = matchMinute < 10 || (matchMinute >= 44 && matchMinute <= 60);
  const base = occupancyRatio * 12;
  const rushPenalty = isRushWindow ? 5 : 0;
  return Math.round(base + rushPenalty);
}

/**
 * Finds the nearest amenity of a given type to a section, optionally
 * restricted to accessible-only options.
 * Pure function -> easy to unit test.
 */
function findNearestAmenity(sectionId, type, accessibleOnly = false) {
  const candidates = AMENITIES.filter(
    (a) => a.type === type && (!accessibleOnly || a.accessible)
  );
  if (candidates.length === 0) return null;

  // "Distance" here is modeled simply: same section = 0, same gate = 1, else 2.
  const targetSection = STADIUM_SECTIONS.find((s) => s.id === sectionId);
  const scored = candidates.map((a) => {
    const aSection = STADIUM_SECTIONS.find((s) => s.id === a.nearSection);
    let distance = 2;
    if (a.nearSection === sectionId) distance = 0;
    else if (targetSection && aSection && aSection.gate === targetSection.gate) distance = 1;
    return { ...a, distance };
  });

  scored.sort((x, y) => x.distance - y.distance);
  return scored[0];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STADIUM_SECTIONS,
    AMENITIES,
    simulateCrowdDensity,
    getCrowdLevel,
    estimateQueueMinutes,
    findNearestAmenity,
  };
}
