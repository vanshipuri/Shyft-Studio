/**
 * Shyft Studio — messy-intake extraction eval.
 *
 * WHY THIS EXISTS
 * ---------------
 * A rules-based extraction engine rots silently: someone tweaks a regex, one
 * product family starts mis-quoting, and nothing fails because the unit tests
 * only cover the happy demo string. This file is the guard rail.
 *
 * Every case below is HAND-LABELLED ground truth — what a human in the shop
 * would read out of that message — written before looking at engine output.
 * Where the engine disagrees, the engine is wrong and the case stays failing
 * until it is fixed. It is a scored eval with a hard gate, not a test that
 * asserts the engine does whatever the engine currently does.
 *
 *   npm run eval          # prints the scorecard, exits 1 below the gate
 *
 * Run in CI on every push and pull request.
 */

import { parseMessyLead } from "../src/lib/ai-engine.mjs";

/**
 * @typedef {object} Case
 * @property {string} text        raw messy message
 * @property {number|null} customerId  existing account id, or null = genuinely new
 * @property {string} [company]   expected company string (new customers only)
 * @property {number[]} quantities expected per-line-item quantities, in order
 * @property {string[]} [priorityOneOf] acceptable priority labels
 * @property {boolean} [quantityExplicit] false = message states no quantity at all
 * @property {boolean} [expectPhone]
 * @property {boolean} [expectEmail]
 */

/** @type {Case[]} */
const CASES = [
  {
    text: "bhaiya 500 visiting cards chahiye urgently matte finish 300gsm with gold foil for Nexus Media and 100 corporate brochures before Friday",
    customerId: null,
    company: "Nexus Media",
    quantities: [500, 100],
    priorityOneOf: ["high", "urgent"],
  },
  {
    text: "Hi, Neha from BrghtTech Solutons here. Need our usual 500 glossy cards by Friday",
    customerId: 1,
    quantities: [500],
    priorityOneOf: ["high", "urgent"],
  },
  {
    text: "Hello this is Rohan from Gupta Traders, want 1000 brochures a4 size tri fold",
    customerId: 12,
    quantities: [1000],
    priorityOneOf: ["normal", "high"],
  },
  {
    text: "hey 2 flex banners 6x3 for shop opening tomorrow urgent",
    customerId: null,
    quantities: [2],
    priorityOneOf: ["urgent"],
  },
  {
    text: "Meera here from Urban Nest - same as last time please, 300 invite cards",
    customerId: 6,
    quantities: [300],
  },
  {
    text: "Need 2000 business cards 350gsm matte lamination. - Vikram, Joshi & Co. contact 9876543210",
    customerId: 7,
    quantities: [2000],
    expectPhone: true,
  },
  {
    text: "1000 posters for Zingaro Studios a2 size, client email rohit@zingaro.in",
    customerId: null,
    company: "Zingaro Studios",
    quantities: [1000],
    expectEmail: true,
  },
  {
    text: "sneha from Reddy Events needs 50 standees 6x2.5 by monday",
    customerId: 8,
    quantities: [50],
  },
  {
    text: "hi can you print some cards for me asap",
    customerId: null,
    quantities: [500],
    quantityExplicit: false,
    priorityOneOf: ["urgent"],
  },
  {
    text: "Karan Singh Singh and Sons here. premium cardstock 500 cards urgent",
    customerId: 5,
    quantities: [500],
    priorityOneOf: ["high", "urgent"],
  },
  {
    text: "Deepa from Aroma Luxe, 250 thank you cards velvet touch lamination, no rush",
    customerId: 11,
    quantities: [250],
    priorityOneOf: ["normal"],
  },
  {
    text: "Anjali here Vihaan Interiors need 3 A1 posters laminated by next week",
    customerId: 4,
    quantities: [3],
  },
  {
    text: "Arjun Grandline Hotels - 2000 menu cards 400gsm matte, plus 300 brochures",
    customerId: 9,
    quantities: [2000, 300],
  },
  {
    text: "Priya Nair here, need the conference brochures again, 1000 pieces bi-fold",
    customerId: 3,
    quantities: [1000],
  },
  {
    text: "Rahul City Events Pvt Ltd wants 1500 flyers for the wedding expo, urgent kal chahiye",
    customerId: 2,
    quantities: [1500],
    priorityOneOf: ["urgent"],
  },
  {
    text: "new enquiry from Blue Orchid Weddings - 750 invite cards gold foil, contact neha@blueorchid.in 9812345678",
    customerId: null,
    company: "Blue Orchid Weddings",
    quantities: [750],
    expectPhone: true,
    expectEmail: true,
  },
];

const metrics = {
  identity: { pass: 0, total: 0 },
  company: { pass: 0, total: 0 },
  quantities: { pass: 0, total: 0 },
  itemCount: { pass: 0, total: 0 },
  priority: { pass: 0, total: 0 },
  contact: { pass: 0, total: 0 },
};

const failures = [];
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const record = (key, ok) => {
  metrics[key].total += 1;
  if (ok) metrics[key].pass += 1;
  return ok;
};

console.log("\nShyft Studio — messy-intake extraction eval");
console.log("=".repeat(78));

for (const c of CASES) {
  const short = c.text.length > 44 ? c.text.slice(0, 44) + "…" : c.text;
  let r;
  try {
    r = parseMessyLead(c.text);
  } catch (error) {
    failures.push(`${short} → parseMessyLead threw: ${error.message}`);
    console.log(`  ✗ ${short}\n      engine threw ${error.message}`);
    continue;
  }

  const gotId = r.customer.match ? r.customer.match.id : null;
  const gotQty = r.items.map((i) => i.quantity);
  const problems = [];

  // 1. Customer identity — attach to the right account, or correctly say "new".
  if (!record("identity", gotId === c.customerId)) {
    problems.push(`identity: expected ${c.customerId ?? "new"}, got ${gotId ?? "new"}`);
  }

  // 2. Company name, for genuinely new customers.
  if (c.company !== undefined) {
    if (!record("company", norm(r.customer.company) === norm(c.company))) {
      problems.push(`company: expected "${c.company}", got "${r.customer.company}"`);
    }
  }

  // 3. Per-line-item quantities — the number that becomes the quote.
  const qtyOk =
    gotQty.length === c.quantities.length &&
    gotQty.every((q, i) => q === c.quantities[i]);
  if (!record("quantities", qtyOk)) {
    problems.push(`quantities: expected [${c.quantities}], got [${gotQty}]`);
  }

  // 4. Line-item count.
  if (!record("itemCount", r.items.length === c.quantities.length)) {
    problems.push(`itemCount: expected ${c.quantities.length}, got ${r.items.length}`);
  }

  // 5. Priority.
  if (c.priorityOneOf) {
    if (!record("priority", c.priorityOneOf.includes(r.job.priority))) {
      problems.push(`priority: expected one of [${c.priorityOneOf}], got ${r.job.priority}`);
    }
  }

  // 6. Contact details actually surfaced from the message.
  if (c.expectPhone || c.expectEmail) {
    const phoneOk = !c.expectPhone || /\d{5}/.test(r.customer.phone || "");
    const emailOk = !c.expectEmail || /@/.test(r.customer.email || "");
    if (!record("contact", phoneOk && emailOk)) {
      problems.push(`contact: phone="${r.customer.phone}" email="${r.customer.email}"`);
    }
  }

  // 7. When no quantity was stated, the engine must SAY so, not quote silently.
  if (c.quantityExplicit === false) {
    const flagged = r.missingInfo.some((m) => /Quantity not stated/i.test(m));
    if (!flagged) problems.push("did not flag the defaulted quantity");
  }

  if (problems.length) {
    failures.push(`${short} → ${problems.join("; ")}`);
    console.log(`  ✗ ${short}`);
    for (const p of problems) console.log(`      ${p}`);
  } else {
    console.log(`  ✓ ${short}`);
  }
}

const pct = (m) => (m.total === 0 ? 1 : m.pass / m.total);
const scorecard = [
  ["Customer identity", metrics.identity],
  ["Company name", metrics.company],
  ["Quantities", metrics.quantities],
  ["Line-item count", metrics.itemCount],
  ["Priority", metrics.priority],
  ["Contact details", metrics.contact],
];

const totalPass = scorecard.reduce((n, [, m]) => n + m.pass, 0);
const totalAll = scorecard.reduce((n, [, m]) => n + m.total, 0);
const overall = totalPass / totalAll;

console.log("-".repeat(78));
for (const [label, m] of scorecard) {
  const p = pct(m);
  const bar = "█".repeat(Math.round(p * 20)).padEnd(20, "·");
  console.log(`  ${label.padEnd(20)} ${bar} ${m.pass}/${m.total}  ${(p * 100).toFixed(0)}%`);
}
console.log("-".repeat(78));
console.log(`  OVERALL              ${(overall * 100).toFixed(1)}%  (${totalPass}/${totalAll} field assertions)`);
console.log(`  Cases: ${CASES.length} · failures: ${failures.length}`);

// Hard gate.
//
// An overall percentage alone is too forgiving: one mis-read quantity out of 62
// assertions is 98.4%, which would sail past a 95% bar while still quoting a
// client the wrong number. So the metrics that directly produce a price or a
// customer record must hold 100%, and the overall score must as well.
// Verified to have teeth: disabling the forward-quantity scan makes this exit 1.
const CRITICAL = new Set(["Customer identity", "Quantities", "Line-item count"]);
const breaches = [];
for (const [label, m] of scorecard) {
  const p = pct(m);
  if (CRITICAL.has(label) && p < 1) breaches.push(`${label} ${m.pass}/${m.total}`);
}
if (overall < 1) breaches.push(`overall ${(overall * 100).toFixed(1)}%`);

if (breaches.length > 0) {
  console.error(`\n✗ Extraction quality regressed: ${breaches.join(", ")}`);
  console.error("  Every case in this eval is hand-labelled ground truth;");
  console.error("  a failure means the engine now mis-reads a real message.");
  process.exit(1);
}
console.log("\n✓ Extraction eval clean — all hand-labelled cases match.\n");
