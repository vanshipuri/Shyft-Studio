# AI Collaboration Log & Engineering Process — Shyft Studio

**Session:** Arena.ai Agent Mode · **Branches:** `arena/01a080c2`→`arena/01a081a8` (one session per working day)
**Role:** AI Engineer Intern submission · **Candidate:** Vanshi · **Date:** 8 Sep 2026

This log is the organized version of the Arena session transcript required by the
submission. It is grouped by day/feature, and it deliberately includes the moments where
the AI suggested something and the **candidate rejected or changed it** — the brief asks
explicitly for evidence of that.

---

## Day 1 — Problem framing, data model, foundation

### 1.1 Initial AI suggestion — "make it a generic Kanban CRM with tags"
The assistant first proposed a standard board: *statuses `todo / doing / done`, free-text
assignee, labels, and a dashboard with cards.* 

**What was rejected & why:** a generic board does not model a print shop. It has no notion
of *who owns the next step*, no *quote → proof → print → finishing* reality, and no way to
answer "is this late?" from the data alone. We rejected the generic status model and
instead committed to:
- a **domain pipeline** (Enquiry → Quoted → Design → Printing → Ready → Delivered), and
- **ownership as a derived, first-class column**, not free text.

### 1.2 AI suggestion — "use Postgres + Prisma + full auth on day 1"
The assistant pushed a hosted Postgres/Prisma stack with JWT auth to look "production
ready".

**What was rejected & why:** a 3-person internal tool and a 3-day demo don't need a
database service, migrations on every change, or an auth framework. We kept **SQLite
(`better-sqlite3`) with explicit SQL** (zero-ops, inspectable, committed seed) and
**cookie sessions with seeded role accounts**. Prisma remains only as a reference schema.
This is a scope cut we state out loud in the README rather than pretend it is an
oversight.

### 1.3 Data-model negotiation — the 11-stage pipeline
The AI (following an external playbook) proposed an 11-stage pipeline: Inquiry → Quoted →
Confirmed → Design → Design Approved → In Production → Finishing → QC → Ready for Delivery
→ Delivered → Payment Settled → Follow-up.

**What we changed:** we kept **6 board columns** because a 6-column kanban is what the
demo can actually show on one screen, and mapped the finer stages onto first-class data
instead of columns: advance payment → `paid_upfront`, design approval/finishing/QC → the
6-step pre-flight checklist inside Printing, delivery follow-up → the re-engagement cadence
engine. Every lost "stage" is still a tracked fact somewhere — nothing vanished into a
note. Documented in README § Data model.

### 1.4 Ownership model — the core decision
**AI first draft:** `jobs.assigned_to` set once at creation ("Abhishek owns this job") —
simple, but wrong the moment the job hits the press.

**Rejected in favour of:** stage-derived ownership. `src/lib/pipeline.mjs` is the single
source of truth mapping every stage to its owner role (Enquiry–Design → Sales, Printing–
Ready → Production, Delivered → Sales for payment/follow-up). The stage-transition API
auto-reassigns the job to the stage owner and writes the handoff to the audit trail. This
directly answers the team's complaint: *"Nobody flagged it, wasn't clear whose job it
was."*

### 1.5 Seed data
We seeded 3 users, 12 customers (regulars, one-offs, dormant regulars, a deliberately
silent repeat customer), and 27 jobs across a **multi-month order history** — including one
intentionally late job (Singh & Sons, #7) and customers whose own cadence makes them due
for a check-in. Dates are generated relative to seed time so the demo stays coherent.

---

## Day 2 — Core UX

### 2.1 Messy intake parser — three prompt/rule iterations (kept to show refinement)
- **v1 (naive regex):** keyword-spotting only. Extracted clean sentences fine but fell
  over on typos and Hindi-English mixes.
- **v2 (add-on heuristics):** greedy lookahead for company words. Introduced a real bug —
  the word `studio` matched *inside* `Studios` and captured the rest of the sentence as the
  customer name ("s new cafe launch this weekend").
- **v3 (shipped):** word-bounded company keywords + a typo-tolerant **fuzzy matcher**
  (bigram similarity over 1–3 word windows) against existing accounts. Result: the parser
  either resolves to a real customer with a confidence level, or honestly reports *no
  match* — it never guesses a person's identity (see 2.2).

### 2.2 AI suggestion — hard-code "if text mentions 'apex', create Rohan Mehta"
The assistant had special-cased two demo strings, inventing a contact name for a company
("Apex Media Tech → Rohan Mehta") and a person for a first name ("priya → Priya Nair").

**What was rejected & why:** that is exactly the kind of fabricated identity a production
parser must never ship. We deleted both hard-codes. Priya resolves through a real seeded
account match; Apex-style text resolves as "company + Contact placeholder" with a clear
`no match`. The UI then asks a human to confirm before anything is created.

### 2.3 AI suggestion — silently create the customer when the parser matches
**Rejected.** The parser result is always human-confirmed: the modal shows *Matched
existing account — high confidence (fuzzy similarity)* with an explicit **Attach to
existing account / Create new account instead** toggle. Nothing touches the database until
a person clicks "Create Enquiry in Pipeline". This is the human-in-the-loop safety
decision we call out in the README and would call out in an interview.

### 2.4 Repeat orders & customer 360
Built 1-click repeat order generation from the customer's last delivered job (specs +
price + artwork status) and a customer profile page with full order history, LTV, AOV, and
communication log — the direct answer to "took three phone calls just to confirm."

---

## Day 3 — AI layer, polish, verification

### 3.1 NL Copilot — AI suggestion "just let an LLM read the SQLite file / text-to-SQL"
**Rejected.** We built the Copilot as a **constrained intent router**: a fixed set of
safe, read-only handlers (financials, risk, customer history, late jobs, drafts,
re-engagement, briefing, unquoted leads) with a graceful fallback. No user text ever
becomes SQL or triggers a write. This mirrors function-calling allow-lists and is the
security posture we would defend in the follow-up call.

### 3.2 Proactive re-engagement
Built cadence learning per repeat customer (average gap between completed orders). If a
repeat customer is silent past their own window and has no open job, they surface on the
Sales dashboard and in Copilot. Customers with open jobs are never nagged. AI proposed
flagging anyone older than 30 days; **we rejected a flat threshold** in favour of
per-customer cadence (with a 60-day fallow floor for very slow cycles) so a genuinely
two-month-cycle client isn't nagged after four weeks.

### 3.3 Daily briefing
AI proposed an LLM paragraph. **We shipped deterministic formatting first** (live counts →
headline + bullets per role) — cheaper, exact, testable — and note LLM polish as the
obvious next step behind the same function.

### 3.4 Scenario stress-tests (the brief's three scenarios)
Run as automated tests + live walkthroughs (details in README § How the three scenarios
were tested):
1. Repeat order under ~15 seconds — ✅ (`generateRepeatOrderPackage`, customer profile UI)
2. Messy enquiry with a typo'd name — ✅ resolves to existing account with confidence,
   human chooses attach-vs-new; new companies flagged no-match
3. Job going late — ✅ auto-flags on dashboards, CRITICAL risk, apology-draft generated

### 3.5 Verification (measured this session, not restated)
`npm test` → 11/11 · `npm run build` → 19/19 routes · live deploy smoke → 6/6 · auto-owner
handoff verified end-to-end on a throwaway DB copy. Full numbers: `VERIFICATION_REPORT.md`.

---

## Day 3 — UI/UX & Copilot polish pass

**Branch:** `arena/01a080df-shyft-studio` (follow-up pass on the merged submission).
Follow-up request: *"make it smooth, responsive, and even [polished] — especially the
chatbot."* Functional coverage was already green (11/11, 19/19), so this pass was
presentation and feel only — **no AI-engine or route behaviour changed**, re-verified
after every step.

### 4.1 One responsive shell instead of five hand-written headers
Every page duplicated its own sticky header (brand + nav + quick actions + logout) with
desktop-only links that overflowed on phones.

**Decision (and the thing we rejected):** rather than adding a heavy component/animation
library, we built one small client `TopNav` (`src/components/TopNav.tsx`) used by all five
pages. On `lg+` it shows quick actions + nav inline; below that it collapses to a hamburger
sheet containing the same actions. Page titles moved into consistent "eyebrow + title +
count badge" heroes inside each `<main>`, so the sticky bar stays uniform across Dashboard,
Pipeline, Customers, and both detail pages. Headers now breathe on mobile (`px-4 sm:px-6`,
stacked grids, kanban columns with responsive min-heights instead of a fixed 500px).

### 4.2 Animation utilities that actually exist
The codebase was calling `animate-in fade-in zoom-in-95 duration-200` everywhere, but no
`tailwindcss-animate` plugin is installed — those classes compiled to nothing, so modals
and panels appeared/disappeared with zero transition.

**Decision:** hand-rolled a tiny motion layer in `globals.css` (fade / rise / drop /
enter / bubble-in keyframes with cubic-bezier easing, typing dots, status ping, exit
animation) and replaced the dead class names. No new dependency.

### 4.3 Modals escaped their ancestors (portal fix)
The lead-intake, repeat-order, and persona-tour modals render inside the sticky blurred
header. `backdrop-filter` ancestors can trap `position: fixed` descendants, and duplicating
the modals into the mobile menu would have made that worse.

**Decision:** all three modals now render through `createPortal(…, document.body)` —
they always sit on top, never clipped by the header, and it is now safe to mount them in
both the desktop bar and the mobile menu.

### 4.4 Copilot chat rebuilt for feel
`AssistantWidget` was rewritten:
- **Responsive:** bottom-sheet on phones (82dvh, slide-up, tap-away backdrop) vs a floating
  400px+ card on desktop (fade/scale in). FAB hides while open; Esc closes; iOS safe-area
  respected in the composer.
- **Smooth:** auto-scroll-to-latest with `scrollIntoView`-style smooth scrolling, animated
  bubble entrances, real typing-dots indicator ("Pulling live pipeline data…") instead of a
  static ping, exit transition before unmount, auto-growing textarea (Enter sends, Shift+Enter
  newlines).
- **More even typography:** markdown-lite rendering now groups consecutive bullets into one
  `<ul>` and numbered lists into `<ol>` (the old renderer emitted orphan `<li>`s), proper
  numbered badges, blockquotes, `<hr>`, headings; user/AI text is HTML-escaped before inline
  bold/italic/code highlighting.
- **Helpful:** per-role welcome + suggested chips shown until the first real question,
  timestamps under bubbles, and a "Retry last question" affordance after a network error.

### 4.5 What we rejected along the way
- Adding `framer-motion` / `tailwindcss-animate` just to animate a few panels — pure CSS
  keyframes cover it at zero install cost.
- Rebuilding the board as drag-and-drop — the existing optimistic stage-move logic is
  correct and tested; we only made its columns responsive.
- Persisting chat across pages with a global store — out of scope for this pass; the widget
  resets per page the same way it always did.

### 4.6 Verification (unchanged feature surface)
`npm test` → 11/11 · `npm run build` → 19/19 routes · all pages smoke-tested over HTTP as
OWNER/SALES/PRODUCTION (200s) after the rebuild.

---

## Day 3 — Pre-submission audit (running the checklist, not the feature list)

The brief's own checklist item — *"run the 3 scenarios and they work"* — was executed as a
human would: log in as each role, paste a messy enquiry, ask the Copilot plain questions,
click repeat order. Note the test count grew across the build (11 → 19 → 21); the per-day
numbers above are historical snapshots, not a contradiction.

### 5.1 AI flagged a committed `.env` — the one item the checklist actually failed
`git ls-files | grep env` showed `.env` tracked, and `.gitignore` had no rule for it. Its
contents were a stale `DATABASE_URL` pointing at a file the app never reads (`db.mjs` uses
`DB_PATH` → `./db.sqlite`), so nothing sensitive leaked — but "no .env in the repo" was a
stated requirement and a reviewer would grep for it. **Action:** untracked it, extended
`.gitignore` to `.env*`, left `.env.example` as the only committed reference. A one-line
"no real credentials were ever committed" note went in the README so the fix is visible
rather than silent.

### 5.2 Candidate pushed back on scope, correctly
The natural next move was "the parser mislabels flyers as Brochures, rewrite the extraction
layer". Rejected: `/brochure|pamphlet|flyer|leaflet/` collapsing into one priced family is a
deliberate modelling decision the eval is labelled against, and restructuring it the night
before a deadline is how you trade a non-bug for a broken demo. Same reasoning killed a
proposed per-clause message segmenter. **Rule adopted for this pass: fix what is wrong, not
what is merely crude** — and write down what stayed crude (now two bullets in *Explicit
scope cuts*).

### 5.3 Two defects that only a user would hit
- **Copilot recall.** `what should i (focus|do|prioritize)` was the entire briefing intent,
  so *"what should Abhishek work on today"* fell through to the generic help menu. A
  constrained router is the right architecture; it just has to recognize ordinary English.
  Bonus behaviour the candidate asked for: naming a teammate switches the lens, so the Owner
  asking about Siddhant gets the *production* brief.
- **Dropped finish.** Cards honoured `matte`; brochures hard-coded gloss. A client who
  specified matte got a gloss line item and nothing said so.
  AI initially wanted to add a matte price tier — rejected as fabricating a rate the shop
  doesn't charge. Final shape: correct the **label**, keep the **price** untouched, and push
  genuinely-unpriced specs (`double sided`) to `missingInfo` for a human.

### 5.4 Verification (measured, post-fix)
`npm test` → **21/21** · `npm run eval` → **62/62, 0 failures** (deliberately re-run: a
parser edit that leaves the eval untouched is the evidence that no quote drifted) ·
`npm run build` → 19 routes, 0 TS errors · `npm audit` → 0 · `test:deploy` → 6/6 ·
6 routes × 3 roles → 18/18 HTTP 200 · unauthenticated `/dashboard` → 307 `/login`.
Also confirmed live: `https://shyft-studio-dfc3.onrender.com` serves the login page.

### 5.5 Submission packaging decisions
- The README previously had **no live URL in it** — a reviewer arriving via GitHub had no
  way to click through. Added a demo block with all three logins up top.
- `npm run seed` added as an alias of `db:seed` so the checklist's literal command works.
- Render's free tier resets SQLite on redeploy; the demo therefore boots from the committed
  `db.sqlite`. Documented as a limitation instead of being left for a reviewer to discover.

---

*This document is part of the submission per the "What to submit" requirements; the raw
session transcript remains available in the Arena platform.*
