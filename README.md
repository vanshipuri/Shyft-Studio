# Shyft Studio — Multi-Persona Intelligence & Operations Platform

**Role:** AI Engineer Intern Assignment  
**Candidate:** Vanshi (simulated submission)  
**Date:** 8 Sep 2026  
**Status:** Complete & Verified  

---

## Executive Summary: Beyond a Generic Kanban Board

In a fast-paced 3-person commercial printing business (Owner, Sales, Production), generic Kanban boards fail because each team member has fundamentally different operational priorities:

| Persona | Core Responsibility | Pain Point Solved by this Platform |
|---|---|---|
| **👑 Samyak (Owner)** | Financial health & risk mitigation | Instant pipeline revenue visibility, bottleneck detection, and customer LTV without needing to call Abhishek. |
| **💼 Abhishek (Sales)** | Ingestion, quoting & repeat orders | Converts unstructured Hindi/English WhatsApp chats into structured quotes in seconds; 1-click repeat orders for regular clients. |
| **⚙️ Siddhant (Production)** | Machine throughput & quality control | Prioritized print queue, pre-flight checklists (paper stock, proofing, lamination), and proactive SLA delay alarms. |

Rather than locking everyone into an identical static view, **Shyft Studio** provides **role-tailored dashboard lenses, specialized quick actions, and domain-specific AI automation**.

---

## 🌟 Innovative AI & Engineering Features

### 1. 📱 AI Messy Channel Lead Ingestion (WhatsApp & Audio Transcript Parser)
- **Problem:** Customers message on WhatsApp in mixed Hindi/English (e.g. *"bhaiya 500 visiting cards chahiye urgently matte finish 300gsm with gold foil for Nexus Media and 100 corporate brochures before Friday"*).
- **AI Engine Solution (`/api/ai/parse-lead`):**
  - Extracts customer contact, company name, line items, quantities, paper GSM, and specialized finishing.
  - Automatically calculates standard industry pricing estimates (₹) and target turnaround deadlines.
  - Flags missing customer specifications (e.g., missing fold style or unconfirmed artwork).
  - Generates a 1-click polite WhatsApp clarification reply to send back to the client.
  - 1-Click **"Create Enquiry in Pipeline"** button creates customer and job records directly in SQLite.

### 2. 🔄 "Same as Last Time" 1-Click Repeat Order Assistant
- **Problem:** Regular clients (e.g. BrightTech Solutions, Vihaan Interiors) call asking for *"the same order as last month"*.
- **AI Solution (`/api/ai/repeat-order`):**
  - Scans historical completed jobs, extracts exact paper weights, coating specs, and past pricing.
  - Generates a ready-to-run repeat quote in seconds with artwork pre-linked, eliminating repetitive data entry.

### 3. ⚙️ Operational Bottleneck Radar & AI Production Risk Engine
- **Problem:** Print shop bottlenecks happen silently (e.g. paper stock shortages, lamination backlog, proof sign-off delays).
- **AI Solution (`/api/ai/risk-analysis`):**
  - Continuously evaluates all active jobs against due dates, machine queues, and stock dependencies.
  - Categorizes risk levels (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`) and outputs actionable mitigation steps (e.g. *"Stagger jobs across Offset vs Digital presses to clear finishing backlog"*).

### 4. 🤖 Context-Aware Shyft Copilot (Natural Language Agent)
- **Problem:** Team members need fast answers without manual report generation.
- **Capabilities (`/api/ask`):**
  - **Financial queries:** *"What is our active pipeline value?"* (calculates live pipeline ₹ totals).
  - **Floor operations:** *"Show print floor bottlenecks and machine load"*.
  - **Client 360:** *"What did Neha from BrightTech order last time?"*.
  - **Action drafts:** *"Draft an apology message for Singh & Sons delay"* or *"Draft follow-up for Priya Nair"*.
  - Interactive prompt chips dynamically adapt based on the active persona.

### 5. 📋 Pre-Flight Production Checklists & Stage Stepper
- Interactive subtask verification on `/jobs/[id]`:
  1. `[x] Vector Artwork & High-Res PDF Verified`
  2. `[x] Paper Stock Reserved (300gsm / Glossy / Matte)`
  3. `[ ] Digital Proof Signed Off by Client`
  4. `[ ] Offset / Digital Print Run Completed`
  5. `[ ] Lamination, Die-cut & Creasing Finished`
  6. `[ ] Final Quality Check & Bundled for Delivery`
- Live checkbox updates auto-persist to the database with a full audit activity trail.

### 6. 👤 Customer 360 & Lifetime Value (LTV) Intelligence
- Customer profiles (`/customers/[id]`) display:
  - Total Spend (LTV), Order Count, Delivered Count, and Average Order Value (AOV).
  - AI Customer Profile preferences (paper weight preferences, rush order frequency).
  - Side-by-side order history comparison table.

---

## 🛠️ Stack & Architecture Decisions

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Server Components for instant data rendering, client widgets for micro-interactions, API Route handlers. |
| **Database** | SQLite via `better-sqlite3` | Zero-latency, in-process, relational integrity with foreign keys, no external database dependencies. |
| **Styling** | Tailwind CSS + custom theme | Consistent design system, high-contrast role badges, responsive grid for Kanban and data tables. |
| **Auth** | Cookie session (`shyft_session`) + Instant Persona Switcher | Allows recruiters and team members to switch between Samyak, Abhishek, and Siddhant in 1 click. |
| **AI / NLP** | Domain-specific Heuristic & Parser Engine (`ai-engine.mjs`) | Deterministic, ultra-fast (0.2–1.4 ms warm), 100% offline with zero external API keys. The engine exposes exactly four pure functions (`parseMessyLead`, `generateRepeatOrderPackage`, `analyzeProductionRisks`, `processCopilotQuery`), which is the seam an LLM provider would sit behind — **no provider adapter is wired up yet**; swapping in Claude/OpenAI is a roadmap step, not shipped code. |

---

## 🚀 How to Run & Test

### Option A — Run Locally

```bash
# 1. Install dependencies
npm ci --include=dev

# 2. Run unit and feature test suite
npm test

# 3. Start development server
npm run dev
```

Open `http://localhost:3000`.

**Demo Credentials (all use password: `password123`):**
- **👑 Owner:** `samyak@shyft.studio`
- **💼 Sales:** `abhishek@shyft.studio`
- **⚙️ Production:** `siddhant@shyft.studio`

*(Note: You can switch between roles instantly using the Persona Switcher at the top of any page!)*

### Option B — Production Build & Deployment Smoke Tests

```bash
# Production build
npm run build

# Start production server
PORT=10000 npm start

# In a separate terminal, run deployment & proxy smoke tests
TEST_BASE_URL=http://127.0.0.1:10000 npm run test:deploy
```

---

## 🧭 Recruiter 5-Minute Walkthrough Guide

To see the platform's core capabilities in action:

1. **Test the Messy WhatsApp Lead Parser:**
   - Click the **"AI WhatsApp Intake"** button in the header.
   - Click **"Preset #1"** (Mixed Hindi/English with gold foil).
   - Watch the AI instantly extract items, calculate estimated quotes (₹3,800), flag missing folding details, and draft a WhatsApp clarification message.
   - Click **"Create Enquiry in Pipeline"** to see it immediately appear in the Kanban board.

2. **Experience the Persona Switcher:**
   - In the top bar, click **"💼 Sales"** → See sales-focused KPIs, unquoted enquiry alerts, and repeat order hub.
   - Click **"⚙️ Production"** → See print floor priority queue, paper stock alerts, and machine lamination dependencies.
   - Click **"👑 Owner"** → See executive revenue radar, bottleneck diagnostics, and customer LTV leaderboard.

3. **Test 1-Click "Same as Last Time" Repeat Orders:**
   - Click **"1-Click Repeat Order"** in the header or on BrightTech's profile (`/customers/1`).
   - Review past order specs vs draft quote and confirm with 1 click.

4. **Test the Pre-Flight Checklist on Job Detail:**
   - Open `/jobs/6` (Vihaan Interiors) or `/jobs/7` (Singh & Sons).
   - Check off pre-flight tasks and observe live progress updates and audit activity log.

5. **Interact with the Shyft Copilot:**
   - Open the bottom-right **AI Copilot** floating bubble.
   - Click the prompt chip: *"What is our active pipeline value?"* or *"Draft an apology message for Singh & Sons delay"*.

---

## 📁 Project Structure

```
src/
  app/
    api/
      ai/parse-lead/        # WhatsApp lead ingestion parser
      ai/repeat-order/      # 1-click repeat order generator
      ai/risk-analysis/     # Bottleneck & production risk analyzer
      ask/                  # Natural language AI Copilot
      auth/                 # Login, logout, role switcher
      jobs/create/          # Job creation with lead sources & specs
      jobs/update-stage/    # Stage progression with audit activity
      jobs/update-checklist/# Floor pre-flight subtask persistence
      notes/add/            # Internal notes
    customers/              # Customer 360 directory & detail
    dashboard/              # Multi-persona adaptive dashboard
    jobs/                   # Kanban board with role perspective lenses
    login/                  # Login portal
  components/
    AssistantWidget.tsx     # Context-aware floating AI Copilot
    JobAiActions.tsx        # WhatsApp update & floor work order generator
    JobChecklist.tsx        # Interactive pre-flight checklist
    JobStageStepper.tsx     # Visual lifecycle stage progression
    MessyLeadModal.tsx      # WhatsApp / Audio text parser modal
    PipelineBoard.tsx       # Multi-lens interactive Kanban board
    RepeatOrderModal.tsx    # 1-click repeat order modal
    RoleSwitcher.tsx        # Top persona switcher & recruiter guide
  lib/
    ai-engine.mjs           # Domain NLP parser, risk analysis, & copilot logic
    auth.ts                 # Cookie session helpers
    db.mjs                  # SQLite connection & high-performance queries
    redirect.ts             # Proxy-safe HTTP 303 redirection helper
  scripts/
    seed.js                 # Seed database generator
tests/
  features.test.mjs         # AI parser, repeat order, & risk engine unit tests
  render.test.mjs           # Proxy health check & multi-role session smoke tests
```

---

*Engineered with domain empathy for commercial print operations — turning fragmented WhatsApp chats and spreadsheet silos into a unified operational command center.*
