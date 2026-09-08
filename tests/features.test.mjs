import assert from "node:assert/strict";
import test from "node:test";
import { parseMessyLead, generateRepeatOrderPackage, analyzeProductionRisks, processCopilotQuery, computeReengagementNudges, generateDailyBriefing } from "../src/lib/ai-engine.mjs";
import { getCustomers, getJobs, getCustomerById, getJobById } from "../src/lib/db.mjs";

test("AI Lead Parser extracts structured specs from messy Hindi/English WhatsApp message", () => {
  const raw = "bhaiya 500 visiting cards chahiye urgently matte finish 300gsm with gold foil for Nexus Media and 100 corporate brochures before Friday";
  const result = parseMessyLead(raw);

  assert.equal(result.success, true);
  assert.equal(result.customer.company, "Nexus Media");
  assert.equal(result.job.priority, "high");
  assert.ok(result.job.quoteAmount > 0, "Quote amount should be calculated");
  assert.ok(result.items.length >= 2, "Should detect at least cards and brochures");
  assert.ok(result.suggestedReply.includes("Shyft Studio"), "Should generate WhatsApp reply");
});

test("AI Repeat Order Assistant matches past delivered jobs for BrightTech", () => {
  const result = generateRepeatOrderPackage(1);

  assert.equal(result.success, true);
  assert.equal(result.customer.name, "Neha Desai");
  assert.equal(result.referenceJob.stage, "DELIVERED");
  assert.equal(result.repeatJob.stage, "QUOTED");
  assert.equal(result.repeatJob.quoteAmount, 12800);
  assert.match(result.repeatJob.title, /Repeat/i);
});

test("AI Risk Analysis flags late jobs and operational bottlenecks", () => {
  const analysis = analyzeProductionRisks();

  assert.ok(analysis.lateCount >= 1, "Should detect at least 1 late job");
  assert.ok(analysis.bottlenecks.length >= 1, "Should detect at least 1 bottleneck");
  const singhJob = analysis.riskEvaluations.find(r => r.title.includes("Client Delivery"));
  assert.ok(singhJob, "Singh & Sons job should be evaluated");
  assert.equal(singhJob.riskLevel, "CRITICAL");
});

test("AI Copilot handles financial calculations and communication drafting", () => {
  const finance = processCopilotQuery("pipeline value", "OWNER");
  assert.match(finance.answer, /Active Pipeline Value/);
  assert.match(finance.answer, /₹/);

  const apology = processCopilotQuery("draft delay apology message for Singh & Sons", "SALES");
  assert.match(apology.answer, /Singh & Sons/);
  assert.match(apology.answer, /paper stock/i);

  const followUp = processCopilotQuery("draft follow up for Priya Nair", "SALES");
  assert.match(followUp.answer, /Priya/);
  assert.match(followUp.answer, /conference brochure/i);
});

// ---------------------------------------------------------------------------
// Playbook-aligned coverage: ownership model, messy-intake fuzzy matching,
// proactive re-engagement, daily briefing, and new copilot intents.
// ---------------------------------------------------------------------------

import { ownerRoleForStage, ownerLabelForStage, isValidStage, resolveStageOwner, STAGE_IDS } from "../src/lib/pipeline.mjs";

test("pipeline model gives every stage exactly one default owner role", () => {
  assert.equal(STAGE_IDS.length, 6);
  for (const stage of STAGE_IDS) {
    const role = ownerRoleForStage(stage);
    assert.ok(["SALES", "PRODUCTION"].includes(role), `${stage} must have a concrete owner role`);
  }
  assert.equal(ownerRoleForStage("PRINTING"), "PRODUCTION");
  assert.equal(ownerRoleForStage("ENQUIRY"), "SALES");
  assert.equal(ownerRoleForStage("DELIVERED"), "SALES"); // payment + post-delivery follow-up
  assert.equal(isValidStage("PRINTING"), true);
  assert.equal(isValidStage("DOING_STUFF"), false);
});

test("resolveStageOwner hands a job to the stage owner when the assignee role is wrong", () => {
  const salesUser = { id: 2, role: "SALES" };
  const opsUser = { id: 3, role: "PRODUCTION" };
  const users = [salesUser, opsUser];

  // Sales person still owns DESIGN…
  assert.equal(resolveStageOwner("DESIGN", salesUser, users), 2);
  // …but moving into PRINTING re-assigns to Production automatically.
  assert.equal(resolveStageOwner("PRINTING", salesUser, users), 3);
  // An OWNER who grabbed the job yields to the stage owner on transition.
  assert.equal(resolveStageOwner("PRINTING", { id: 1, role: "OWNER" }, users), 3);
  // Production person already owning READY keeps it.
  assert.equal(resolveStageOwner("READY", opsUser, users), 3);
});

test("messy intake fuzzy-matches a typo'd existing customer (Scenario 2) and never silently duplicates", () => {
  const raw = "Hi Abhishek, Neha from BrghtTech Solutons here. Need our usual 500 visiting cards glossy by Friday please.";
  const result = parseMessyLead(raw);

  assert.equal(result.success, true);
  assert.equal(result.customer.isNew, false, "typo must still resolve to the existing account");
  assert.ok(result.customer.match, "parser should surface the match for human confirmation");
  assert.equal(result.customer.match.id, 1);
  assert.equal(result.customer.match.name, "Neha Desai");
  assert.equal(result.customer.match.confidence, "high");
  assert.equal(result.customer.name, "Neha Desai", "contact should resolve to the real customer, not the typo");
});

test("messy intake flags a genuinely new company instead of inventing one", () => {
  const result = parseMessyLead("hello need 1000 posters glossy for Zingaro Studios cafe launch this weekend");
  assert.equal(result.success, true);
  assert.equal(result.customer.isNew, true);
  assert.equal(result.customer.match, null);
  assert.equal(result.customer.company, "Zingaro Studios");
  assert.match(result.customer.name, /Contact|Lead/i, "placeholder contact name is fine for a brand-new lead");
});

test("re-engagement engine surfaces repeat customers overdue by their own cadence", () => {
  const nudges = computeReengagementNudges();
  const names = nudges.map((n) => n.customerName);

  assert.ok(names.includes("Meera Shah"), "Urban Nest (dormant regular) should be due for a check-in");
  assert.ok(names.includes("Arjun Mehta"), "Grandline Hotels should be flagged");
  assert.ok(!names.includes("Neha Desai"), "BrightTech has open jobs — must not be nagged");
  assert.ok(!names.includes("Anjali Kapoor"), "Vihaan has open jobs — must not be nagged");
  assert.ok(!names.includes("Farhan Ali"), "Kayra Fitness has an open job — must not be nagged");

  const meera = nudges.find((n) => n.customerName === "Meera Shah");
  assert.ok(meera.daysSinceLastOrder > meera.avgIntervalDays, "Meera must be past her reorder window");
});

test("daily briefing is role-aware and reports risk, aging enquiries and overdue check-ins", () => {
  const owner = generateDailyBriefing("OWNER");
  const sales = generateDailyBriefing("SALES");
  const prod = generateDailyBriefing("PRODUCTION");

  assert.ok(owner.counts.atRisk >= 1, "briefing must count the late Singh & Sons job");
  assert.ok(owner.counts.overdueCheckIns >= 2, "briefing must include the overdue repeat clients");
  assert.ok(owner.headline.length > 20);
  assert.ok(owner.bullets.length >= 3);
  assert.ok(sales.bullets !== owner.bullets, "sales briefing must differ from the owner briefing");
  assert.ok(prod.bullets.length >= 3);
});

test("copilot answers re-engagement, briefing and customer-history queries", () => {
  const nudge = processCopilotQuery("Which repeat clients are due for a check-in?", "SALES");
  assert.match(nudge.answer, /Meera Shah/);
  assert.match(nudge.answer, /check-in/i);

  const quiet = processCopilotQuery("Who hasn't ordered in 60 days?", "SALES");
  assert.match(quiet.answer, /Meera Shah|Arjun Mehta/);

  const brief = processCopilotQuery("Give me today's briefing", "OWNER");
  assert.match(brief.answer, /Daily Briefing/i);

  const history = processCopilotQuery("What did Neha from BrightTech order last time?", "OWNER");
  assert.match(history.answer, /Neha Desai/);
  assert.match(history.answer, /order history|Lifetime Value/i);

  const unquoted = processCopilotQuery("Show unquoted leads needing follow-up", "SALES");
  assert.match(unquoted.answer, /Unquoted Enquiries/i);
  assert.match(unquoted.answer, /Priya Nair/);
});

// Two gaps found while re-running the brief scenarios by hand after the UI pass.
// Both are "the demo looks broken to a recruiter" bugs rather than crashes, which
// is exactly the class of defect unit tests on happy paths miss.

test("copilot routes natural phrasings of 'what needs me today' to the briefing", () => {
  // Each of these used to fall through to the generic help menu.
  for (const q of [
    "what should Abhishek work on today",
    "what should I work on",
    "what's on my plate",
    "my priorities",
    "what needs my attention",
  ]) {
    assert.match(
      processCopilotQuery(q, "OWNER").answer,
      /Daily Briefing/i,
      `expected a briefing for: "${q}"`
    );
  }

  // ...without stealing turns from the narrower intents that overlap these words.
  assert.doesNotMatch(processCopilotQuery("which jobs are late", "OWNER").answer, /Daily Briefing/i);
  assert.match(processCopilotQuery("which jobs are late", "OWNER").answer, /Late \/ At-Risk Jobs/i);
  assert.match(processCopilotQuery("how much revenue this month", "OWNER").answer, /Pipeline Summary/i);

  // Asking about a named teammate borrows that teammate's lens, even when the
  // owner is the one logged in.
  const prod = processCopilotQuery("what should Siddhant work on today", "OWNER").answer;
  const sales = processCopilotQuery("what should Abhishek work on today", "OWNER").answer;
  assert.notEqual(prod, sales, "production and sales lenses must not return the same brief");
  assert.match(prod, /press|finishing|dispatch/i);
});

test("intake parser keeps a stated finish and flags specs the rate card cannot price", () => {
  // "matte" was previously dropped for brochure-class jobs: the client was quoted
  // gloss and nothing flagged it.
  const matte = parseMessyLead("need 500 flyers a5 matte double sided by friday");
  assert.match(matte.items[0].paper, /Matte/i);

  // Finish is a label, not an invented surcharge: same rate as the gloss default.
  const gloss = parseMessyLead("need 500 flyers a5 gloss by friday");
  assert.match(gloss.items[0].paper, /Gloss/i);
  assert.equal(
    matte.items[0].estimatedPrice,
    gloss.items[0].estimatedPrice,
    "matte and gloss brochures are not priced differently in the rate card"
  );

  // Double-sided has no rate tier, so it must be pushed to a human, not silently
  // priced as single-sided.
  assert.match(
    matte.missingInfo.join(" "),
    /double-sided|duplex/i,
    "unpriced duplex must be surfaced for confirmation"
  );
  assert.doesNotMatch(
    parseMessyLead("need 500 flyers a5 by friday").missingInfo.join(" "),
    /double-sided|duplex/i,
    "no false positive when duplex was never mentioned"
  );
});
