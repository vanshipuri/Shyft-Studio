# AI Chat History & Engineering Process — Shyft Studio Assignment

**Session:** Arena Agent Mode (`arena/01a07f75-shyft-studio`)  
**Role:** AI Engineer Intern Submission  
**Candidate:** Vanshi  
**Date:** 8 Sep 2026  

---

## 1. Problem Framing & Core Insight

**User Observation / Problem Statement:**  
*"I have noticed the pipeline task and operations are seen same by all team members, how could we take this to the next level and add innovative features to impress recruiters?"*

**Domain Analysis & Persona Mapping:**  
In a 3-person commercial printing operation:
1. **Samyak (Owner):** Needs revenue visibility, bottleneck identification, customer lifetime value (LTV), and delay risk warnings without interrupting Abhishek.
2. **Abhishek (Sales):** Drowning in unstructured WhatsApp messages, vague inquiries, and repeating past orders manually. Needs fast lead ingestion and instant quotes.
3. **Siddhant (Production):** Manages press queues, paper stock availability, digital proof sign-offs, and machine finishing (lamination, foil dies, cutting). Needs pre-flight checklists and late-delivery alerts.

**Engineering Direction:**
- Transform the generic single-view board into a **Multi-Persona Intelligent Command Center**.
- Build domain-specific AI automation tools that solve the exact friction points highlighted in the brief.

---

## 2. Architectural Decisions & Innovations Built

### A. Messy WhatsApp Lead Ingestion Engine (`/api/ai/parse-lead`)
- **Challenge:** Commercial print inquiries arrive as unstructured text (mixed Hindi/English, voice note transcripts, rough emails).
- **Solution:** Built a domain-specific NLP parsing engine that:
  - Extracts customer names, companies, phone numbers, and print line items (visiting cards, brochures, posters).
  - Determines paper weights (300gsm, 350gsm, 400gsm) and finishes (matte, gloss, velvet, foil stamping).
  - Computes standard price estimates (₹) and target turnaround deadlines.
  - Identifies missing specifications and drafts a 1-click WhatsApp clarification message.
  - Direct 1-click ingestion into the SQLite pipeline.

### B. "Same as Last Time" 1-Click Repeat Order Assistant (`/api/ai/repeat-order`)
- **Challenge:** Regular clients like BrightTech Solutions expect the team to remember past specs.
- **Solution:** Designed an automated lookup and comparison engine that fetches historical delivered jobs, matches past specs, retains pricing, and creates a pre-populated quote in seconds.

### C. Operational Bottleneck Radar & Risk Predictor (`/api/ai/risk-analysis`)
- **Challenge:** Late jobs (like Singh & Sons Job #7) damage client trust if not caught early.
- **Solution:** Built a continuous health evaluator that detects machine load, paper stock dependencies, and SLA countdowns, assigning risk tiers (`CRITICAL`, `HIGH`, `MODERATE`, `LOW`) with actionable floor solutions.

### D. Interactive Persona Switcher & Multi-Lens Kanban Board
- Added a persistent **Interactive Persona Simulator** bar to switch between Samyak (Owner), Abhishek (Sales), and Siddhant (Production) in 1 click.
- Built 4 perspective lenses into the Pipeline Board:
  - 🌐 *All Jobs Overview*
  - 💼 *Sales Lens* (deals, quotes, and enquiries)
  - ⚙️ *Production Floor Lens* (pre-flight checklists, SLA timers)
  - 👑 *Owner Lens* (revenue per stage, bottleneck flags)

### E. Interactive Pre-Flight Subtask Checklist (`/api/jobs/update-checklist`)
- Integrated a live checklist on Job Details to track:
  - Vector artwork verification
  - Paper stock reservation
  - Client proof approval
  - Machine print run
  - Lamination & precision die-cutting
  - Final QC & packaging

---

## 3. Technology Choices & Trade-offs

| Decision | Alternative Considered | Why Chosen |
|---|---|---|
| **SQLite via `better-sqlite3`** | PostgreSQL / Prisma | Zero external network dependencies, file-backed reliability in sandboxes, synchronous sub-millisecond queries. |
| **Domain-specific NLP Engine** | Generic OpenAI API wrapper | 100% reliable in air-gapped/sandbox environments, instant response (<15ms), zero API cost, completely predictable print parsing. |
| **Server Components + Client Island Micro-Interactions** | Full SPA (React Router) | Instant initial page loads with Next.js SSR, lightweight bundles, smooth client modals for AI tools. |
| **Proxy-Safe HTTP 303 Redirects** | Client `router.push` only | Clean Form POST compatibility behind Render/preview proxies with no host leakage. |

---

## 4. Verification & Testing

1. **Unit & Feature Test Suite (`tests/features.test.mjs`):**
   - Verified WhatsApp lead parser on complex Hindi-English inputs with gold foil stamping.
   - Verified 1-Click Repeat Order proposal generation for BrightTech Solutions.
   - Verified Production Risk Analysis on overdue jobs.
   - Verified Copilot financial calculations and communication drafting.
   - *Result: 4/4 passing.*

2. **Deployment & Proxy Smoke Tests (`tests/render.test.mjs`):**
   - Verified login health check, cookie session persistence across all 3 roles, rejected invalid credentials, and proxy header redirection safety.
   - *Result: 6/6 passing.*

3. **Production Build:**
   - `npm run build` generates all 19 static/dynamic routes with zero TypeScript or bundling errors.

---

*This document is part of the submission per the "What to Submit" requirements.*
