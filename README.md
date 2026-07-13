# StadiumSense AI

A GenAI-powered fan navigation and crowd management assistant for a FIFA World Cup 2026 host stadium.

## Chosen Vertical

**Fan Navigation & Crowd Management**, with supporting elements of **Accessibility** and **Real-time Decision Support**. The solution helps a fan decide, in the moment, where to go and when — which restroom has the shortest queue, which route is wheelchair-accessible, and how crowd levels are changing across the stadium as the match progresses.

## Approach and Logic

The core idea is to separate **simulated stadium data** from **AI reasoning**:

1. **`js/stadiumData.js`** holds mock stadium data (sections, gates, amenities) and pure, testable functions that model crowd behavior — e.g. occupancy naturally spikes in the 10 minutes before kickoff and during the halftime window, when concession and restroom queues are longest. This mirrors real fan behavior at large stadiums.
2. **The frontend (`index.html`, `js/app.js`, `css/style.css`)** renders this data as a live "stadium bowl" heatmap and lets a fan pick their section, language, and whether to enable accessibility mode.
3. **Gemini (via `api/chat.js`)** is given a compact, structured summary of *current* crowd conditions and amenity data as context, plus the fan's question. It reasons over that live context to give a specific, situational answer (e.g. "Section C1 is currently at moderate crowd levels with an estimated 7-minute queue — the South Deli near C1 is a shorter walk than the North Grill").

This keeps the Gen AI usage meaningful rather than decorative: the model is doing contextual reasoning over real-time-style data, not just answering generic FAQ questions.

## How the Solution Works

- A match-minute slider simulates the live game clock. Moving it updates simulated crowd density across all 8 sections.
- The **stadium bowl** heatmap color-codes each section Low / Moderate / High based on occupancy.
- **Quick action chips** (nearest restroom, shortest food queue, nearest medical point, nearest transit stop) use a simple distance model (same section → same gate → elsewhere) to recommend the closest matching amenity, filtered to accessible-only options when accessibility mode is on.
- The **chat panel** sends the fan's question, plus a summary of live section/queue data, to a serverless function (`api/chat.js`), which calls the Gemini API server-side and returns a grounded answer.
- **Accessibility mode** biases both the quick-action logic and the AI's system instructions toward step-free, wheelchair-friendly options and shorter, clearer sentences.
- **Language selection** is passed to Gemini so responses come back in the fan's chosen language (English, Spanish, French, Portuguese, Hindi, or Arabic in this demo).

## Assumptions

- Crowd occupancy is **simulated**, not pulled from real IoT sensors, since no live stadium data feed is available in this hackathon context. The simulation model (rush windows around kickoff/halftime) is a reasonable stand-in and is fully documented in code.
- Amenity locations (restrooms, medical points, food stalls, transit stops) are mock data representative of a typical stadium layout, not a real venue's floor plan.
- "Distance" between a fan's section and an amenity is modeled simply (same section / same gate / elsewhere) rather than true geographic pathfinding, which would require a real facilities map.
- The system assumes a single active match; multi-match/multi-day scheduling is out of scope for this submission.

## Tech Stack

- Static HTML/CSS/JavaScript frontend (no build step, keeps the repository small and deploy-friendly)
- One Vercel serverless function (`api/chat.js`) as a secure proxy to the Gemini API
- Gemini 2.0 Flash for conversational reasoning

## Setup & Local Development

```bash
git clone <your-repo-url>
cd stadiumsense-ai
cp .env.example .env
# edit .env and add your GEMINI_API_KEY (free key: https://aistudio.google.com/app/apikey)
npx vercel dev
```

Then open the local URL Vercel prints (typically `http://localhost:3000`).

## Deployment (Vercel)

1. Push this repository to GitHub (public, single branch).
2. Go to [vercel.com](https://vercel.com), import the repository.
3. In Project Settings → Environment Variables, add `GEMINI_API_KEY` (and optionally `ALLOWED_ORIGIN` set to your deployed domain).
4. Deploy. Vercel automatically detects `api/chat.js` as a serverless function and serves the rest as static files.

## Security Notes

- The Gemini API key is **only** read server-side inside `api/chat.js` via `process.env.GEMINI_API_KEY`. It is never sent to or stored in the browser.
- `.env` is git-ignored; `.env.example` documents required variables without exposing real secrets.
- The serverless function validates and caps input length (max 500 characters per message, max 4000 characters of context) before sending anything to the model.
- A basic in-memory rate limiter (20 requests/minute per IP) guards against runaway usage and cost abuse; this is documented as a hackathon-scope safeguard rather than a production-grade solution.
- An optional `ALLOWED_ORIGIN` environment variable can restrict which origin is allowed to call the endpoint.
- The AI is explicitly instructed never to invent emergency procedures — it always redirects real emergencies to on-site stewards/medical staff.

## Testing

Pure logic (crowd level classification, queue estimation, nearest-amenity search) is separated from the AI/network layer specifically so it can be unit tested without any API key or network access:

```bash
npm test
# or: node tests/test-logic.js
```

This runs 11 assertions covering crowd-level thresholds, queue estimation during rush windows, accessible-amenity filtering, and simulation reproducibility.

## Project Structure

```
stadiumsense-ai/
├── index.html          # Main UI
├── css/style.css        # Styling
├── js/
│   ├── stadiumData.js   # Mock data + pure, testable logic functions
│   └── app.js           # Frontend interaction logic
├── api/
│   └── chat.js          # Serverless Gemini proxy (server-side API key)
├── tests/
│   └── test-logic.js    # Unit tests for pure logic functions
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
