# AI Collaboration Log & Engineering Process — Shyft Studio

**Session:** Arena.ai Agent Mode · **Branch:** `arena/01a080c2-shyft-studio`
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

*This document is part of the submission per the "What to submit" requirements; the raw
session transcript remains available in the Arena platform.*
