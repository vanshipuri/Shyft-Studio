import assert from "node:assert/strict";
import test from "node:test";
import { parseMessyLead, generateRepeatOrderPackage, analyzeProductionRisks, processCopilotQuery } from "../src/lib/ai-engine.mjs";
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
