# AI Chat History — Summarized by Research Theme

**Submission:** AI Engineer Intern · **Candidate:** Vanshi · **Date:** 8 Sep 2026
**Companion to:** `AI_CHAT_HISTORY.md` (full day-by-day log) — this is the condensed
version, organized by the questions I actually researched with the AI, per the submission
tip: *"organize by day/feature, not one giant dump."* Where the AI suggested something I
rejected, it is marked **⚖️ REJECTED** — the brief explicitly evaluates *what you changed
or rejected*.

---

## 1. Decoding the real problem

**My prompt (paraphrased):** *"Samyak's team said these six things — Abhishek's phone is the
pipeline, no one knows where a job stands, no straight answer on delays, three phone calls
to confirm a repeat order, no one flagged whose job it was, catch the next order before
they ask. What is the actual system behind each complaint?"*

**What came out of it:** the six-quote → six-requirement mapping table that now opens the
README. The key AI-assisted insight: every quote is a *missing system*, not a missing
person — shared customer memory, stage visibility, deadline risk detection, repeat-order
lookup, first-class ownership, and cadence-based re-engagement. This table became the
acceptance filter: **any feature that didn't trace back to one of the six rows got cut.**

- ⚖️ **REJECTED:** the AI's first instinct to frame it as "a generic Kanban CRM with
  todo/doing/done columns." A generic board has no concept of *who owns the next step* or
  *quote → proof → print* reality, and can't answer "is this late?" from data alone.

## 2. Data model design

**My prompts:** *"Design a schema where ownership is never ambiguous"* → *"Do I need
JobStageHistory as a separate table?"* → *"11 pipeline stages or fewer?"*

**Decisions reached through the thread:**

- **Ownership is derived from the stage, not a free-text field.** The AI's first draft was
  `jobs.assigned_to` set once at creation. I pushed back: that's wrong the moment a job hits
  the press. Final design: `src/lib/pipeline.mjs` as single source of truth
  (Enquiry/Quoted/Design → Sales, Printing/Ready → Production, Delivered → Sales), with the
  transition API auto-reassigning and logging every handoff — directly answering *"it
  wasn't clear whose job it was."*
- **6 board columns instead of the AI's 11-stage pipeline.** The finer stages didn't vanish
  — they became first-class data elsewhere: advance payment → `paid_upfront`, design
  approval/finishing/QC → the pre-flight checklist, post-delivery → the re-engagement
  engine. Six columns is what fits on one demo screen.
- **Five tables total** (users / customers / jobs / notes / activities), with `activities`
  playing the audit-trail role of JobStageHistory — the unified feed that stops sales and
  ops being "two disconnected apps."
- ⚖️ **REJECTED:** AI's push for hosted Postgres + Prisma + JWT auth on day 1. A 3-person
  internal tool on a 3-day deadline needs zero-ops SQLite (`better-sqlite3`, committed
  seed, inspectable SQL) and seeded cookie-session role logins. Stated out loud in the
  README as a deliberate scope cut — not an oversight.

## 3. Features to include (and what to cut)

**My prompt:** *"Given 3 days, which features actually answer the six problems, and what's
decorative?"*

| Tier | Features | Verdict |
|---|---|---|
| **Core (shipped)** | Job pipeline with stage-derived owner · Customer 360 with full order history, LTV, AOV · per-role dashboards · late/at-risk flagging · unified activity feed · 1-click repeat order | All six map 1:1 to the quote table |
| **AI differentiators (shipped)** | Messy-intake parser (human-confirmed) · NL Copilot (constrained intent router) · per-customer re-engagement cadence · AI-drafted delay messages · Owner daily briefing | Answers *messy enquiry*, *NL questions*, *catch the next one* |
| **Deliberately cut (documented)** | Real WhatsApp/payment gateway · multi-tenant auth · raw text-to-SQL · per-clause message segmentation | Named as scope cuts in README §10 |

## 4. AI-feature safety decisions (the thread I'd defend in the follow-up call)

**Intake parser — 3 iterations kept to show refinement:**
1. **v1** naive regex keyword-spotting — broke on typos and Hindi-English mixes.
2. **v2** greedy lookahead — introduced a real bug (`studio` matching inside `Studios`,
   swallowing the sentence as a customer name).
3. **v3 (shipped)** word-bounded keywords + bigram fuzzy matcher that either resolves to a
   real account *with a confidence level* or honestly reports *no match*.

- ⚖️ **REJECTED:** AI hard-coding demo strings ("Apex Media Tech → Rohan Mehta"). That is
  fabricated identity — a production parser must never ship it. Deleted both hard-codes.
- ⚖️ **REJECTED:** silently creating the customer when the parser matches. Nothing touches
  the DB until a human clicks "Create Enquiry" — the human-in-the-loop decision.

**NL Copilot:**
- ⚖️ **REJECTED:** AI's "just do text-to-SQL / let the LLM read the SQLite file." Built a
  **constrained intent router** instead — a fixed allow-list of safe read-only handlers
  with graceful fallback. No user text ever becomes SQL or triggers a write. This is the
  security posture call the playbook says to state out loud.

**Re-engagement:**
- ⚖️ **REJECTED:** flat 30-day inactivity threshold. Shipped **per-customer cadence
  learning** (avg gap between that customer's orders, 60-day floor for slow cycles) so a
  genuine two-month-cycle client isn't nagged at week four — and never nag customers with
  open jobs.

**Daily briefing:**
- ⚖️ **CHANGED:** AI proposed an LLM paragraph. Shipped **deterministic formatting first**
  (live counts → headline + bullets per role) — cheaper, exact, testable — with LLM polish
  noted as the next step behind the same function.

## 5. Verification thread — the brief's 3 scenarios, run literally

**My prompt:** *"Turn the brief's three test scenarios into automated proof, not vibes."*

1. **Repeat order < 15 s** ✅ — `generateRepeatOrderPackage` + 1-click RepeatOrderModal.
2. **Messy enquiry with a typo'd name** ✅ — fuzzy-matches the existing account with a
   confidence flag; human chooses attach-vs-new; unknown companies honestly report no-match.
3. **Job going late** ✅ — auto-flagged on Owner + Production dashboards, CRITICAL risk,
   apology draft generated.

Final measured state: `npm test` **21/21** · intake eval **62/62** · build **19 routes** ·
deploy smoke **6/6** · 18/18 role×route HTTP 200 · `npm audit` 0. The pre-submission audit
also caught and fixed a tracked `.env` (untracked + `.gitignore` extended — the one
checklist item that genuinely failed).

## 6. Where I pushed back — greatest hits

The single most quotable moments for the follow-up call:

| AI suggested | I shipped instead | One-line why |
|---|---|---|
| Generic Kanban CRM | Domain pipeline + stage-derived ownership | Print shop ≠ todo board |
| Postgres + Prisma + JWT, day 1 | SQLite + explicit SQL + cookie sessions | Zero-ops beats resume-driven setup at 3-day scope |
| 11 pipeline stages | 6 columns, finer stages as data | One screen, nothing lost to notes |
| Hard-coded parser matches | Fuzzy matcher + honest "no match" | Never fabricate identity |
| Silent auto-create | Human-confirmed modal | Human-in-the-loop is the safety story |
| Raw text-to-SQL | Constrained intent router | Security over demo flash |
| Flat 30-day re-engagement | Per-customer cadence | Nagging on the wrong cycle loses regulars |
| LLM-written briefing | Deterministic first, LLM polish later | Exact and testable beats plausible |
| "Fix" flyer→brochure collapsing pre-deadline | Kept the labelled modelling decision | Fix what's wrong, not what's merely crude |

---

*Raw session transcripts remain available in the Arena platform; this summary plus
`AI_CHAT_HISTORY.md` constitute the organized chat-history submission.*
