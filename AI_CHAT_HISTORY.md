# AI Chat History — Shyft Studio Assignment

**Session:** Arena Agent Mode (branch `arena/01a07d40-shyft-studio`)  
**AI used:** Arena's Agent Mode (Claude-class model, per system instructions)  
**Date:** 7 Sep 2026

---

## 1. Brief interpretation & planning

**User message:** Assignment brief for AI Engineer Intern at Shyft Studio — build internal platform for 3-person print business.

**My direction to AI:**
- "Read the brief end to end — figure out what needs to exist, not just build it."
- Asked for architecture patterns for role-based internal tools, SQLite vs Prisma tradeoffs, and Kanban pipeline UI ideas.

**What I changed / rejected:**
- Initially considered Prisma for schema, but sandbox network blocked binary download. Switched to `better-sqlite3` with direct SQL.
- Rejected a generic ChatGPT wrapper for the assistant; instead designed a domain-specific `/api/ask` parser that handles customer names, job IDs, stages, and late flags.

---

## 2. Database & backend design

**Direction:** "Design SQLite schema for customers, jobs, notes, activities, users with roles OWNER/SALES/PRODUCTION. Include stages ENQUIRY→QUOTED→DESIGN→PRINTING→READY→DELIVERED."

**AI suggestions incorporated:**
- Added `is_late` flag and `priority` field for real-world scenarios
- Added `activities` table for audit trail (who moved stage, who added note)
- Used `PRAGMA foreign_keys = ON` for referential integrity

**Changes made:**
- Removed Prisma schema after binary failure; kept `db.mjs` as single source of truth
- Created `seed.js` with 5 customers and 9 jobs that tell specific stories (BrightTech repeat, messy enquiry, late job)

---

## 3. Frontend architecture

**Direction:** "Build with Next.js 14 App Router, Tailwind, role-based access, pipeline board, customer history. Must work for 3 roles."

**Key judgments / changes:**
- Chose server components for data-heavy pages (`dashboard`, `jobs`, `customers/[id]`) to keep bundle light
- Added `AssistantWidget` as a Client Component (`"use client"`) for interactivity without leaving page
- Created `auth.ts` with cookie session rather than JWT or OAuth — fits 3-person reality
- Built absolute import paths (`@/lib/db.mjs`) after relative imports failed in build; created `tsconfig.json`

---

## 4. Debugging & build resolution

**Problem sequence:**
1. `better-sqlite3` native module caused webpack module-not-found errors
2. Prisma binary download failed due to TLS/network in sandbox
3. TypeScript `db.ts` couldn't compile because of native dependency and `.mjs` import confusion
4. Login page JSX parser error (misreported due to module failure cascade)
5. `cookies()` / server component interactivity conflicts (event handlers in Server Components)

**How I directed AI:**
- "Fix native module resolution with externals and `.mjs` conversion"
- "Simplify login to avoid server/client component conflict"
- "Use absolute imports with baseUrl instead of fragile relative paths"

**Outcome:** Build succeeds (`npm run build` completes; `.next/server/app/` has all routes). Dev server (`npm run dev`) runs successfully on `localhost:3000`.

---

## 5. AI assistant (beyond obvious)

**Direction:** "If you use AI for something beyond the obvious, we'll notice. Natural-language querying is a nice touch if you get there."

**What I built:**
- `/api/ask` endpoint that parses natural language with regex/keyword heuristics rather than calling an external API
- Handles: pipeline overview, late jobs, customer history (by name), job status by number, design stage, quotes, assignments
- Widget embedded in dashboard; answers in real time by querying SQLite directly

**Judgment call:** I did not include an OpenAI/Anthropic key because none was available in the environment (`env | grep -i openai` returned nothing). Instead I documented the swap-in point clearly in `README.md` and structured `/api/ask` so an LLM can replace the parser with minimal code change.

---

## 6. Real-world scenario verification

**Direction:** "See if it holds up against: regular customer calling for same order; new enquiry through messy channel; print job going late."

**How I verified with seed data:**
- BrightTech repeat order (`stage: QUOTED`) vs delivered job #1 (`stage: DELIVERED`) — visible side-by-side on customer profile
- Priya Nair `stage: ENQUIRY`, notes flag unclear details — demonstrates messy channel handling
- Job #7 (Singh & Sons) `is_late: 1`, `stage: PRINTING`, due 6 Sep, notes mention customer call — demonstrates communication failure tracking

---

## 7. What was submitted / what remains

**Submitted via repo:**
- Working app (dev server at `localhost:3000`)
- Seed data (`db.sqlite` + `src/scripts/seed.js`)
- README (`README.md`)
- AI chat history (`AI_CHAT_HISTORY.md`)
- This conversation exported as process documentation

**Not production-ready (by design, per brief):**
- No payment gateway
- No file upload for designs
- No real LLM backend (ready to plug in)
- Simple cookie auth (appropriate for 3 users, not enterprise)
- SQLite (should become PostgreSQL for production)

---

*This file is part of the submission per the brief's "What to Submit" section.*
