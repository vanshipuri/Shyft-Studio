# Shyft Studio — Claim Verification Report (re-run 8 Sep 2026)

**Branch:** `arena/01a080c2-shyft-studio` · **Method:** every line below was produced by
running a command in this repo this session. Nothing is restated from the pitch without
being re-measured.

---

## 1. Test suites & build

| Claim | Command | Actual result | Verdict |
|---|---|---|---|
| Feature suite green | `npm test` | `# tests 11 · # pass 11 · # fail 0` (4 original + 7 playbook-aligned) | ✅ |
| Production build clean | `npm run build` | `✓ Generating static pages (19/19)`; all routes compile, 0 TS errors | ✅ |
| Deploy/proxy smoke green | `TEST_BASE_URL=http://127.0.0.1:3000 npm run test:deploy` (server via `npm start`) | `# pass 6 · # fail 0` | ✅ |
| All 6 app routes return 200 for all 3 roles | cookie session + GET `/dashboard /jobs /customers /customers/1 /jobs/1 /jobs/7` for samyak, abhishek, siddhant | 21/21 `200 ok`, no application errors in HTML | ✅ |

## 2. Seed data (fresh regeneration)

```bash
rm -f db.sqlite && npm run db:seed
```
→ **3 users · 12 customers · 27 jobs · 5 notes · 30 activities**
(stage counts: ENQUIRY 2 · QUOTED 3 · DESIGN 1 · PRINTING 3 · READY 1 · DELIVERED 17).

## 3. Pipeline financials (computed from the app's own functions)

| Figure | Value |
|---|---|
| Active pipeline value (10 active jobs) | ₹98,780 |
| Realized delivered revenue (17 jobs) | ₹198,300 |
| Revenue at late risk | ₹15,600 (1 job — Singh & Sons #7) |
| Quoted pipeline | ₹29,600 |
| Average active ticket | ₹9,878 |
| Customer LTV top accounts | BrightTech ₹45,000 · City Events ₹44,900 · Vihaan ₹34,880 · Grandline ₹33,000 · Joshi ₹28,800 · Kayra ₹28,600 · Reddy ₹27,000 |

## 4. Ownership model (measured)

- `pipeline.mjs`: all 6 stages map to exactly one owner role (SALES ×4 incl. Delivered
  follow-up, PRODUCTION ×2).
- End-to-end simulation of `/api/jobs/update-stage` on a **throwaway DB copy** (the
  committed demo DB was not mutated):
  - Job #3 DESIGN owned by Abhishek (SALES) → moved to PRINTING → **auto-owned by
    Siddhant (PRODUCTION)**.
  - PRINTING → READY keeps Siddhant.
  - READY → DELIVERED flips to Abhishek (SALES) for payment & follow-up.
- UI: Pipeline Board column headers show `👤 Owner: Sales/Production` per column; card
  footers show the current owner; the job stepper shows `Current: X · Owner: Y` plus the
  ownership-handoff legend; the audit trail records `Moved stage … — now owned by …`.

## 5. AI features (measured)

| Feature | Measured behaviour |
|---|---|
| **Messy intake — fuzzy typo match** | `parseMessyLead("…Neha from BrghtTech Solutons…")` → `match: {id:1, name:"Neha Desai", company:"BrightTech Solutions", confidence:"high", method:"fuzzy similarity"}`, `isNew:false`. Also confirmed live over `POST /api/ai/parse-lead`. |
| **Messy intake — no-match honesty** | `"…1000 posters for Zingaro Studios…"` → `company:"Zingaro Studios"`, `match:null`, `isNew:true` (contact placeholder, no invented identity). |
| **Parser regression (original demo)** | `"…gold foil for Nexus Media…"` → company `Nexus Media`, 2 line items, estimate ₹3,800, missing-info flags, suggested WhatsApp reply. |
| **Re-engagement nudges** | `computeReengagementNudges()` → Meera Shah / Urban Nest (119 days silent vs ~45-day cadence, HOT) and Arjun Mehta / Grandline Hotels (79 vs ~60). Neha Desai, Anjali Kapoor, Farhan Ali correctly **excluded** (they have open jobs). |
| **Daily briefing (OWNER)** | `"1 job(s) at risk, 2 repeat client(s) due for a check-in, 1 enquiry(ies) aging without a quote"`; counts `{atRisk:1, late:1, overdueCheckIns:2, agingEnquiries:1, pipelineValue:98780, activeJobs:10}`. Role variants verified for SALES/PRODUCTION. |
| **Copilot intents** | Briefing, re-engagement ("due for a check-in" / "who hasn't ordered in 60 days?"), unquoted leads (finds #5 Priya Nair + #27), customer 360 ("Neha from BrightTech order last time" resolves via scored matching), financials, apology/follow-up drafts — all answered via the constrained router. |
| **Stage transition validation** | `/api/jobs/update-stage` rejects unknown stages with 400 and missing ids with a redirect (deploy suite). |

## 6. Previously-flagged claims — status after this update

| Earlier issue | Status |
|---|---|
| README claimed an LLM "adapter" that didn't exist | Reworded (previous session) and now verified accurate: deterministic engine + stated provider seam, no API keys configured. |
| "Delay Mitigation Protocol" panel named but absent | Not named anywhere; real capability is risk `recommendations[]` + apology drafts + LATE badges. |
| Prisma described as runtime stack | Runtime is `better-sqlite3`; README now states Prisma is reference-only. |
| Seed too small for realistic demos (5 customers/9 jobs) | Expanded to 12 customers/27 jobs with multi-month history, dormant regulars, and a second inquiry queue. |

## 7. Reproduce

```bash
npm ci --include=dev --nodedir=/usr/local   # native better-sqlite3 build needs local node headers
npm run build                               # 19/19 routes
npm start                                   # 0.0.0.0:3000
npm test                                    # 11/11
TEST_BASE_URL=http://127.0.0.1:3000 npm run test:deploy   # 6/6 (server running)
```
