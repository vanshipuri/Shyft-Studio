import assert from "node:assert/strict";
import test from "node:test";
import { parseMessyLead } from "../src/lib/ai-engine.mjs";
import { createLlmClient, enrichLeadWithLLM } from "../src/lib/llm-provider.mjs";

/** A stand-in provider so the seam is exercised without any network. */
function mockClient(payload, { fail = false } = {}) {
  return {
    available: true,
    reason: "mock",
    calls: 0,
    async complete() {
      this.calls += 1;
      if (fail) throw new Error("provider exploded");
      return payload;
    },
  };
}

// Deliberately carries NO digits and no @ — so phone/email are genuinely blank
// in the deterministic result and the seam is the only thing that can fill them.
const MSG = "hi, need 500 cards for the launch event, thicker stock this time";

test("with no API key the seam is inert and nothing calls the network", () => {
  const client = createLlmClient({});
  assert.equal(client.available, false);
  assert.match(client.reason, /SHYFT_LLM_API_KEY/);
  assert.rejects(() => client.complete("a", "b"), /No LLM provider configured/);
});

test("createLlmClient honours an OpenAI-compatible base URL override", () => {
  const client = createLlmClient({
    SHYFT_LLM_API_KEY: "test-key",
    SHYFT_LLM_BASE_URL: "https://groq.example/v1/",
    SHYFT_LLM_MODEL: "llama-test",
  });
  assert.equal(client.available, true);
  assert.match(client.reason, /https:\/\/groq\.example\/v1 \(llama-test\)/);
});

test("a configured provider fills gaps the rules engine left blank", async () => {
  const base = parseMessyLead(MSG);
  assert.equal(base.success, true);

  const client = mockClient({
    contactName: "Anil Kumar",
    company: "",
    phone: "9876500011",
    email: "anil@sparkworks.in",
    specs: "350gsm matte with spot UV",
    artwork: "client file",
    missingInfo: ["Delivery pincode not given"],
  });

  const out = await enrichLeadWithLLM(MSG, base, client);
  assert.equal(client.calls, 1);
  assert.equal(out.enrichment.applied, true);
  assert.ok(out.enrichment.fields.includes("customer.phone"), "phone should be attributed");
  assert.equal(out.customer.phone, "9876500011");
  assert.equal(out.customer.email, "anil@sparkworks.in");
  assert.match(out.job.specsSummary, /spot UV/);
  assert.ok(out.missingInfo.some((m) => /pincode/i.test(m)));
});

test("the provider can never change the price or the line items", async () => {
  const base = parseMessyLead("500 visiting cards 300gsm matte");
  const hostile = mockClient({
    contactName: "X",
    company: "Y",
    specs: "gold foil",
    // A malicious/confused provider trying to rewrite the quote:
    job: { quoteAmount: 1 },
    items: [{ type: "Visiting Cards", quantity: 1, estimatedPrice: 1 }],
  });

  const out = await enrichLeadWithLLM("500 visiting cards 300gsm matte", base, hostile);
  assert.equal(out.job.quoteAmount, base.job.quoteAmount, "quote must be unchanged");
  assert.deepEqual(out.items, base.items, "line items must be unchanged");
});

test("provider failure degrades to the deterministic result instead of throwing", async () => {
  const base = parseMessyLead(MSG);
  const out = await enrichLeadWithLLM(MSG, base, mockClient(null, { fail: true }));
  assert.equal(out.success, true);
  assert.equal(out.enrichment.applied, false);
  assert.match(out.enrichment.reason, /provider error/);
  assert.equal(out.job.quoteAmount, base.job.quoteAmount);
});

test("provider output is validated, not trusted: junk fields are dropped", async () => {
  const base = parseMessyLead(MSG);
  const junk = mockClient({
    contactName: 12345,
    phone: "not-a-phone",
    email: "also not an email",
    missingInfo: [null, "ok", "", "x".repeat(400)],
  });

  const out = await enrichLeadWithLLM(MSG, base, junk);
  assert.equal(typeof out.customer.name, "string");
  assert.ok(!/not-a-phone/.test(out.customer.phone));
  assert.ok(!/also not an email/.test(out.customer.email));
  for (const m of out.missingInfo) assert.ok(m.length <= 160, "missingInfo must be capped");
});

test("a provider that adds nothing leaves the result unchanged", async () => {
  const base = parseMessyLead(MSG);
  const out = await enrichLeadWithLLM(MSG, base, mockClient({}));
  assert.equal(out.enrichment.applied, false);
  assert.deepEqual(out.enrichment.fields, []);
  assert.deepEqual(out.missingInfo, base.missingInfo);
});

test("an already-matched existing account is never re-identified by the provider", async () => {
  const msg = "Neha from BrightTech Solutions wants 500 cards";
  const base = parseMessyLead(msg);
  assert.ok(base.customer.match, "sanity: should match the seeded account");

  const out = await enrichLeadWithLLM(msg, base, mockClient({ company: "Totally Different Ltd" }));
  assert.equal(out.customer.company, base.customer.company, "identity resolution stays local");
  assert.equal(out.customer.match.id, base.customer.match.id);
});
