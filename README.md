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

### Option A — Run locally

Use **Node.js 22.x** (required by this project's `better-sqlite3` version).

```bash
# Install the locked dependencies, including build tools
npm ci --include=dev

# db.sqlite already includes the demo data; no seeding step is needed
npm run dev
```

Then open `http://localhost:3000`. For a production build, run `npm run build`, then `npm start` instead of the dev server. Both servers bind to `0.0.0.0` and respect `PORT`, defaulting to `3000` locally.

To regenerate demo data, **back up and move the existing `db.sqlite` out of the repository folder first**, then run `npm run db:seed` from the repo root. The seeder appends customers and jobs; do not run it repeatedly against a database you want to keep. Prisma is not used by the running app; `db:push` is a legacy command, not a setup step.

On Windows, installing native SQLite may require Python and Visual Studio C++ build tools. Use Option B to avoid compiling anything on your PC.

**Demo logins (password = `password123` for all):**
- `samyak@shyft.studio` — Owner
- `abhishek@shyft.studio` — Sales
- `siddhant@shyft.studio` — Production

### Option B — Deploy to Render (no local compile, including on Windows)

You only need Git, the GitHub repository, and a Render account. Render installs and builds the app in its Linux **Node** runtime; no Dockerfile or local Visual Studio installation is needed. The root-level [`render.yaml`](render.yaml) is already included.

#### 1. Publish the deployment changes

This session uses **`arena/01a07f3e-shyft-studio`**, not `main`. From your cloned `Shyft-Studio` folder, verify that branch before proceeding. The commands below work in PowerShell or Bash. If the changes are already committed, skip the `add` and `commit` steps.

```bash
git branch --show-current
# Expected: arena/01a07f3e-shyft-studio

git add render.yaml README.md AI_CHAT_HISTORY.md package.json package-lock.json
git add src/lib/redirect.ts src/app/api/auth src/app/api/jobs/update-stage src/app/api/notes/add tests/render.test.mjs
git diff --cached
git commit -m "Configure Render demo deployment"
git push origin arena/01a07f3e-shyft-studio
```

Do not pull or push `main` for this session; Render must deploy the branch containing these changes.

#### 2. Create the service from the Blueprint

1. Open [Render](https://dashboard.render.com/) → **New → Blueprint**.
2. Connect **`vanshipuri/Shyft-Studio`** and select **`arena/01a07f3e-shyft-studio`** as the Blueprint branch, using `render.yaml`.
3. Review the service configuration (the Blueprint explicitly selects the **Free** instance type), then deploy.
4. Wait for the build and `/login` health check to pass. Open the **actual `onrender.com` URL shown in the dashboard** and use a demo login above. The service name/URL may receive a suffix; `https://shyft-studio.onrender.com` is not guaranteed to be available.

**Manual alternative:** choose **New → Web Service**, connect the same repo and branch, and enter the values below. A manually created Web Service does not automatically apply `render.yaml`.

| Setting | Value |
|---|---|
| Branch | `arena/01a07f3e-shyft-studio` |
| Language / runtime | Node |
| Root directory | Leave blank (repository root) |
| Instance type | Free |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/login` |
| Environment variables | `NODE_ENV=production`, `NODE_VERSION=22` |

Do not create a Static Site: this app needs a Node server for its APIs and SQLite. Leave `PORT` managed by Render; `npm start` reads it automatically. `--include=dev` ensures TypeScript, Tailwind, and other build dependencies are installed even with `NODE_ENV=production`.

#### Demo storage and security caveats

- The committed `db.sqlite` contains **3 users, 5 customers, and 9 jobs**. No API key, Prisma generation, or deploy-time seeding command is required. Do **not** add the seeder to the build/start command, or it will duplicate demo records.
- **SQLite edits are temporary on the Free plan.** Render loses filesystem changes when the service restarts, redeploys, or spins down after inactivity. The next instance starts from the bundled seed database. Free services also have a cold-start delay. See [Render's Free instance limitations](https://render.com/docs/free).
- Durable data needs a paid service with a persistent disk and runtime database initialization (the app supports a `DB_PATH` override), or a migration to an external database. Changing the instance plan alone does not make SQLite persistent. This Blueprint does not provision paid storage.
- **Use synthetic demo data only.** The shared passwords, unsigned session cookies, and API authorization need hardening. Existing dependency audit findings are noted below; this deployment configuration does not make the app production-safe.

#### Verify before sharing

With the production server running locally (`npm run build`, then `npm start`), run `npm run test:deploy` in a second terminal. The read-only smoke tests cover the login health check, all three demo logins/dashboard access, rejected credentials, and proxy-safe form redirects/logout. Set `TEST_BASE_URL` if the server uses a port other than `3000`.

After deployment, also check login → pipeline → job details → logout at the Render URL. Add that **verified URL**, not an assumed hostname, to your submission. Creating the configuration file alone does not publish or deploy the app.

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

- **Used:** Arena.ai Agent Mode for architecture, component design, database schema, and debugging
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
- **Dependency security review outstanding:** `npm audit` on 8 Sep 2026 reported 1 critical and 1 high dependency finding (Next.js and its nested PostCSS dependency). Upgrade and re-test dependencies before production use; the Render configuration does not address these existing findings.

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
render.yaml     # Free Render demo deployment (Node runtime)
tests/
  render.test.mjs # Read-only production/proxy smoke tests
prisma/         # Legacy schema; not used by the app or deployment
```

---

## Submitting

- **Repo:** [vanshipuri/Shyft-Studio](https://github.com/vanshipuri/Shyft-Studio), deployment changes on `arena/01a07f3e-shyft-studio`
- **Run it:** Use Option A above, or publish the branch and deploy with Option B. Include the verified Render URL when submitting; no hosted URL is implied by this README.
- **Seed:** Already present (`db.sqlite`); regeneration script at `src/scripts/seed.js`
- **README:** This file
- **AI history:** `AI_CHAT_HISTORY.md`

---

*Built in under 3 days. Not production-perfect — designed to show judgment, architecture, and how I think about a messy business problem rather than just typing lines.*
