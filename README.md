# StadiumSense AI

A GenAI-powered fan navigation and crowd management assistant for a FIFA World Cup 2026 host stadium.

## Challenge Area Coverage

The brief names eight possible focus areas. This table maps each one to the concrete feature that addresses it, so alignment isn't left implicit:

| Challenge Area | Feature in this solution |
|---|---|
| **Navigation** | Stadium bowl heatmap + quick-action buttons route a fan to the nearest restroom/food/medical/transit point from their section |
| **Crowd management** | Live-simulated per-section occupancy, color-coded Low/Moderate/High, refreshing in real time |
| **Accessibility** | Dedicated accessibility mode: filters all recommendations to wheelchair-accessible amenities and simplifies AI response language |
| **Transportation** | Transit-stop amenity tracking; the Ops Dashboard flags when crowd is building near a transit point |
| **Sustainability** | Ops Dashboard sustainability tip: recommends directing fans to public transit/recycling points based on live crowd data |
| **Multilingual assistance** | Fan chat responds in the user's selected language (English, Spanish, French, Portuguese, Hindi, Arabic) |
| **Operational intelligence** | Staff View: aggregate occupancy stats, busiest-section tracking, and an AI-generated operational recommendation |
| **Real-time decision support** | Both the fan chat and the Ops "Get AI Ops Recommendation" button reason over live, current-minute stadium context rather than static FAQ answers |

## Chosen Vertical

**Fan Navigation & Crowd Management**, with supporting elements of **Accessibility**, **Real-time Decision Support**, **Sustainability/Transportation**, and **Operational Intelligence**. The solution serves two of the personas named in the brief:

- **Fans** deciding, in the moment, where to go and when — which restroom has the shortest queue, which route is wheelchair-accessible, how crowd levels are changing.
- **Organizers, volunteers, and venue staff**, via a separate Ops Dashboard (toggle "Switch to Staff View") that surfaces aggregate crowd stats, a sustainability/transport recommendation, and an AI-generated operational action for the busiest section.

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
- **Staff View** (toggle in the header) switches to an Operations & Sustainability Dashboard: average occupancy, count of sections at High crowd, the busiest section, and a rule-based sustainability tip about directing fans toward public transit when crowding builds near a transit stop. A "Get AI Ops Recommendation" button asks Gemini (with a staff-specific system instruction) for one concrete operational action.

### Efficiency measures

- The crowd-density slider debounces re-renders through `requestAnimationFrame`, so dragging it doesn't recompute/repaint on every intermediate event.
- The 8-second live-refresh loop pauses automatically when the browser tab is hidden (Page Visibility API) and resumes on return, avoiding wasted work in background tabs.
- Identical chat questions asked under identical stadium conditions are served from a small client-side cache instead of re-calling the Gemini API.
- The serverless rate limiter periodically purges stale entries so its in-memory map doesn't grow unbounded on a long-lived warm instance.

### Code Quality Tooling

- **ESLint** (`.eslintrc.json`) enforces `eqeqeq`, catches unused variables, and requires braces on multi-line conditionals across `js/` and `api/`.
- **Prettier** (`.prettierrc.json`) defines consistent formatting (semicolons, quote style, line width).
- Both run in CI (`.github/workflows/test.yml`) via `npm run lint`, alongside the test suite via `npm test`, on every push and pull request.

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

Pure logic is kept separate from the AI/network layer specifically so it can be unit tested without any API key or network access. Tests use Node's built-in test runner (`node:test`), organized into `describe`/`test` blocks rather than a flat assertion script:

- `tests/test-logic.js` — crowd-level thresholds (including boundary values), queue estimation across rush windows, accessible-amenity filtering, and simulation reproducibility.
- `tests/test-validation.js` — API input validation (empty/oversized/non-string input) and the rate limiter (per-IP limits, window resets, stale-entry cleanup).

```bash
npm test
```

Currently **31 tests, all passing**. A GitHub Actions workflow (`.github/workflows/test.yml`) runs `npm run lint` and `npm test` automatically on every push and pull request.

## Project Structure

```
stadiumsense-ai/
├── index.html            # Main UI (fan view + staff/ops dashboard)
├── css/style.css         # Styling
├── js/
│   ├── stadiumData.js    # Mock data + pure, testable logic functions
│   └── app.js            # Frontend interaction logic
├── api/
│   ├── chat.js           # Serverless Gemini proxy (server-side API key)
│   └── validation.js     # Pure, testable input validation + rate limiter
├── tests/
│   ├── test-logic.js       # Unit tests for stadium/crowd logic
│   └── test-validation.js  # Unit tests for API validation + rate limiter
├── .github/workflows/test.yml  # CI: lint + tests on every push
├── .eslintrc.json
├── .prettierrc.json
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
