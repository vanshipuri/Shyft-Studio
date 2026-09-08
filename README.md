# Shyft Studio — The Shared Pipeline for Samyak's 3-Person Print Shop

**One sentence positioning:** *A single shared pipeline that replaces WhatsApp + memory +
spreadsheets for a 3-person print shop — every job has a stage, exactly one owner, and a
paper trail.*

**Assignment:** AI Engineer Intern · **Candidate:** Vanshi (simulated submission) ·
**Date:** 8 Sep 2026

![CI](https://github.com/vanshipuri/Shyft-Studio/actions/workflows/ci.yml/badge.svg)
![tests](https://img.shields.io/badge/tests-19%2F19%20passing-brightgreen)
![eval](https://img.shields.io/badge/intake__eval-62%2F62%20assertions-brightgreen)
![audit](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen)

**Status:** Complete — 19/19 tests (engine, data model, LLM seam), 62/62 intake-eval
assertions, 6/6 deploy smoke tests, 19 routes building clean on Next.js 16.

> What Samyak's team actually said, and the system requirement each quote becomes:

| Quote from the team | Real problem | System requirement | Where it lives |
|---|---|---|---|
| *"Abhishek's phone is basically our sales pipeline"* | No shared customer/order memory | Central customer + order history | `/customers` Customer 360 with full order history & LTV |
| *"I don't always know where it stands until he tells me"* | No stage visibility | Explicit job pipeline with current owner + status | `/jobs` Pipeline Board, stage stepper with ownership handoff |
| *"None of us has a straight answer ready"* | No proactive delay detection | Deadline tracking + at-risk flagging | Risk engine, LATE badges, Owner's Daily Briefing |
| *"Took three phone calls just to confirm"* | No fast repeat-order lookup | One-click "reorder" from customer history | `RepeatOrderModal` — 1-click "same as last time" |
| *"Nobody flagged it, wasn't clear whose job it was"* | No ownership model | Every job stage has exactly one clear owner | Stage-derived ownership, auto-reassigns on transition |
| *"Catching the next one before they even ask"* | No follow-up/retention system | Automated re-engagement nudges from order cadence | "Repeat Customers Due for a Check-in" panel + Copilot |

---

## 👥 Personas & Product Framing

The product is **Shyft Studio** (Samyak's print business, as his team already calls it in
WhatsApp). Rather than a generic Kanban clone, each teammate gets a role-tailored lens over
the same pipeline:

| Persona | Day-to-day | Role lens in the app |
|---|---|---|
| 👑 **Samyak Mehta** (Owner) | Financial health, risk, clients | Executive KPIs, Operational Bottleneck Radar, Team Workload, LTV leaderboard, **Daily Briefing** |
| 💼 **Abhishek Rao** (Sales) | Intake, quoting, repeat orders, follow-ups | Messy WhatsApp intake, unquoted-enquiry radar, 1-click repeat orders, **re-engagement check-ins** |
| ⚙️ **Siddhant Yadav** (Production) | Print floor, QC, machine queues | Priority print queue, pre-flight checklists, paper/machine alerts, SLA alarms |

---

## 🗂️ Data Model

The schema is deliberately small (SQLite, five tables). Every table maps to a playbook
entity:

```
users       (Samyak / Abhishek / Siddhant — OWNER / SALES / PRODUCTION)
customers   — name, company, phone, email, notes (preferences)
jobs        — stage, assigned_to, customer_id, quote_amount, due_date, paid_upfront,
              priority, is_late, lead_source, specs_summary, checklist, risk fields
notes       — free-text comm log, attachable to a customer and/or a job
activities  — the audit trail: every stage change / handoff / checklist tick, with
              user + timestamp  (plays the JobStageHistory role)
```

**The pipeline is a first-class concept, not a "status" dropdown.** It lives in
`src/lib/pipeline.mjs` — the single source of truth:

```
 ENQUIRY   → QUOTED   → DESIGN   → PRINTING   → READY   → DELIVERED
 [Sales]     [Sales]    [Sales]    [Prod]       [Prod]    [Sales]
```

Every stage carries a **default owner role baked into the model**. On every stage
transition the job is *re-assigned to the stage owner automatically*, and the audit trail
records the handoff (`Moved stage DESIGN → PRINTING — now owned by Siddhant Yadav
(PRODUCTION)`). There is no free-text "current owner" to forget to update. Details the
playbook models as extra stages are tracked as first-class flags instead of extra columns:
advance/confirmation → `paid_upfront`, design approval / finishing / QC → the 6-step
pre-flight checklist inside PRINTING.

---

## 🔐 Role & Access Design (the judgment call, stated explicitly)

| Role | Sees | Can do |
|---|---|---|
| **Samyak (Owner)** | Everything + business-wide analytics | Everything (override) |
| **Abhishek (Sales)** | All customers & order history; all enquiries/quotes; production status (read-only lens) | Intake, quotes, repeat orders, notes, stage moves through DESIGN |
| **Siddhant (Production)** | Floor queue (PRINTING/READY) + job specs; SLA alarms | Stage moves PRINTING/READY, checklist ticks, notes |

**Decision — should Production see pricing?** We chose **yes, show it.** In a 3-person,
trust-based shop, hiding `quote_amount` from Siddhant adds friction (he prints the thing
the price is for) with no real security benefit. It is one column in one table — if the
business ever grows past trust, this is a 5-line config toggle, which we flag rather than
build speculatively.

**Auth for a 3-day internal tool:** simple role login (seeded users, password
`password123`, no email verification, no JWT/multi-tenant infra). The **Persona Switcher**
in the top bar exists so recruiters can experience all three roles in one click; read
personalization is implemented per role, and write authorization is deliberately lenient
for the demo. This is a documented scope cut, not an oversight.

---

## 🏗️ Architecture & Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) + Tailwind | Server components render data instantly; small client "islands" for modals/board; single deployable |
| Backend | Next.js API routes (form POSTs + JSON) | One unit to run; 303 proxy-safe redirects for deploy previews |
| Database | SQLite via `better-sqlite3` | File-backed, zero-ops, relational integrity with FKs; committed demo seed |
| ORM | none at runtime (Prisma schema kept for reference only) | `db.mjs` is explicit SQL — easy to read, no magic |
| AI | Deterministic domain engine (`ai-engine.mjs`) + a **real, tested provider seam** (`llm-provider.mjs`) | See below |
| AI quality | Hand-labelled extraction eval with a hard CI gate (`tests/eval-intake.mjs`) | Catches silent regex rot |
| CI | GitHub Actions: build + tests + eval + live-server smoke + `npm audit` | Green before merge, not after |
| Auth | Cookie session + seeded role accounts | 3-person internal tool |

**Why not LangChain / a vector DB / microservices / Postgres-in-the-cloud?** Because the
scope is a 3-person print shop and a 3-day build. A deterministic domain engine is faster
to reason about, debuggable offline, and free to run; its four pure functions
(`parseMessyLead`, `generateRepeatOrderPackage`, `analyzeProductionRisks`,
`processCopilotQuery`) are exactly the seam a hosted LLM provider sits behind — no
framework needed to swap later.

**And the seam is real, not aspirational.** `src/lib/llm-provider.mjs` implements it:
set `SHYFT_LLM_API_KEY` and intake enrichment runs through any OpenAI-compatible endpoint
(OpenAI, Groq, Together, vLLM, Ollama). Leave it unset — the default, and what CI runs —
and `createLlmClient()` returns `available: false`, the app makes **zero** network calls,
and behaviour is identical to the pure-rules engine. Three invariants are enforced in code
and pinned by tests, not just asserted in prose:

| Invariant | Where it is enforced | Test |
|---|---|---|
| The LLM may fill blank fields, never set prices | `enrichLeadWithLLM` restores `quoteAmount`/`items` from the deterministic result | `the provider can never change the price or the line items` |
| Identity resolution stays local | provider `company` is ignored when an account already matched | `an already-matched existing account is never re-identified` |
| A flaky provider must not take intake down | provider throw/timeout → return the deterministic result | `provider failure degrades to the deterministic result` |

Provider output is validated before use (`provider output is validated, not trusted`):
non-string fields, malformed phone/email and oversized strings are dropped.

---

## 🤖 AI Features — what, why, and how (with the safety calls)

### a) Messy-channel intake parser (human-in-the-loop, always)
**What:** paste a raw WhatsApp / voice-transcript / walk-in message; get structured
customer + line items + specs + a price estimate + a one-click WhatsApp clarification
draft. **Why:** this is literally how every enquiry arrives. **Safety decisions:**
1. The parser **never auto-creates anything** — it extracts, shows editable-ish fields and
   missing-info flags, and only writes to the DB on an explicit human "Create Enquiry in
   Pipeline" click.
2. **Customer identity is deduplicated, not duplicated:** exact mentions attach to the
   existing account; typo'd mentions ("BrghtTech Solutons") are fuzzy-matched
   (bigram similarity over word windows) and shown as *"Matched existing account —
   high confidence — Attach vs. Create new"* with a human toggle. Ambiguous or weak
   matches are reported as *no match* instead of guessed.
3. Prices always flow through the canonical rate table (`pricing.mjs`) so the engine can
   never invent a rate.

### b) Natural-language Copilot = constrained intent router, not raw SQL
**What:** ask "What is our active pipeline value?", "Draft an apology message for Singh &
Sons delay", "Which repeat clients are due for a check-in?", "Give me today's briefing".
**Why:** every query maps to one of a **fixed set of safe, read-only intent handlers**
(financials, risk/bottlenecks, customer history, late jobs, drafts, nudges, briefing,
unquoted leads). There is no SQL constructed from user text, no arbitrary tool access —
the same design principle as function-calling with an allow-list. Anything outside the
intents gets a graceful "here's what I can do" fallback. That is the security decision,
and it is deliberate: **constrained tool-calling over raw text-to-SQL**, even for an
internal tool.

### c) Proactive re-engagement nudges ("catch the next one before they ask")
**What:** for every repeat customer the engine learns their **own reorder cadence** from
delivered-job history. When they are silent past that cadence (and have no open job) they
appear on Abhishek's dashboard and in Copilot: *"Meera Shah (Urban Nest) — 119 days since
last order, typical cadence ~45 days."* Customers with open jobs are never nagged. **Why:**
this turns the tribal knowledge in Abhishek's head into a system rule anyone can see.

### d) AI-drafted customer update messages
**What:** when a job is late or at risk, one click drafts a polite, human-sounding
WhatsApp status message (delay cause, new ETA, apology) — plus follow-up drafts for stale
enquiries. **Why:** the actual send stays manual (copy-paste from the UI). No WhatsApp
Business API integration, no SMS gateway — simulated on purpose; see Scope Cuts.

### e) Daily briefing for Samyak
**What:** a generated one-screen paragraph on the Owner dashboard: *"1 job(s) at risk,
2 repeat client(s) due for a check-in, 1 enquiry(ies) aging without a quote — pipeline
₹98,780 across 10 active jobs."* Role-aware variants exist for Sales and Production, and
Copilot answers "Give me today's briefing". **Why:** it is the owner's stated pain — not
knowing where things stand — collapsed into one screen.

### f) "Same as last time" repeat orders
**What:** from any customer profile, generate a repeat quote from their last delivered job
(specs, price, artwork status), then confirm. That is scenario 1 in ~10 seconds.

---

## ✅ Core feature set (the actual product, in one list)

1. Job creation + full stage pipeline with explicit current owner (auto-assigned per stage)
2. Customer profile with complete order history + LTV + 1-click repeat order
3. Role-tailored dashboards — "what's mine right now" per persona
4. Late / at-risk flagging (deadline vs stage + notes), risk tiers LOW→CRITICAL
5. Unified audit trail per job (stage moves, handoffs, checklist ticks, notes)
6. Pre-flight production checklist (proof, paper stock, print, finishing, QC)
7. Messy-intake parser, NL Copilot, re-engagement nudges, daily briefing (above)

---

## 🚀 Run, Test & Explore

```bash
npm ci --include=dev
npm run build        # 19 routes compile clean (Next.js 16 / Turbopack)
npm start            # http://localhost:3000 (or: npm run dev)
npm test             # 19/19 — engine + data model + LLM provider seam
npm run eval         # 62/62 intake-extraction assertions (exits 1 on regression)
npm run test:deploy  # 6/6 — requires the server running (TEST_BASE_URL override supported)
```

Optional: `cp .env.example .env` — every variable is optional. Setting
`SHYFT_LLM_API_KEY` switches intake enrichment from the rules engine to a live
OpenAI-compatible provider; unset, the app never touches the network.

**Demo credentials (all password `password123`):** `samyak@shyft.studio` (Owner) ·
`abhishek@shyft.studio` (Sales) · `siddhant@shyft.studio` (Production).
Use the **Persona Switcher** bar to experience all three lenses from any page.

**A 5-minute tour:** Dashboard → `AI WhatsApp Intake` → Preset #1 (watch extraction,
pricing, missing-info flags, fuzzy matching on existing accounts) → `Create Enquiry in
Pipeline` → the new card appears on `/jobs`. Then open `/jobs/7` (Singh & Sons — LATE) and
use the stepper / AI message drafts. On the Sales dashboard, see "Repeat Customers Due for
a Check-in" (Meera Shah / Urban Nest). On the Owner dashboard, read the **Daily Briefing**.

### Repopulate the demo database (optional — resets all data)
```bash
rm -f db.sqlite && npm run db:seed
```

---

## 🧪 How the three brief scenarios were tested

| Scenario | How to reproduce | Automated coverage |
|---|---|---|
| **1. Repeat customer, same order** | `/customers/1` (Neha Desai / BrightTech) → "1-Click Repeat Order" → review specs vs. past job → confirm. Or Copilot: *"What did Neha from BrightTech order last time?"* | `features.test.mjs` — "Repeat Order Assistant matches past delivered jobs" |
| **2. Messy new enquiry (typo'd name)** | Header → `AI WhatsApp Intake` → paste *"Hi, Neha from BrghtTech Solutons here. Need our usual 500 glossy cards by Friday"* → engine resolves the typo to the existing account with high confidence → **human chooses** Attach vs. New; a truly new company is flagged as no-match | `features.test.mjs` — "fuzzy-matches a typo'd existing customer", "flags a genuinely new company" |
| **3. Job going late** | `/jobs/7` is pre-seeded late (due 2 days ago, still PRINTING). It is red on every board, `LATE` on the detail page, `CRITICAL` in the risk engine, counted in the Owner Daily Briefing, and "Draft an apology message for Singh & Sons delay" produces a copy-paste customer update | `features.test.mjs` — "Risk Analysis flags late jobs", "Copilot … communication drafting" |

---

## 📏 The intake eval — how extraction quality is measured, not asserted

A rules-based extraction engine rots silently: someone tweaks a regex, one product family
starts mis-quoting, and nothing fails because the unit tests only cover the happy demo
string. `tests/eval-intake.mjs` is the guard rail, and it is **scored**, not a test that
asserts the engine does whatever the engine currently does.

16 messy messages (Hinglish, typos, no-quantity, multi-line-item, brand-new companies)
each carry **hand-labelled ground truth** — what a human in the shop would read out of
them — written before looking at engine output. 62 field assertions are scored per axis:

```
  Customer identity    ████████████████████ 16/16  100%
  Company name         ████████████████████ 3/3   100%
  Quantities           ████████████████████ 16/16  100%
  Line-item count      ████████████████████ 16/16  100%
  Priority             ████████████████████ 8/8   100%
  Contact details      ████████████████████ 3/3   100%
  OVERALL                                    62/62
```

Identity, quantities and line-item count must hold **100%** — those directly become a
customer record or a price. An overall percentage alone would be too forgiving: one
mis-read quantity is 98.4%, which sails past a 95% bar while still quoting a client the
wrong number.

**The gate is verified to have teeth.** Disabling the forward-quantity scan makes
`npm run eval` exit 1 with `Extraction quality regressed: Quantities 15/16, overall 98.4%`.
The eval found three real defects that shipped in the first version, all now fixed:

| Defect the eval caught | Before | After |
|---|---|---|
| Number separated from keyword by an adjective — *"100 corporate brochures"* | 50 brochures | 100 |
| Same, for large format — *"2 flex banners 6x3"* | 10 banners | 2 |
| Quantity stated *after* the item — *"brochures again, 1000 pieces"* | 100 | 1000 |
| Business suffixes outside the seed vocabulary — *"Blue Orchid Weddings"* | "Independent / Individual" | "Blue Orchid Weddings" |

A defaulted quantity is also surfaced to the user (`Quantity not stated for Visiting
Cards — using a default, confirm with the client`) rather than being quoted silently.

---

## 🚫 Explicit scope cuts (naming them is a feature)

- **No real WhatsApp/SMS/email integration** — message drafts are copy-paste from the UI.
  A WhatsApp Business webhook for intake is the natural v2.
- **No payment gateway** — the advance is a number (`paid_upfront`); reconciliation is a note.
- **No multi-tenant auth / JWT infra** — seeded role login for a 3-person internal tool,
  plus a Persona Switcher for demoing roles.
- **No file-storage pipeline for designs** — artwork status is tracked in the checklist and
  specs text, not uploaded.
- **No raw text-to-SQL** — the Copilot is a constrained intent router over safe read-only
  functions (see AI section b).
- **6 pipeline columns, not 11** — Confirmation, Design-approval, Finishing, QC are tracked
  as flags/checklist inside the 6 stages; the trade-off is documented in the data model.
- **Prisma schema kept as documentation** — runtime is `better-sqlite3` with explicit SQL.
- **No live LLM key in this repo** — the provider seam in `src/lib/llm-provider.mjs` is
  implemented, tested with a mock provider, and wired into `/api/ai/parse-lead`, but ships
  unconfigured. Set `SHYFT_LLM_API_KEY` to use it; unset, the deterministic engine does all
  the work and nothing calls the network. No key is committed, deliberately.

---

## 🔭 What I'd build next with two more weeks

1. A real WhatsApp Business API webhook: inbound messages become draft jobs automatically.
2. LLM provider behind the existing seam (`ai-engine.mjs` is already four pure functions)
   with the same human-in-the-loop confirmations — no framework needed.
3. Vector/fuzzy search across customers and notes (typos, nicknames, "the wedding people").
4. Smart quote suggestions from similar past jobs, and photo-of-handwritten-order OCR intake.
5. Real-time multi-device sync (the shop currently shares one laptop + phones).

---

## 🤝 AI tool usage disclosure

This project was built with the Arena.ai Agent Mode assistant under the supervision of the
candidate. The full collaboration log lives in the session transcript; an organized
summary — including decisions where AI suggestions were **rejected or changed** — is in
[`AI_CHAT_HISTORY.md`](AI_CHAT_HISTORY.md). Runtime verification results (freshly
re-measured, not restated) are in [`VERIFICATION_REPORT.md`](VERIFICATION_REPORT.md).

---

## 📁 Project structure (highlights)

```
src/lib/pipeline.mjs      # canonical pipeline + per-stage owner model (single source of truth)
src/lib/ai-engine.mjs     # intake parser (fuzzy matching + scored extraction), risk, repeat
                          # orders, re-engagement nudges, daily briefing, Copilot intent router
src/lib/llm-provider.mjs  # the provider seam: offline by default, fills gaps, never sets prices
src/lib/pricing.mjs       # canonical ₹ rate table — the only place money is priced
src/lib/db.mjs            # SQLite access layer (explicit SQL)
src/app/                  # dashboard (per-role) · pipeline board · customer 360 · job detail
src/components/           # PipelineBoard, MessyLeadModal, RepeatOrderModal, AssistantWidget, …
src/scripts/seed.js       # 3 users · 12 customers · 27 jobs · idempotent, DB_PATH-aware
tests/features.test.mjs   # 11 tests — engine + data model + the three brief scenarios
tests/llm-seam.test.mjs   # 8 tests — provider seam invariants (mocked, no network)
tests/eval-intake.mjs     # 62 hand-labelled assertions with a hard regression gate
tests/render.test.mjs     # 6 tests — login/session/redirect smoke against a live server
.github/workflows/ci.yml  # build + tests + eval + smoke + npm audit on every push/PR
```

*Built with domain empathy for a commercial print shop — turning fragmented WhatsApp chats
and tribal knowledge into one pipeline where every job has a stage, an owner, and a paper
trail.*
