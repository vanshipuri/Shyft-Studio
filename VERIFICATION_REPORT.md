# Shyft Studio — Claim Verification Report (re-run 8 Sep 2026)

**Branch:** `arena/01a08154-shyft-studio` · **Method:** every line below was produced by
running a command in this repo this session. Nothing is restated from the pitch without
being re-measured.

---

## 1. Test suites, build & supply chain

| Claim | Command | Actual result | Verdict |
|---|---|---|---|
| Test suites green | `npm test` | `# tests 19 · # pass 19 · # fail 0` (11 engine/data-model + 8 LLM-seam) | ✅ |
| Intake eval clean | `npm run eval` | `OVERALL 100.0% (62/62 field assertions) · Cases: 16 · failures: 0` | ✅ |
| Eval gate has teeth | `npm run eval` with the forward-quantity scan disabled | exit **1**, `Extraction quality regressed: Quantities 15/16, overall 98.4%` | ✅ |
| Production build clean | `npm run build` | Next.js 16.3.4 (Turbopack), all 19 routes compile, 0 TS errors | ✅ |
| No known vulnerabilities | `npm audit` | `found 0 vulnerabilities` (was 1 critical + 1 high on Next 14.2.0) | ✅ |
| Deploy/proxy smoke green | `TEST_BASE_URL=http://127.0.0.1:3000 npm run test:deploy` | `# pass 6 · # fail 0` | ✅ |
| All routes serve all roles | cookie session + GET `/dashboard /jobs /customers /customers/1 /jobs/1 /jobs/7` × samyak, abhishek, siddhant | **21/21 `200`**, no error markers in HTML | ✅ |

## 2. Seed data (idempotency, measured)

`src/scripts/seed.js` now respects `DB_PATH` and **drops and rebuilds** its tables, so it
can no longer append duplicates. Measured by seeding the same file twice:

```bash
DB_PATH=/tmp/seed-test.sqlite npm run db:seed   # → 3 users · 12 customers · 27 jobs · 5 notes · 30 activities
DB_PATH=/tmp/seed-test.sqlite npm run db:seed   # → 3 users · 12 customers · 27 jobs · 5 notes · 30 activities
```

Identical on both runs. Previously the second run silently duplicated every customer and
job — the footgun `render.yaml` used to have to warn about.

## 3. Pipeline financials (computed from the app's own functions)

`analyzeProductionRisks()` → `lateCount: 1`, `bottlenecks: 3`.
`generateDailyBriefing("OWNER").counts` →

```json
{"atRisk":1,"late":1,"overdueCheckIns":2,"agingEnquiries":1,"agingQuotes":0,
 "pipelineValue":98780,"activeJobs":10}
```

`computeReengagementNudges()` → 2 nudges (Meera Shah / Urban Nest, Arjun Mehta /
Grandline Hotels); Neha Desai, Anjali Kapoor and Farhan Ali correctly excluded because
they have open jobs.

## 4. Extraction quality (the eval, measured)

16 hand-labelled messy messages, 62 field assertions:

| Axis | Score |
|---|---|
| Customer identity | 16/16 |
| Company name | 3/3 |
| Quantities | 16/16 |
| Line-item count | 16/16 |
| Priority | 8/8 |
| Contact details | 3/3 |

Defects found and fixed while writing the eval (each is now a labelled case):

| Message | Before | After |
|---|---|---|
| "…and 100 corporate brochures…" | 50 | 100 |
| "hey 2 flex banners 6x3…" | 10 | 2 |
| "…brochures again, 1000 pieces…" | 100 | 1000 |
| "…from Blue Orchid Weddings…" | "Independent / Individual" | "Blue Orchid Weddings" |

## 5. LLM provider seam (measured, offline)

No key is committed. Verified with `SHYFT_LLM_API_KEY` unset, against the **live server**:

```
POST /api/ai/parse-lead {"text":"hi need 500 cards for the launch event"}
→ company: "Independent / Individual", quoteAmount: 1250
→ enrichment: {"applied": false,
               "reason": "SHYFT_LLM_API_KEY is not set — running on the deterministic engine"}
```

So the seam is wired into the request path and demonstrably makes no network call. The
three invariants are covered by `tests/llm-seam.test.mjs` with a mock provider (8 tests,
no network): the provider cannot change `quoteAmount` or `items`; it cannot re-identify an
already-matched account; a provider throw degrades to the deterministic result; and junk
output (non-strings, bad phone/email, oversized strings) is dropped.

## 6. Framework upgrade (Next 14.2.0 → 16.3.4)

Done to clear the advisories, not for novelty. `npm audit` on 14.2.0 reported **1 critical
+ 1 high**; every remaining Next advisory is fixed only in a major version, so 16.3.4 was
the only way to reach zero. Migration changes, all verified by the suites above:

- `cookies()` is now async → `await cookies()` at 11 call sites.
- Dynamic `params` is now a `Promise` → `await params` in `/customers/[id]`, `/jobs/[id]`.
- Three page components became `async`.
- Turbopack is the default bundler; the old `webpack` `resolve.fallback` shim was removed
  rather than ported, because `better-sqlite3`/`fs`/`path` are only imported by server
  code. `next.config.js` now sets `turbopack: {}`.

## 7. Reproduce

```bash
npm ci --include=dev
npm run build          # 19 routes, Next.js 16 Turbopack
npm start              # 0.0.0.0:3000
npm test               # 19/19
npm run eval           # 62/62, exits 1 on regression
TEST_BASE_URL=http://127.0.0.1:3000 npm run test:deploy   # 6/6 (server running)
npm audit              # 0 vulnerabilities
```

CI runs exactly this on every push and PR to `main`
(`.github/workflows/ci.yml`), against a throwaway `DB_PATH` so the committed demo database
is never touched.
