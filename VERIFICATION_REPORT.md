# Shyft Studio — Claim Verification Report

**Date:** 8 Sep 2026 · **Branch:** `arena/01a07fff-shyft-studio` · **Commit base:** `640ccf1`

Every line below was produced by running a command in this repo this session. Nothing here is
restated from the pitch document or the README without being re-measured.

---

## 1. The "Verification Summary" — re-run from scratch

`node_modules` was **absent** on arrival, so none of these could run as-delivered. `npm install`
initially failed: `better-sqlite3` needs a native build and node-gyp could not reach
`nodejs.org` for headers. Node headers are present locally at `/usr/local/include/node`
(matching v22.22.3), so the install was unblocked with:

```bash
npm install --nodedir=/usr/local
```

| Claim | Command | Actual result | Verdict |
|---|---|---|---|
| 4/4 passing | `npm test` | `# pass 4  # fail 0` | ✅ **TRUE** |
| 6/6 passing | `npm run test:deploy` | `# pass 6  # fail 0` | ✅ **TRUE** |
| 19/19 routes compiled | `npm run build` | `✓ Generating static pages (19/19)`, route table lists exactly 19 entries | ✅ **TRUE** |
| Server on port 3000 | `npm start` | Was **not** running on arrival; started it, listening on `0.0.0.0:3000` | ⚠️ **True only after I started it** |

`npm run test:deploy` requires a live server on :3000 — it is not self-contained.

---

## 2. Financial figures — exact match

From the app's own `getPipelineMetrics()` and confirmed live over `POST /api/ask`:

| Figure | Pitch doc | Measured | Verdict |
|---|---|---|---|
| Active pipeline value | ₹79,980 | `pipelineValue: 79980` — live answer: *"Active Pipeline Value: ₹79,980 (7 active jobs)"* | ✅ exact |
| Realized delivered revenue | — | `realizedRevenue: 17000` | ✅ |
| At-risk / overdue revenue | — | `lateRevenue: 15600` (1 job) | ✅ |
| Average ticket size | — | `averageTicketSize: 11426` | ✅ |

9 jobs, 5 customers, 3 users (OWNER / SALES / PRODUCTION) in the seeded DB.

---

## 3. Feature claims that hold up

All verified by reading the code and/or hitting the running server:

- **All 4 AI endpoints** respond correctly: `GET /api/ai/risk-analysis`, `POST /api/ai/parse-lead`,
  `POST /api/ai/repeat-order`, `POST /api/ask`.
- **Messy-lead parsing** — "bhaiya 500 visiting cards … 300gsm … gold foil for Nexus Media" →
  company `Nexus Media`, priority `high`, `quoteAmount: 2500`, specs summary extracted. ✅
- **Repeat order** for customer 1 → reference Job #1 (`DELIVERED`, ₹12,800) → new `QUOTED` job ₹12,800. ✅
- **Risk engine** returns all four levels (`LOW, MODERATE, HIGH, CRITICAL`); Job #7 "Visiting Cards —
  Client Delivery" (Singh & Sons) is `CRITICAL` with reason *"Paper stock dependency flagged in notes."* ✅
- **3 bottlenecks** detected: `PRINTING`, `DESIGN`, `DELIVERY`. ✅
- **4 pipeline lenses** exist — 🌐 All Jobs / 💼 Sales / ⚙️ Production Floor / 👑 Owner-Revenue.
  Note: they live in `src/components/PipelineBoard.tsx`, **not** `src/app/jobs/page.tsx`. ✅
- **Pre-flight checklist** — all 6 labels match the doc word-for-word. ✅
- **Checklist persistence + audit trail** — verified end-to-end: toggling "Offset / Digital Print Run
  Completed" on Job #6 wrote `checklist` to SQLite *and* inserted an `activities` row
  (`Completed task: "Offset / Digital Print Run Completed"`, `by_user_id: 2`). ✅
- **1-click ingestion** — verified end-to-end: created Job #10 + customer #6 with
  `lead_source: "AI WhatsApp Parser"`. ✅ *(Demo DB was backed up and restored byte-for-byte
  afterwards — md5 `98ff917f14d4aeefbb05c60f83c7f971` before and after.)*
- **HTTP 303 proxy-safe redirects** — `redirectAfterPost()` returns 303 with a root-relative
  `Location`; asserted by the deploy suite against `X-Forwarded-Host`. ✅
- **Role-based copilot chips** — `promptsByRole` with OWNER / SALES / PRODUCTION keys. ✅
- **Role-specific dashboards** — Owner (Bottleneck Radar, Team Workload Split, LTV Leaderboard),
  Sales (Unquoted Enquiries, Leads Needing Follow-up incl. **Priya Nair**), Production
  (Print Floor Priority Queue, Paper & Machine Alerts). ✅
- **DB integrity** — `PRAGMA foreign_keys = ON`, FKs on jobs/notes/activities, and trigger
  `trg_jobs_updated_at`. ✅
- **AI latency** — warm: `parseMessyLead` 0.19 ms, `analyzeProductionRisks` 1.35 ms,
  `processCopilotQuery` 1.05 ms, `generateRepeatOrderPackage` 0.44 ms. The `<15ms` claim holds
  warm; the cold first `parseMessyLead` call measured **15.10 ms**. ✅

---

## 4. Claims that do NOT hold — fix these before the interview

### 4.1 ❌ "Clean adapter pattern that can swap in Claude/OpenAI when API keys are configured"
**False. Nothing like it exists.** A grep for `anthropic|openai|claude|API_KEY|apiKey|adapter|process.env`
across `src/` returns **zero** matches in `ai-engine.mjs`. There is no provider abstraction, no API-key
check, no outbound LLM call. `ai-engine.mjs` is 502 lines of deterministic regex/heuristics exporting
4 pure functions. `.env` contains only `DATABASE_URL`.

This claim originated in **README.md line 82**, which I have corrected in this session. The honest
framing is actually still strong: four pure functions with no I/O *are* a clean seam — say "this is
where a provider would go", don't say "it's already swappable".

### 4.2 ❌ "Delay Mitigation Protocol: step-by-step recovery actions for overdue jobs"
No panel or feature by that name exists (`grep -rn "Mitigation" src/` → no matches). The real
capability is the risk engine's per-job `recommendations[]` array plus the copilot's apology draft.
Both are genuinely good — just don't name a UI panel that isn't there.

### 4.3 ❌ Production view tracks "foil die availability"
`grep -rni "foil die" src/` → no matches. The Paper & Machine Alerts panel has exactly **3** items:
Paper Stock Delay (Job #7), Lamination Machine Queue (Job #6), 300gsm Art Card Stock: OK.
(Panel is titled **"Paper & Machine Alerts"**, not "Paper Stock & Machine Alerts".)

### 4.4 ⚠️ "Live pre-flight progress bars (4/6 tasks done)"
The seeded state for **both** Job #6 and Job #7 is **3/6 done** (art ✅ stock ✅ proof ✅; print ⬜
finish ⬜ qc ⬜). The doc's checklist listing also shows only 2 of 6 ticked. If you narrate "4/6"
while pointing at a screen showing 3/6, that's a visible mismatch — either say 3/6, or tick one box
live and let the number change.

### 4.5 ⚠️ Stack description mentions Prisma implicitly
`prisma/schema.prisma` and the `db:push` / `db:seed` scripts exist, but **zero** `prisma` imports
appear in `src/`. Runtime is `better-sqlite3` reading `DB_PATH` → `db.sqlite`. The `.env` value
`DATABASE_URL="file:./dev.db"` is a Prisma leftover that points at a file that isn't used. Don't
describe the stack as Prisma-backed.

### 4.6 ⚠️ `next@14.2.0` has a published security advisory
`npm install` warns: *"This version has a security vulnerability"* (see nextjs.org/blog/security-update-2025-12-11),
and `npm audit` reports 2 vulnerabilities (1 high, 1 critical). Fine for a demo; don't pitch it as
production-ready without mentioning the upgrade path.

---

## 5. Reproduce

```bash
cd Shyft-Studio
npm install --nodedir=/usr/local     # native build needs local node headers
npm test                             # 4/4
npm run build                        # 19/19 routes
npm start                            # 0.0.0.0:3000
npm run test:deploy                  # 6/6 (needs the server above)
```
