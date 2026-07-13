// api/chat.js
// Vercel serverless function. Runs server-side only.
// The Gemini API key NEVER reaches the browser - it is read from an
// environment variable here and used only in this server context.
//
// Validation and rate-limiting logic live in ./validation.js as pure,
// independently unit-tested functions/classes (see tests/test-validation.js).

const {
  validateChatRequest,
  sanitizeLanguage,
  sanitizeRole,
  RateLimiter,
} = require("./validation.js");

// Module-level limiter persists across invocations on a warm serverless instance.
const limiter = new RateLimiter({ windowMs: 60 * 1000, maxRequests: 20 });
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function buildSystemInstruction({ role, contextSummary, language, accessibilityMode }) {
  const base = [
    "You are StadiumSense AI, a helpful, safety-conscious assistant at a FIFA World Cup 2026 host stadium.",
    "Only use the live stadium context provided below - do not invent facts not present in it.",
    "Never invent emergency instructions - for any medical emergency, always tell the user to alert the nearest steward or medical point immediately.",
  ];

  if (role === "staff") {
    base.push(
      "You are speaking to stadium OPERATIONS STAFF, not a fan. Provide concise, actionable operational recommendations: where to redirect stewards, which amenities need resupply or overflow support, and sustainability/transport suggestions (e.g. shifting fans toward public transit or recycling points) where relevant.",
      "Use short, scannable phrasing suitable for a staff dashboard, not conversational chat."
    );
  } else {
    base.push(
      accessibilityMode
        ? "The user has enabled accessibility mode: prioritize step-free, wheelchair-accessible routes and keep sentences short and clear."
        : "Keep answers friendly, brief, and specific to the fan's situation."
    );
  }

  base.push(`Respond in ${language}.`, "Live stadium context:", String(contextSummary || "No live context provided."));
  return base.filter(Boolean).join("\n");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const origin = req.headers.origin || "";
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  if (allowedOrigin !== "*" && origin && origin !== allowedOrigin) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  // Periodic cleanup keeps the rate-limiter map from growing unbounded
  // on a long-lived warm instance (efficiency/memory hygiene).
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    limiter.cleanup(now);
    lastCleanup = now;
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (limiter.isLimited(ip, now)) {
    res.status(429).json({ error: "Too many requests, please wait a moment." });
    return;
  }

  const validationError = validateChatRequest(req.body);
  if (validationError) {
    res.status(validationError.status).json({ error: validationError.error });
    return;
  }

  const { message, contextSummary, language, accessibilityMode, role } = req.body || {};
  const safeLanguage = sanitizeLanguage(language);
  const safeRole = sanitizeRole(role);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is not configured with a Gemini API key." });
    return;
  }

  const systemInstruction = buildSystemInstruction({
    role: safeRole,
    contextSummary,
    language: safeLanguage,
    accessibilityMode,
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemInstruction}\n\nQuestion: ${message}` }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 300,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      res.status(502).json({ error: "The AI assistant is temporarily unavailable." });
      return;
    }

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I couldn't generate a response just now - please try rephrasing your question.";

    res.status(200).json({ reply });
  } catch (err) {
    console.error("Unexpected error calling Gemini:", err);
    res.status(500).json({ error: "Something went wrong reaching the AI assistant." });
  }
};
