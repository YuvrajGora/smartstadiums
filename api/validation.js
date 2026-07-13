// api/validation.js
// Pure functions extracted from chat.js so they can be unit tested without
// network access or an API key. Keeping validation logic separate from the
// request handler is also better for maintainability (single responsibility).

const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 4000;

const ALLOWED_LANGUAGES = new Set([
  "English",
  "Spanish",
  "French",
  "Portuguese",
  "Hindi",
  "Arabic",
]);

const ALLOWED_ROLES = new Set(["fan", "staff"]);

/** Returns null if valid, or a { status, error } object describing the problem. */
function validateChatRequest(body) {
  const { message, contextSummary } = body || {};

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return { status: 400, error: "A non-empty 'message' string is required." };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { status: 400, error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars).` };
  }
  if (contextSummary && String(contextSummary).length > MAX_CONTEXT_LENGTH) {
    return { status: 400, error: "Context payload too large." };
  }
  return null;
}

function sanitizeLanguage(language) {
  return ALLOWED_LANGUAGES.has(language) ? language : "English";
}

function sanitizeRole(role) {
  return ALLOWED_ROLES.has(role) ? role : "fan";
}

/**
 * Small in-memory sliding-window rate limiter, implemented as a class so it
 * can be instantiated fresh in tests instead of relying on module-level state.
 */
class RateLimiter {
  constructor({ windowMs = 60 * 1000, maxRequests = 20 } = {}) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.log = new Map();
  }

  isLimited(key, now = Date.now()) {
    const entry = this.log.get(key) || { count: 0, windowStart: now };
    if (now - entry.windowStart > this.windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count += 1;
    this.log.set(key, entry);
    return entry.count > this.maxRequests;
  }

  /** Removes stale entries so the map doesn't grow unbounded on a long-lived server. */
  cleanup(now = Date.now()) {
    for (const [key, entry] of this.log.entries()) {
      if (now - entry.windowStart > this.windowMs) this.log.delete(key);
    }
  }

  size() {
    return this.log.size;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MAX_MESSAGE_LENGTH,
    MAX_CONTEXT_LENGTH,
    ALLOWED_LANGUAGES,
    ALLOWED_ROLES,
    validateChatRequest,
    sanitizeLanguage,
    sanitizeRole,
    RateLimiter,
  };
}
