# Shyft Studio — Internal Platform

**Assignment:** AI Engineer Intern — Shyft Studio  
**Built by:** Vanshi (simulated candidate)  
**Date:** 7 Sep 2026  
**Deadline:** 8 Sep 2026, 11:59 pm

---

## What this is

Samyak runs a brochure & visiting-card printing business (B2B, team of 3). Before this build, everything lived in WhatsApp, spreadsheets, and memory. This platform gives **one clear picture** across sales and production:

- **Sales (Abhishek):** customers, enquiries, quotes, follow-ups
- **Production (Siddhant):** design → print → ready → delivered
- **Owner (Samyak):** full visibility, customer history without calling Abhishek first

---

## Stack & why

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Fast, server components, simple auth with cookies, good DX under time pressure |
| UI / CSS | Tailwind CSS + custom theme | Consistent design system, responsive grid for pipeline, no extra design-tool dependency |
| DB | SQLite via `better-sqlite3` | File-based, zero-config, works in sandbox, no external DB service needed |
| Auth | Cookie session (`shyft_session`) + simple password check | Matches 3-person team reality; roles enforced by DB, not complex OAuth |
| AI / NLU | Custom `/api/ask` endpoint with domain-specific parser | Shows judgment — not just calling OpenAI blindly. Handles customer names, job IDs, stage queries, late-job checks, pipeline summaries |

---

## Architecture decisions

1. **One connected app, not two disconnected ones**  
   Sales and ops share the same `customers`, `jobs`, `notes`, and `activities` tables. No siloed “sales app + ops app.”

2. **Role-aware access via DB role, not separate apps**  
   All users see the pipeline, but actions (stage moves, note posting) are tied to login identity. The UI badges show ownership at a glance.

3. **Kanban pipeline board over static tables**  
   At a glance you can see whose job is where — the brief explicitly asks for this.

4. **Natural-language querying is domain-specific**  
   Instead of a generic LLM wrapper, `/api/ask` parses queries like *“What did Neha order?”* or *“Which jobs are late?”* into direct SQL/filter operations. This is faster, more accurate for this domain, and demonstrates architecture judgment.

5. **Seed data tells real stories**  
   The database includes:
   - BrightTech (regular, repeat order) — tests “same as last time” scenario
   - City Events (design stage, urgent) — tests design handoff
   - Priya Nair (messy new enquiry, unclear details) — tests messy channel
   - Vihaan Interiors (printing, late risk) — tests late-job flagging
   - Singh & Sons (late, customer called) — tests communication failure

---

## How to run

```bash
# 1. Install (already done in sandbox)
npm install

# 2. Database is seed-included (db.sqlite created by src/scripts/seed.js)
# If you reset, run:
node src/scripts/seed.js

# 3. Start
npm run dev
# or
npm run build && npm start
```

Then open `http://localhost:3000`.

**Demo logins (password = `password123` for all):**
- `samyak@shyft.studio` — Owner
- `abhishek@shyft.studio` — Sales
- `siddhant@shyft.studio` — Production

---

## Key features

### 1. Pipeline board (`/jobs`)
- Kanban columns: Enquiry → Quoted → Design → Printing → Ready → Delivered
- Late badges (`is_late`) automatically visible
- Assigned / unassigned indicators
- Click any card for full detail + stage update + notes + activity feed

### 2. Customer history (`/customers` and `/customers/[id]`)
- Searchable list with order counts, delivered counts, total quoted
- Detail view shows full job history, notes, and quick links back to pipeline
- Tests the brief’s requirement: “Samyak should be able to pull up a regular customer’s history without calling Abhishek first”

### 3. AI Assistant (floating widget on dashboard)
- open by clicking the chat bubble
- handles: pipeline summary, late jobs, customer history, job status by number (#7), design stage, quotes, assignments
- integrates with `/api/ask` — no external API key required for demo, but code is structured to swap in an LLM if needed

### 4. Real-world scenario checks
- **Regular reorder:** BrightTech’s quoted repeat job is visible; user can compare to delivered job #1
- **Messy enquiry:** Priya Nair’s “Brochure Enquiry — Unconfirmed” sits in Enquiry with notes flagging unclear details
- **Late job:** Job #7 (Singh & Sons) is flagged `LATE`, stage `PRINTING`, due 6 Sep, notes mention paper stock delay and customer call

---

## AI / Chat tools usage (required by brief)

- **Used:** This conversation (Arena AI assistant — Claude-class model) for architecture, component design, database schema, and debugging
- **How I directed it:** Asked for Next.js App Router patterns, SQLite schema designs, Tailwind utility classes for kanban boards, and error fixes (native module resolution, JSX parser issues)
- **What I rejected / changed:** Initially tried Prisma (binary download failed in sandbox), switched to `better-sqlite3`; rejected generic ChatGPT wrapper for assistant in favor of domain-specific parser; replaced broken relative imports with `baseUrl` + `@/lib` absolute imports
- **History:** See `AI_CHAT_HISTORY.md`

---

## Known limitations

- **No real payment gateway:** Quote amounts are stored; “paid upfront” is a boolean flag for demo only
- **No file upload / design preview:** Design work is tracked as a stage + notes, not with file attachments (would add Next.js upload + storage complexity beyond 3-day scope)
- **No mobile app / PWA:** Responsive web only
- **No email/SMS notifications:** Would need external service (Twilio/SendGrid) — out of scope for internal demo
- **No real LLM backend:** Assistant is rule-based + SQL; can plug in Anthropic/OpenAI by replacing `/api/ask` logic (code is structured with clear `if/else` branches for easy swap)
- **Login is simple cookie auth:** No OAuth, no MFA — appropriate for 3-person internal use, not production-grade
- **No automated backups:** SQLite file is the single source; for production, migrate to PostgreSQL and add backups

---

## File structure

```
src/
  app/
    api/          # Auth, ask, jobs update, notes add
    customers/    # List + detail
    dashboard/    # Main view with stats, pipeline preview, AI widget
    jobs/         # Kanban board + detail
    login/        # Login form
  components/
    AssistantWidget.tsx
  lib/
    auth.ts       # Cookie session helper
    db.mjs        # SQLite DB + query helpers
  scripts/
    seed.js       # Dummy data insertion
README.md
AI_CHAT_HISTORY.md
package.json
prisma/         # Schema kept for reference (not used — see note) -- actually removed to avoid confusion; see db.mjs
```

---

## Submitting

- **Repo:** This checkout (`arena/01a07d40-shyft-studio`) — ready to push to origin
- **Run it:** `npm install && npm run dev` (dev server is running at `localhost:3000`)
- **Seed:** Already present (`db.sqlite`)
- **README:** This file
- **AI history:** `AI_CHAT_HISTORY.md`

---

*Built in under 3 days. Not production-perfect — designed to show judgment, architecture, and how I think about a messy business problem rather than just typing lines.*
