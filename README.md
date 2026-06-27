# ClarityAI

ClarityAI helps insurance representatives explain products clearly, consistently and compliantly — built for the **PolyFinTech100 API Hackathon 2026 (UX/CX category, sponsored by Singapore College of Insurance)**.

The tool gives a live "second brain" to a client-facing representative during real conversations: approved talking points surface automatically, risky phrasing is flagged with a compliant replacement, and customer chat replies are AI-drafted but always sent by a human. **It never advises, recommends, or sells a product itself** — that boundary is enforced in both the rule engine and the AI prompt layer.

## The problem it solves

1. Mixed messages on product features and next steps
2. Inconsistent service quality across channels
3. Compliance gaps that erode trust
4. Customers losing confidence in the financial advisory process

## What it delivers

- **Real-time guidance** — context-aware prompts during live conversations
- **Consistent messaging** — one approved knowledge base, used everywhere
- **Compliance checks** — automatic flags + suggested approved language
- **Customer trust** — clear, plain-English explanations
- **Measurable impact** — a live metrics dashboard computed from real usage, not fabricated numbers

## Channels

| Channel | What it is | Where |
|---|---|---|
| Face-to-face | Laptop prompts during an in-person meeting, driven by the shared room mic | Agent Console |
| Virtual call | Real two-way webcam call (WebRTC) with smart on-screen guidance, visible to the rep only | Agent Console + Client Portal |
| Chat | Customer messages get an AI-drafted reply that the rep reviews/edits before sending | Agent Console + Client Portal |

Products covered: Life insurance, Investment-linked policies (ILPs), Critical illness, Integrated Shield Plans, Retirement plans / CPF LIFE.

## Architecture

```
SCI_AI/
├── backend/      Node.js + Express + Socket.io + Postgres (pg)
└── frontend/     React 18 + Vite + Tailwind CSS
```

- **Database**: Postgres, connected via a single `DATABASE_URL`. Works against a local Postgres install for dev, and against a [Supabase](https://supabase.com) connection string with zero code changes for production — Supabase is itself managed Postgres, so swapping `DATABASE_URL` is the entire migration.
- **AI engine**: a deterministic rule/knowledge-base engine is always on (no API key needed, instant, never hallucinates). An **optional OpenAI layer** (gpt-4o-mini) adds richer plain-English phrasing on top, only when an API key is supplied — with a strict system prompt that bans advice, recommendations and guarantees, and a hard fallback to the rule engine if the call fails or times out.
- **Speech**: browser-native Web Speech API for both speech-to-text and text-to-speech — no API key, works offline-ish, best support in Chrome/Edge desktop.
- **Video calling**: real WebRTC between two browser tabs/windows, signaled over the existing Socket.io connection (no separate signaling server). STUN-only, which is sufficient for a same-machine or same-LAN demo.
- **Auth**: JWT login for representatives. Customer-facing read endpoints are intentionally public — this is an internal agent-assist tool, and the "Client Portal" simulates what a customer would see inside their own already-authenticated banking/insurance app, so the demo skips building a second login system and lets you pick a seeded demo profile instead.

## Setup

Requires Node.js 18+ (the dev machine used Node 22). Use **Google Chrome or Microsoft Edge on desktop** — Web Speech API support elsewhere (Firefox, Safari) is partial or missing.

### 1. Backend

Requires a Postgres database — either a local Postgres install or a free [Supabase](https://supabase.com) project (Supabase is managed Postgres, so either works with the exact same code).

```bash
cd backend
npm install
cp .env.example .env       # then set DATABASE_URL to your local Postgres or Supabase connection string
npm run seed                # creates the schema + demo agents/customers/policies/KB
npm run dev                  # starts the API + Socket.io server on :4000
```

To point at Supabase instead of local Postgres, just swap `DATABASE_URL` in `backend/.env` for the connection string from your Supabase project's Settings → Database page — no other changes needed.

To turn on the optional OpenAI enhancement layer, put a real key in `backend/.env`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Leave it blank to run fully on the built-in rule engine (still complete and demo-ready — the AI layer is an enhancement, not a dependency).

To turn on the **Research Agent's** live web search (used only when the curated knowledge base and any uploaded PDFs/URLs don't cover a question — e.g. comparing how another insurer's product is typically structured), get a free key at [tavily.com](https://tavily.com) and add it to `backend/.env`:

```
TAVILY_API_KEY=tvly-...
```

Leave it blank to skip web search entirely — the AI still won't deflect the customer to "ask a supervisor"; it just asks a clarifying question instead.

**Knowledge Library** (`/agent/knowledge`, agent role): teach the Knowledge Agent from your own reference material — upload a PDF, or paste a URL (an insurer's product page, MAS/CPF guidance, etc.). Either source is parsed, chunked, and — if `OPENAI_API_KEY` is set — embedded into a small vector store (just a column in the same Postgres database, no separate vector DB to run) so future questions can be matched semantically, not just by keyword overlap. Every result surfaced from this material is always labelled "from your document" downstream, same as web results are labelled "from the web" — never confused with pre-approved messaging.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # defaults point at the backend above
npm run dev                  # starts Vite on :5173
```

Open `http://localhost:5173`.

### Demo login

```
agent@sci.demo / demo1234
```

A second seeded rep (`wei.ling@sci.demo`, same password) is also available — see the room-matching note below before using it.

## Demo script (for the judging panel)

1. **Landing page** (`/`) — set the scene: the problem statement and the five solution pillars, then pick a side.
2. **Agent Console → log in** as `agent@sci.demo`.
3. **Dashboard** — pick a customer, start a channel. This is also where you'd resume an in-progress session.
4. **Face-to-face** — toggle the mic, talk through a scenario (e.g. say "is this guaranteed" or "what does this critical illness plan cover"), and watch approved talking points and compliance flags stream in live. Click the speaker icon to hear the approved wording read aloud.
5. **Virtual call (the flagship view)** — open a **second browser window** (or a second device on the same Wi-Fi) and go to `/client` → pick the **same customer** → "Video call". Both sides land on the same call automatically — no room codes to type. The rep's screen shows the live video plus a guidance feed that only the rep can see; the customer's screen is a clean, ordinary video call with nothing backstage exposed.
6. **Chat** — from the Client Portal, send a chat message as the customer; watch the AI-drafted reply appear on the rep's screen for review/edit before it's sent.
7. **Impact dashboard** (`/agent/metrics`) — real numbers generated by the session you just ran: talking points served, compliance flags caught, messages exchanged.

### Important: keep both windows on the same rep

The Client Portal always talks to whichever agent was seeded first (`agents.routes.js` → `/primary`). For the two windows to land in the *same* video call / chat room, log into the Agent Console as **`agent@sci.demo`** (the first-seeded rep) — not `wei.ling@sci.demo`. Each (representative, customer, channel) combination resolves to its own conversation, so a mismatched rep means two separate, unconnected rooms.

### If demoing across two physical devices

Replace `localhost` with your machine's LAN IP in `frontend/.env` (`VITE_API_URL`, `VITE_SOCKET_URL`) and in `backend/.env` (`CLIENT_ORIGIN`), then restart both servers. Camera/mic permission prompts will appear in each browser the first time.

## Compliance boundary

Per the hackathon brief, this tool must never act as a robo-adviser. That boundary is enforced twice:

- The rule engine's compliance list flags phrases like "I recommend", "guaranteed returns", "best policy for you" and supplies an approved replacement — regardless of whether the OpenAI layer is on.
- When the OpenAI layer is on, its system prompt explicitly forbids recommending, advising, or guaranteeing anything, and restricts it to only the approved talking points it's given.

## Project status / verification

Everything in `backend/` and `frontend/` was hand-authored and syntax-checked (`node --check` on every backend file; brace/paren/import-export consistency checks across every frontend file). Because this build environment has no access to the npm registry or a live Postgres instance, **`npm install`, a real Postgres connection, the Vite dev server, and the production build could not be executed here** — please run the setup steps above locally (or against Supabase) before the demo to catch anything environment-specific (browser permissions, port conflicts, connection-string issues, etc.).
