// tests/test-validation.js
// Run with: node tests/test-validation.js
// Covers the API layer's input validation and rate limiter - previously untested.

const assert = require("assert");
const {
  validateChatRequest,
  sanitizeLanguage,
  sanitizeRole,
  RateLimiter,
  MAX_MESSAGE_LENGTH,
} = require("../api/validation.js");

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

test("validateChatRequest rejects missing message", () => {
  const result = validateChatRequest({});
  assert.strictEqual(result.status, 400);
});

test("validateChatRequest rejects empty/whitespace message", () => {
  const result = validateChatRequest({ message: "   " });
  assert.strictEqual(result.status, 400);
});

test("validateChatRequest rejects an oversized message", () => {
  const longMessage = "a".repeat(MAX_MESSAGE_LENGTH + 1);
  const result = validateChatRequest({ message: longMessage });
  assert.strictEqual(result.status, 400);
});

test("validateChatRequest rejects an oversized context payload", () => {
  const result = validateChatRequest({
    message: "hello",
    contextSummary: "a".repeat(5000),
  });
  assert.strictEqual(result.status, 400);
});

test("validateChatRequest accepts a normal request", () => {
  const result = validateChatRequest({ message: "Where's the nearest restroom?" });
  assert.strictEqual(result, null);
});

test("sanitizeLanguage passes through an allowed language", () => {
  assert.strictEqual(sanitizeLanguage("Spanish"), "Spanish");
});

test("sanitizeLanguage falls back to English for an unknown value", () => {
  assert.strictEqual(sanitizeLanguage("Klingon"), "English");
});

test("sanitizeRole falls back to 'fan' for an unknown value", () => {
  assert.strictEqual(sanitizeRole("intruder"), "fan");
});

test("sanitizeRole accepts 'staff'", () => {
  assert.strictEqual(sanitizeRole("staff"), "staff");
});

test("RateLimiter allows requests under the limit", () => {
  const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 3 });
  const now = Date.now();
  assert.strictEqual(limiter.isLimited("ip1", now), false);
  assert.strictEqual(limiter.isLimited("ip1", now), false);
  assert.strictEqual(limiter.isLimited("ip1", now), false);
});

test("RateLimiter blocks requests over the limit within the window", () => {
  const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 });
  const now = Date.now();
  limiter.isLimited("ip2", now);
  limiter.isLimited("ip2", now);
  assert.strictEqual(limiter.isLimited("ip2", now), true);
});

test("RateLimiter resets the count after the window passes", () => {
  const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 1 });
  const t0 = 1000000;
  limiter.isLimited("ip3", t0);
  assert.strictEqual(limiter.isLimited("ip3", t0 + 2000), false);
});

test("RateLimiter tracks separate IPs independently", () => {
  const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 1 });
  const now = Date.now();
  assert.strictEqual(limiter.isLimited("ipA", now), false);
  assert.strictEqual(limiter.isLimited("ipB", now), false);
});

test("RateLimiter.cleanup removes stale entries", () => {
  const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 5 });
  const t0 = 1000000;
  limiter.isLimited("ipOld", t0);
  limiter.cleanup(t0 + 5000);
  assert.strictEqual(limiter.size(), 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
