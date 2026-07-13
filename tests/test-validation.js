// tests/test-validation.js
// Run with: npm test  (uses Node's built-in test runner, no extra dependency)
// Covers the API layer's input validation and rate limiter.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateChatRequest,
  sanitizeLanguage,
  sanitizeRole,
  RateLimiter,
  MAX_MESSAGE_LENGTH,
} = require("../api/validation.js");

describe("validateChatRequest", () => {
  test("rejects a missing message", () => {
    assert.equal(validateChatRequest({}).status, 400);
  });

  test("rejects an empty/whitespace message", () => {
    assert.equal(validateChatRequest({ message: "   " }).status, 400);
  });

  test("rejects an oversized message", () => {
    const longMessage = "a".repeat(MAX_MESSAGE_LENGTH + 1);
    assert.equal(validateChatRequest({ message: longMessage }).status, 400);
  });

  test("rejects an oversized context payload", () => {
    const result = validateChatRequest({
      message: "hello",
      contextSummary: "a".repeat(5000),
    });
    assert.equal(result.status, 400);
  });

  test("rejects a non-string message", () => {
    assert.equal(validateChatRequest({ message: 12345 }).status, 400);
  });

  test("accepts a normal request", () => {
    assert.equal(validateChatRequest({ message: "Where's the nearest restroom?" }), null);
  });
});

describe("sanitizeLanguage", () => {
  test("passes through an allowed language", () => {
    assert.equal(sanitizeLanguage("Spanish"), "Spanish");
  });

  test("falls back to English for an unknown value", () => {
    assert.equal(sanitizeLanguage("Klingon"), "English");
  });

  test("falls back to English for undefined input", () => {
    assert.equal(sanitizeLanguage(undefined), "English");
  });
});

describe("sanitizeRole", () => {
  test("falls back to 'fan' for an unknown value", () => {
    assert.equal(sanitizeRole("intruder"), "fan");
  });

  test("accepts 'staff'", () => {
    assert.equal(sanitizeRole("staff"), "staff");
  });

  test("accepts 'fan'", () => {
    assert.equal(sanitizeRole("fan"), "fan");
  });
});

describe("RateLimiter", () => {
  test("allows requests under the limit", () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 3 });
    const now = Date.now();
    assert.equal(limiter.isLimited("ip1", now), false);
    assert.equal(limiter.isLimited("ip1", now), false);
    assert.equal(limiter.isLimited("ip1", now), false);
  });

  test("blocks requests over the limit within the window", () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 });
    const now = Date.now();
    limiter.isLimited("ip2", now);
    limiter.isLimited("ip2", now);
    assert.equal(limiter.isLimited("ip2", now), true);
  });

  test("resets the count after the window passes", () => {
    const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 1 });
    const t0 = 1000000;
    limiter.isLimited("ip3", t0);
    assert.equal(limiter.isLimited("ip3", t0 + 2000), false);
  });

  test("tracks separate IPs independently", () => {
    const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 1 });
    const now = Date.now();
    assert.equal(limiter.isLimited("ipA", now), false);
    assert.equal(limiter.isLimited("ipB", now), false);
  });

  test("cleanup removes stale entries", () => {
    const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 5 });
    const t0 = 1000000;
    limiter.isLimited("ipOld", t0);
    limiter.cleanup(t0 + 5000);
    assert.equal(limiter.size(), 0);
  });
});
