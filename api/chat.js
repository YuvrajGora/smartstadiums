// api/chat.js
// Vercel serverless function. Runs server-side only.
// The Gemini API key NEVER reaches the browser - it is read from an
// environment variable here and used only in this server context.

// Very small in-memory rate limiter (per serverless instance).
// Not a substitute for a production rate limiter (e.g. Redis-backed),
// but stops naive abuse/runaway costs in a hackathon deployment.
const requestLog = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  requestLog.set(ip, entry);
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

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

module.exports = async function handler(req, res) {
  // Restrict to POST only
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Basic same-origin style check via header (defense in depth, not a full CSRF fix)
  const origin = req.headers.origin || "";
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  if (allowedOrigin !== "*" && origin && origin !== allowedOrigin) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many requests, please wait a moment." });
    return;
  }

  const { message, contextSummary, language, accessibilityMode } = req.body || {};

  // Input validation - reject malformed or oversized input before it reaches the model
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "A non-empty 'message' string is required." });
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars).` });
    return;
  }
  if (contextSummary && String(contextSummary).length > MAX_CONTEXT_LENGTH) {
    res.status(400).json({ error: "Context payload too large." });
    return;
  }

  const safeLanguage = ALLOWED_LANGUAGES.has(language) ? language : "English";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is not configured with a Gemini API key." });
    return;
  }

  const systemInstruction = [
    "You are StadiumSense AI, a helpful, safety-conscious assistant for fans at a FIFA World Cup 2026 host stadium.",
    "Only use the live stadium context provided below to answer questions about crowd levels, wait times, and amenities.",
    "If asked something unrelated to the stadium experience, politely redirect the user back to stadium assistance topics.",
    "Never invent emergency instructions - for any medical emergency, always tell the user to alert the nearest steward or medical point immediately.",
    accessibilityMode
      ? "The user has enabled accessibility mode: prioritize step-free, wheelchair-accessible routes and keep sentences short and clear."
      : "",
    `Respond in ${safeLanguage}.`,
    "Live stadium context:",
    String(contextSummary || "No live context provided."),
  ]
    .filter(Boolean)
    .join("\n");

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
              parts: [{ text: `${systemInstruction}\n\nFan question: ${message}` }],
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
