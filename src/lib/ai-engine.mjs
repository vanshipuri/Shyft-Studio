// Domain-specific AI Engine for Shyft Studio
// Handles messy WhatsApp lead ingestion, repeat order intelligence, production risk analysis,
// proactive re-engagement nudges, daily briefings, and natural language copilot reasoning.

import { db, getCustomers, getJobs, getLateJobs, getStageCounts, getCustomerJobs, getJobById, getCustomerById } from "./db.mjs";
import { repriceItem } from "./pricing.mjs";

// ---------------------------------------------------------------------------
// Small string-similarity helpers (no external deps, deterministic & offline).
// Used to match messy, typo-ridden WhatsApp mentions against existing accounts
// WITHOUT auto-creating duplicate customers.
// ---------------------------------------------------------------------------

const FUZZY_STOPWORDS = new Set([
  "the", "this", "that", "with", "from", "have", "for", "and", "our", "your", "you", "are",
  "not", "need", "please", "hi", "hey", "dear", "sir", "maam", "will", "can", "just", "about",
  "their", "there", "them", "then", "than", "when", "what", "which", "while", "bhaiya",
  "chahiye", "urgently", "want", "has", "had", "been", "were", "was", "but", "also", "would",
  "could", "should", "into", "onto", "before", "after", "kal", "aaj"
]);

function normKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function bigrams(value) {
  const s = normKey(value);
  if (s.length < 2) return s.length === 1 ? new Set([s]) : new Set();
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

/** Sørensen–Dice similarity over character bigrams (0..1). Space-insensitive. */
function diceSimilarity(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let overlap = 0;
  for (const g of A) if (B.has(g)) overlap++;
  return (2 * overlap) / (A.size + B.size);
}

/**
 * Finds the most plausible EXISTING customer behind a messy message, if any.
 * Scans 1–3 word windows of the raw text and compares each against every
 * account's name and company with typo-tolerant similarity.
 *
 * Returns null when nothing is close enough OR when two accounts are equally
 * plausible (ambiguous) — in both cases the caller keeps the lead as "new" and
 * lets a human decide. Never auto-links on a weak guess.
 */
function findBestCustomerMatch(rawText, customers) {
  const words = String(rawText || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s&.+]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !FUZZY_STOPWORDS.has(w));

  if (!words.length || !customers.length) return null;

  const scored = customers.map((customer) => {
    const nameKey = normKey(customer.name);
    const companyKey = normKey(customer.company || "");
    let best = 0;
    for (let start = 0; start < words.length; start++) {
      for (let len = 1; len <= 3 && start + len <= words.length; len++) {
        const window = words.slice(start, start + len).join("");
        const s = Math.max(
          nameKey ? diceSimilarity(window, nameKey) : 0,
          companyKey ? diceSimilarity(window, companyKey) : 0
        );
        if (s > best) best = s;
      }
    }
    return { customer, best };
  });

  scored.sort((a, b) => b.best - a.best);
  const top = scored[0];
  if (!top || top.best < 0.62) return null;
  // If two accounts are near-tied, the mention is ambiguous — defer to a human.
  if (scored[1] && top.best - scored[1].best < 0.12) return null;
  return { customer: top.customer, confidence: top.best >= 0.78 ? "high" : "medium" };
}

// --- Quantity extraction ---------------------------------------------------
//
// The old regexes only accepted a number glued directly to the keyword
// ("500 cards"). Real WhatsApp messages put words in between — "100 corporate
// brochures", "2 flex banners" — and then silently fell back to a hard-coded
// default, which is how a 2-banner job became a 10-banner quote. The intake
// eval in tests/eval-intake.mjs caught exactly that.
//
// This scans a short window *before* the keyword for a quantity token, skipping
// adjectives, and deliberately ignores tokens that are specs rather than
// counts: "300gsm" (paper), "6x3" (dimensions), "a4" (size).

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  "twenty five": 25, twentyfive: 25, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, "seventy five": 75, eighty: 80, ninety: 90, hundred: 100,
  "two hundred": 200, "three hundred": 300, "five hundred": 500,
  "one thousand": 1000, thousand: 1000, "two thousand": 2000,
};

/** Words that can sit between a quantity and its item keyword. */
const QUANTITY_SKIP_WORDS = new Set([
  "flex", "vinyl", "corporate", "premium", "glossy", "gloss", "matte",
  "visiting", "business", "invite", "invitation", "wedding", "menu",
  "thank", "you", "new", "extra", "custom", "printed", "printing",
  "laminated", "foil", "same", "usual", "approx", "about", "around",
  "of", "the", "our", "some", "and", "plus", "with", "only", "total",
]);

const MAX_PLAUSIBLE_QTY = 100000;

/**
 * Business-name vocabulary. The original list only covered the suffixes that
 * happened to appear in the seed data, so a new client called "Blue Orchid
 * Weddings" was silently filed as "Independent / Individual" instead of the
 * company the client actually typed. Widened to the long tail of small-business
 * suffixes a print shop actually sees.
 */
const COMPANY_SUFFIX_RE = new RegExp(
  "\\b(?:" +
  [
    "pvt", "ltd", "llp", "corp", "inc", "co", "company", "solutions", "media",
    "tech", "technologies", "interiors", "events", "studio", "studios",
    "hotels", "fitness", "traders", "trading", "designs", "prints", "printing",
    "press", "weddings", "wedding", "bakery", "cafe", "caf", "restaurant",
    "caterers", "catering", "enterprises", "industries", "associates",
    "group", "works", "hub", "labs", "lab", "academy", "clinic", "salon",
    "boutique", "mart", "exports", "decor", "films", "productions",
    "advertising", "marketing", "foods", "jewellers", "jewelry", "textiles",
    "garments", "motors", "builders", "developers", "hospital", "school",
    "schools", "college", "properties", "realty", "pharma", "logistics",
    "agencies", "agency", "consultants", "services", "systems", "infra",
  ].join("|") +
  ")\\b",
  "i"
);

/** Words that end a business name but are not part of it. */
const NAME_TRAILING_STOPWORDS = new Set([
  "and", "or", "the", "of", "for", "with", "please", "here", "need", "want",
  "urgent", "urgently", "thanks", "regards", "by", "from", "is", "at", "to",
  "in", "on", "our", "my", "we", "hi", "hello", "bhaiya", "sir", "mam",
  "plz", "pls", "kindly", "also", "plus", "only", "just",
]);

/**
 * Clean up a captured business name. The widened capture (needed for
 * "Blue Orchid Weddings") also swallows whatever follows — "Nexus Media and",
 * "Zingaro Studios cafe launch" — so drop trailing filler and cut the name off
 * right after its business suffix.
 */
function normalizeBusinessName(value) {
  let words = String(value).trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && NAME_TRAILING_STOPWORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  // The capture patterns are case-insensitive, so "for our launch" matches the
  // "for <Name>" rule and a phrase becomes a person. Drop leading filler too.
  while (words.length > 0 && NAME_TRAILING_STOPWORDS.has(words[0].toLowerCase())) {
    words.shift();
  }
  // Cut at the FIRST business suffix — but let a legal-form token extend it,
  // since "City Events Pvt Ltd" legitimately trails "Pvt Ltd" while
  // "Zingaro Studios cafe launch" trails an event description, not a name.
  const LEGAL_FORM = new Set(["pvt", "ltd", "llp", "corp", "inc", "co", "company"]);
  const suffixAt = words.findIndex((w) => COMPANY_SUFFIX_RE.test(w));
  if (suffixAt >= 0) {
    let end = suffixAt;
    while (end + 1 < words.length && LEGAL_FORM.has(words[end + 1].toLowerCase())) end++;
    words = words.slice(0, end + 1);
  }
  return words.join(" ");
}

/**
 * Find the quantity for the first keyword hit in `lowerText`.
 * @returns {{ quantity: number, explicit: boolean }} — `explicit` is false when
 * no number was found and the caller's default is being used.
 */
function extractQuantity(lowerText, keywords, defaultQuantity) {
  for (const keyword of keywords) {
    const at = lowerText.search(keyword);
    if (at < 0) continue;

    // Only look inside the same clause: stop at sentence punctuation.
    const window = lowerText
      .slice(0, at)
      .split(/[.;:!?]|\n/)
      .pop();
    const tokens = window.trim().split(/\s+/).filter(Boolean).slice(-6);

    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i].replace(/[^a-z0-9]/g, "");
      if (!token) continue;

      if (QUANTITY_SKIP_WORDS.has(token)) continue;

      // Spec tokens, not counts: "300gsm", "6x3", "a4", "350gsm".
      if (/^\d+(gsm|gm|x|ft|mm|cm|kg|inch)$/.test(tokens[i].replace(/[^a-z0-9]/g, "")) ||
          /^[a-z]\d+$/.test(token)) continue;
      if (/[a-z]/.test(token) && !NUMBER_WORDS[token]) continue;

      const value = /^\d+$/.test(token) ? parseInt(token, 10) : NUMBER_WORDS[token];
      if (value && value > 0 && value <= MAX_PLAUSIBLE_QTY) {
        return { quantity: value, explicit: true };
      }
      // Two-word numbers ("five hundred") span the previous token.
      const pair = `${tokens[i - 1] || ""} ${tokens[i]}`.replace(/[^a-z ]/g, "").trim();
      if (NUMBER_WORDS[pair]) return { quantity: NUMBER_WORDS[pair], explicit: true };
    }

    // People also put the count *after* the item — "brochures again, 1000
    // pieces". Scan forward within the same clause, skipping filler, and never
    // treat a measurement as a count ("by 5 pm", "3 days", "6 ft").
    const after = lowerText
      .slice(at)
      .split(/[.;:!?\n]/)[0]
      .trim()
      .split(/\s+/)
      .slice(1, 6);
    const UNIT_AFTER = new Set(["pm", "am", "day", "days", "hour", "hours", "week", "weeks", "month", "months", "ft", "inch", "inches", "gsm", "kg"]);
    for (let i = 0; i < after.length; i++) {
      const raw = after[i];
      const token = raw.replace(/[^a-z0-9]/g, "");
      if (!token) continue;
      if (QUANTITY_SKIP_WORDS.has(token) || token === "again" || token === "need") continue;
      if (/^\d+(gsm|gm|x|ft|mm|cm|kg|inch)$/.test(token) || /^[a-z]\d+$/.test(token)) continue;
      if (UNIT_AFTER.has((after[i + 1] || "").replace(/[^a-z]/g, ""))) continue;
      const value = /^\d+$/.test(token) ? parseInt(token, 10) : NUMBER_WORDS[token];
      if (value && value > 0 && value <= MAX_PLAUSIBLE_QTY) {
        return { quantity: value, explicit: true };
      }
    }
  }
  return { quantity: defaultQuantity, explicit: false };
}

/**
 * Parses unstructured/messy lead text (WhatsApp messages, voice note transcripts, rough emails).
 * Extracts structured customer info, print line items, paper specs, urgency, estimated quote, and missing details.
 */
export function parseMessyLead(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    return {
      success: false,
      error: "Empty message provided"
    };
  }

  const lower = text.toLowerCase();

  // 1. Extract Customer / Company Name
  let detectedName = "Unknown Lead";
  let detectedCompany = "";
  let detectedPhone = "";
  let detectedEmail = "";

  // Phone regex
  const phoneMatch = text.match(/(?:\+91[\-\s]?)?[6-9]\d{9}|\b\d{5}[\s\-]?\d{5}\b/);
  if (phoneMatch) {
    detectedPhone = phoneMatch[0];
  }

  // Email regex
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    detectedEmail = emailMatch[0];
  }

  // Name / Company heuristics — light extraction for an explicit mention
  // (keywords are word-bounded so "Zingaro Studios" never triggers the
  // "studio:" rule and swallows the rest of the sentence)
  // Up to 4 capitalised words, so multi-word business names survive the capture
  // ("Blue Orchid Weddings", "City Events Pvt Ltd") instead of being truncated
  // to two words and then failing the company-suffix test.
  const namePatterns = [
    /(?:from|myself|i am|this is|naam|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i,
    /\b(?:company|firm|agency|studio|enterprise|pvt ltd|ltd|brand|team)\b\s*(?:is|:|-)?\s*([A-Za-z0-9\s&]+?)(?=(?:,|\.|\n|phone|urgent|need|want|chahiye|$))/i,
    /(?:for|regards|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/i,
  ];

  for (const pattern of namePatterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      const val = normalizeBusinessName(m[1].trim());
      if (!val) continue;
      if (!detectedCompany && COMPANY_SUFFIX_RE.test(val)) {
        detectedCompany = val;
      } else if (detectedName === "Unknown Lead") {
        detectedName = val;
      }
    }
  }

  // --- Customer identity resolution --------------------------------------
  // 1) Exact mention of an existing account (name or company) → attach to it.
  // 2) Otherwise, typo-tolerant fuzzy match against existing accounts.
  // 3) Otherwise this is genuinely a new customer.
  // The parsed result is ALWAYS human-confirmed before anything is written to
  // the database — the parser never auto-creates records silently.
  const existingCustomers = getCustomers();
  let customerMatch = null;

  const exactHit = existingCustomers.find(
    (c) => lower.includes(c.name.toLowerCase()) || (c.company && lower.includes(c.company.toLowerCase()))
  );

  if (exactHit) {
    customerMatch = {
      id: exactHit.id,
      name: exactHit.name,
      company: exactHit.company || "",
      confidence: "high",
      method: "exact mention"
    };
    detectedName = exactHit.name;
    detectedCompany = exactHit.company || detectedCompany;
    detectedPhone = exactHit.phone || detectedPhone;
    detectedEmail = exactHit.email || detectedEmail;
  } else {
    const fuzzy = findBestCustomerMatch(text, existingCustomers);
    if (fuzzy) {
      customerMatch = {
        id: fuzzy.customer.id,
        name: fuzzy.customer.name,
        company: fuzzy.customer.company || "",
        confidence: fuzzy.confidence,
        method: "fuzzy similarity"
      };
      detectedName = fuzzy.customer.name;
      detectedCompany = fuzzy.customer.company || detectedCompany;
      detectedPhone = fuzzy.customer.phone || detectedPhone;
      detectedEmail = fuzzy.customer.email || detectedEmail;
    }
  }

  if (!customerMatch && detectedName === "Unknown Lead" && detectedCompany) {
    // E.g. "Nexus Media" (new company) → a neutral "Nexus Contact" placeholder.
    detectedName = detectedCompany.split(" ")[0] + " Contact";
  }

  // 2. Extract Items & Quantities
  const items = [];
  let estimatedTotal = 0;
  /** Line items whose quantity was defaulted rather than read from the message. */
  const missingQuantity = [];

  // Visiting cards
  const cardsFound = /card/i.test(lower);
  if (cardsFound) {
    const found = extractQuantity(lower, [/\b(?:visiting\s+cards?|business\s+cards?|cards?)\b/i], 500);
    const qty = found.quantity;
    if (!found.explicit) missingQuantity.push("Visiting Cards");

    let paper = "300gsm Art Card";
    if (/350\s*gsm/i.test(lower)) paper = "350gsm Premium";
    else if (/400\s*gsm/i.test(lower)) paper = "400gsm Heavy Card";
    else if (/matte/i.test(lower)) paper = "300gsm Matte";

    let finish = "Standard Matte";
    if (/gold\s*foil|foil\s*stamp|emboss/i.test(lower)) {
      finish = "Gold Foil Stamping + Emboss";
    } else if (/glossy|gloss/i.test(lower)) {
      finish = "Gloss Lamination";
    } else if (/velvet/i.test(lower)) {
      finish = "Velvet Touch Lamination";
    }

    const priced = repriceItem({ type: "Visiting Cards", quantity: qty, paper, finish });
    estimatedTotal += priced.estimatedPrice;
    items.push(priced);
  }

  // Brochures
  if (/brochure|pamphlet|flyer|leaflet/i.test(lower)) {
    const found = extractQuantity(lower, [/\b(?:brochures?|pamphlets?|flyers?|leaflets?)\b/i], 100);
    const qty = found.quantity;
    if (!found.explicit) missingQuantity.push("Brochures");

    let fold = "A4 Tri-fold";
    if (/bi-fold|half\s*fold|2\s*fold/i.test(lower)) fold = "A4 Bi-fold";
    else if (/a5/i.test(lower)) fold = "A5 4-Page Booklet";
    else if (/multi\s*page|catalog/i.test(lower)) fold = "8-Page Catalog";

    // Stock defaults to gloss, but a stated finish must survive: an earlier
    // revision ignored `matte` here (the cards branch honoured it, this one did
    // not), so "500 flyers, matte" was silently quoted as gloss.
    //
    // Deliberately label-only. BROCHURE_RATES has no matte tier, so inventing a
    // finish surcharge here would fabricate a price the shop doesn't charge.
    // Matte is priced the same as gloss and the difference is flagged instead.
    let paper = "170gsm Gloss Art Paper";
    if (/300\s*gsm|cover/i.test(lower)) {
      paper = "250gsm Cover / 130gsm Inner";
    } else if (/matte|lamination|laminated|lamina/i.test(lower)) {
      paper = "170gsm Matte Art Paper";
    }

    const priced = repriceItem({ type: "Brochures", quantity: qty, fold, paper });
    estimatedTotal += priced.estimatedPrice;
    items.push(priced);
  }

  // Posters / Banners
  if (/poster|banner|standee|large\s*format/i.test(lower)) {
    const found = extractQuantity(
      lower,
      [/\b(?:posters?|banners?|standees?)\b/i, /\blarge\s*format\b/i],
      10
    );
    const qty = found.quantity;
    if (!found.explicit) missingQuantity.push("Posters / Display");

    let size = "A1 Large Format";
    if (/a2/i.test(lower)) size = "A2 Poster";
    else if (/standee/i.test(lower)) size = "6x2.5ft Rollup Standee";

    const priced = repriceItem({
      type: "Posters / Display",
      quantity: qty,
      size,
      paper: "Laminated High-Res Vinyl / Sunboard"
    });
    estimatedTotal += priced.estimatedPrice;
    items.push(priced);
  }

  // If no specific item detected, create a generic one
  if (items.length === 0) {
    items.push({
      type: "Custom Print Package",
      quantity: 1,
      paper: "To be confirmed with client",
      finish: "Standard",
      estimatedPrice: 5000
    });
    estimatedTotal = 5000;
  }

  // 3. Detect Urgency & Timeline
  let priority = "normal";
  let estimatedDueDateDays = 5;
  if (/urgent|emergency|asap|jaldi|urgent\s*hai|aaj|today|kal|tomorrow|friday|2\s*days|3\s*days/i.test(lower)) {
    priority = /today|tomorrow|kal|asap|aaj/i.test(lower) ? "urgent" : "high";
    estimatedDueDateDays = priority === "urgent" ? 2 : 3;
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + estimatedDueDateDays);
  const formattedDueDate = targetDate.toISOString().split("T")[0];

  // 4. Missing Information Warnings
  const missingInfo = [];
  if (missingQuantity.length > 0) {
    missingInfo.push(`Quantity not stated for ${missingQuantity.join(", ")} — using a default, confirm with the client`);
  }
  if (!detectedPhone && !detectedEmail) missingInfo.push("No contact phone number or email provided");
  if (!items.some(i => i.paper && !i.paper.includes("To be confirmed"))) missingInfo.push("Paper GSM / stock preference unspecified");
  if (items.some(i => i.type === "Brochures") && !/tri-fold|bi-fold|a4|a5|catalog/i.test(lower)) missingInfo.push("Brochure format/folding style unclear");
  // Duplex and finish affect real cost but have no rate tier — surface it for a
  // human quote rather than letting the default single-sided rate look final.
  if (/double\s*sided|duplex|both sides/i.test(lower)) missingInfo.push("Double-sided / duplex printing mentioned — not in the standard rate card, confirm before quoting");
  if (!/design|file|cdr|pdf|ai|artwork/i.test(lower)) missingInfo.push("Artwork readiness status unknown (client file vs in-house design)");

  // 5. Suggested WhatsApp Response
  const itemsText = items.map(i => `${i.quantity}x ${i.type} (${i.paper || i.size || ""})`).join(" + ");
  const suggestedReply = `Hi ${detectedName.split(" ")[0]}! Thanks for reaching out to Shyft Studio. 😊\n\nWe have received your requirement for *${itemsText}*.\nEstimated quote: *₹${estimatedTotal.toLocaleString("en-IN")}* (approx. timeline: ${estimatedDueDateDays} working days).\n\nTo finalize your job order, could you please confirm:\n1. Do you already have print-ready PDF/CDR artwork files?\n2. Paper preference (Matte or Glossy finish)?\n3. Delivery address or workshop pickup?\n\nLooking forward to printing for you! — Abhishek, Shyft Studio`;

  const jobTitle = `${detectedCompany ? detectedCompany + " — " : ""}${items.map(i => `${i.quantity} ${i.type}`).join(" + ")}`;
  const specsSummary = items.map(i => `${i.quantity} ${i.type} (${i.paper || ""}, ${i.finish || i.fold || i.size || ""})`).join("; ");

  return {
    success: true,
    rawText,
    customer: {
      name: detectedName,
      company: detectedCompany || "Independent / Individual",
      phone: detectedPhone || "+91 98XXX XXXXX",
      email: detectedEmail || "pending@client.in",
      isNew: !customerMatch,
      match: customerMatch
    },
    job: {
      title: jobTitle,
      description: `Lead extracted via AI WhatsApp parser:\n• ${specsSummary}\n• Raw message: "${text.slice(0, 150)}${text.length > 150 ? "..." : ""}"`,
      stage: "ENQUIRY",
      priority,
      quoteAmount: estimatedTotal,
      dueDate: formattedDueDate,
      specsSummary,
      leadSource: "WhatsApp / Chat"
    },
    items,
    missingInfo,
    suggestedReply
  };
}

/**
 * Proactive Re-engagement Nudges ("catch the next order before they even ask").
 *
 * For repeat customers we learn their reorder cadence from delivered-job
 * history. When a customer is overdue past their own cadence (and has no open
 * job), they surface as "due for a check-in" — turning tribal knowledge in
 * Abhishek's head into a system rule the whole team can see.
 */
export function computeReengagementNudges({ now: nowInput } = {}) {
  const now = nowInput ? new Date(nowInput) : new Date();
  const DAY = 1000 * 60 * 60 * 24;
  const customers = getCustomers();
  const jobs = getJobs();

  const customersById = new Map(customers.map((c) => [c.id, c]));
  const jobsByCustomer = new Map();
  for (const job of jobs) {
    if (!jobsByCustomer.has(job.customer_id)) jobsByCustomer.set(job.customer_id, []);
    jobsByCustomer.get(job.customer_id).push(job);
  }

  const nudges = [];

  for (const customer of customers) {
    const customerJobs = jobsByCustomer.get(customer.id) || [];
    const delivered = customerJobs
      .filter((j) => j.stage === "DELIVERED")
      .sort((a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at));

    // Nudges are for REPEAT customers (>=2 completed orders) — one-offs get a
    // generic follow-up from Sales, not a cadence rule.
    if (delivered.length < 2) continue;

    const last = delivered[delivered.length - 1];
    const lastDate = new Date(last.updated_at || last.created_at);
    const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / DAY);

    // Average gap between successive completed orders = personal reorder cadence.
    let gaps = 0;
    for (let i = 1; i < delivered.length; i++) {
      const prev = new Date(delivered[i - 1].updated_at || delivered[i - 1].created_at);
      const next = new Date(delivered[i].updated_at || delivered[i].created_at);
      gaps += Math.max(1, Math.round((next.getTime() - prev.getTime()) / DAY));
    }
    const avgIntervalDays = Math.max(1, Math.round(gaps / (delivered.length - 1)));

    const hasOpenJob = customerJobs.some((j) => j.stage !== "DELIVERED");
    // Overdue past their own cadence (with a minimum cushion), or > 60 days
    // silent for any repeat account.
    const overCushion = daysSince >= Math.min(Math.ceil(avgIntervalDays * 1.25), avgIntervalDays + 20);
    const fallow = daysSince >= 60;
    const dueForCheckIn = !hasOpenJob && (overCushion || fallow);

    if (dueForCheckIn) {
      nudges.push({
        customerId: customer.id,
        customerName: customer.name,
        company: customer.company || "",
        phone: customer.phone || "",
        lastOrderId: last.id,
        lastOrderTitle: last.title,
        lastOrderDate: lastDate.toISOString().split("T")[0],
        avgIntervalDays,
        daysSinceLastOrder: daysSince,
        overdueByDays: Math.max(0, daysSince - avgIntervalDays),
        priority: daysSince >= avgIntervalDays * 1.75 ? "high" : "normal"
      });
    }
  }

  nudges.sort((a, b) => b.overdueByDays - a.overdueByDays);
  return nudges;
}

/**
 * Daily Briefing — the owner's "one screen" summary.
 * Deterministic formatting over live data (optionally LLM-polished later).
 * Answers, per role: what actually needs attention TODAY.
 */
export function generateDailyBriefing(role = "OWNER") {
  const allJobs = getJobs();
  const lateJobs = getLateJobs();
  const stages = getStageCounts();
  const stageMap = Object.fromEntries(stages.map((s) => [s.stage, s.count]));
  const nudges = computeReengagementNudges();

  const activeJobs = allJobs.filter((j) => j.stage !== "DELIVERED");
  const enquiryJobs = allJobs.filter((j) => j.stage === "ENQUIRY");
  const quotedJobs = allJobs.filter((j) => j.stage === "QUOTED");
  const printJobs = allJobs.filter((j) => j.stage === "PRINTING" || j.stage === "READY");
  const pipelineValue = activeJobs.reduce((s, j) => s + (j.quote_amount || 0), 0);

  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;
  const agingEnquiries = enquiryJobs.filter((j) => j.created_at && now - new Date(j.created_at).getTime() > 2 * DAY);
  const agingQuotes = quotedJobs.filter((j) => j.created_at && now - new Date(j.created_at).getTime() > 7 * DAY);
  const atRisk = allJobs.filter((j) => j.is_late || (j.due_date && new Date(j.due_date).getTime() < now && j.stage !== "DELIVERED"));

  const headline =
    lateJobs.length > 0
      ? `${lateJobs.length} job(s) at risk, ${nudges.length} repeat client(s) due for a check-in, ${agingEnquiries.length} enquiry(ies) aging without a quote.`
      : `All jobs on schedule — ${nudges.length} repeat client(s) due for a check-in, ${agingEnquiries.length} enquiry(ies) aging without a quote.`;

  const bullets = {
    OWNER: [
      `Pipeline: ₹${pipelineValue.toLocaleString("en-IN")} across ${activeJobs.length} active jobs.`,
      `${atRisk.length} job(s) at risk of missing their promise date (top: ${atRisk[0] ? `#${atRisk[0].id} ${atRisk[0].title}` : "none"}).`,
      `${nudges.length} repeat customer(s) overdue for a re-order — ask Sales to check in.`,
      `${agingEnquiries.length} enquiry(ies) unquoted for over 48h; ${agingQuotes.length} quote(s) awaiting sign-off for over a week.`
    ],
    SALES: [
      `${enquiryJobs.length} enquiry(ies) open — ${agingEnquiries.length} older than 48h and need a quote today.`,
      `${quotedJobs.length} quoted deal(s) awaiting client confirmation (${agingQuotes.length} older than a week).`,
      `${nudges.length} repeat client(s) due for a check-in based on their own order cadence.`,
      `${printJobs.length} job(s) on the floor that need proof sign-off or delivery follow-up.`
    ],
    PRODUCTION: [
      `${stageMap.PRINTING || 0} job(s) on the press / in finishing, ${stageMap.READY || 0} ready for dispatch.`,
      `${atRisk.length} job(s) flagged at risk of missing their due date — confirm ETA with Sales.`,
      `${stageMap.DESIGN || 0} job(s) waiting in design (need client proof sign-off to start printing).`
    ]
  };

  return {
    role,
    headline,
    bullets: bullets[role] || bullets.OWNER,
    counts: {
      atRisk: atRisk.length,
      late: lateJobs.length,
      overdueCheckIns: nudges.length,
      agingEnquiries: agingEnquiries.length,
      agingQuotes: agingQuotes.length,
      pipelineValue,
      activeJobs: activeJobs.length
    },
    date: new Date().toISOString().split("T")[0]
  };
}

/**
 * 1-Click Repeat Order Assistant:
 * Analyzes previous completed jobs for a customer and generates an instant re-order package.
 */
export function generateRepeatOrderPackage(customerId) {
  const customer = getCustomerById(customerId);
  if (!customer) return { success: false, error: "Customer not found" };

  const pastJobs = getCustomerJobs(customerId);
  const deliveredJobs = pastJobs.filter(j => j.stage === "DELIVERED");
  const referenceJob = deliveredJobs[0] || pastJobs[0];

  if (!referenceJob) {
    return {
      success: false,
      error: "No previous jobs found for this customer to repeat."
    };
  }

  // Compute repeat pricing (optional 5% loyalty repeat price adjustment or exact match)
  const baseQuote = referenceJob.quote_amount || 10000;
  const targetDueDate = new Date();
  targetDueDate.setDate(targetDueDate.getDate() + 4);

  const repeatJob = {
    title: `Repeat — ${referenceJob.title.replace(/^Repeat\s*—\s*/i, "")}`,
    description: `Repeat order based on Job #${referenceJob.id} (${referenceJob.title}).\nSpecs: ${referenceJob.description || "Identical past specifications"}.\nArtwork on file in archive.`,
    stage: "QUOTED",
    customerId: customer.id,
    quoteAmount: baseQuote,
    dueDate: targetDueDate.toISOString().split("T")[0],
    priority: "high",
    leadSource: "Repeat Client",
    specsSummary: referenceJob.description || "Identical to previous delivered job",
    referenceJobId: referenceJob.id,
    notes: `1-Click Repeat generated. Matches past job #${referenceJob.id} specs and pricing.`
  };

  return {
    success: true,
    customer,
    referenceJob,
    repeatJob,
    specsComparison: {
      pastJobId: referenceJob.id,
      pastStage: referenceJob.stage,
      pastQuote: referenceJob.quote_amount,
      pastDeliveredDate: referenceJob.updated_at || referenceJob.created_at,
      artworkStatus: "Artwork already verified from previous run"
    }
  };
}

/**
 * AI Production Risk & Bottleneck Intelligence
 * Analyzes print floor load, due dates, machine risks, and flags issues before they cause client friction.
 */
export function analyzeProductionRisks() {
  const allJobs = getJobs();
  const lateJobs = getLateJobs();
  const stages = getStageCounts();

  const printJobs = allJobs.filter(j => j.stage === "PRINTING");
  const designJobs = allJobs.filter(j => j.stage === "DESIGN");
  const readyJobs = allJobs.filter(j => j.stage === "READY");
  const quotedJobs = allJobs.filter(j => j.stage === "QUOTED");
  const enquiryJobs = allJobs.filter(j => j.stage === "ENQUIRY");

  const riskEvaluations = allJobs.map(job => {
    let riskLevel = "LOW";
    const reasons = [];
    const recommendations = [];

    const now = new Date();
    const dueDate = job.due_date ? new Date(job.due_date) : null;
    const isOverdue = dueDate && dueDate < now && job.stage !== "DELIVERED";
    const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    if (job.is_late || isOverdue) {
      riskLevel = "CRITICAL";
      reasons.push(`Job is overdue (due: ${job.due_date ? job.due_date.split("T")[0] : "passed"}).`);
      recommendations.push("Notify customer proactively with updated delivery ETA to protect trust.");
    } else if (job.stage === "PRINTING" && daysUntilDue !== null && daysUntilDue <= 1) {
      riskLevel = "HIGH";
      reasons.push("Due within 24h while still on the print floor.");
      recommendations.push("Prioritize in machine queue and initiate post-print cutting immediately.");
    } else if (job.stage === "DESIGN" && job.priority === "urgent") {
      riskLevel = "HIGH";
      reasons.push("Urgent priority job still waiting in Design approval.");
      recommendations.push("Abhishek to ping customer on WhatsApp for immediate digital proof sign-off.");
    } else if (job.stage === "ENQUIRY" && (!job.quote_amount || job.quote_amount === 0)) {
      riskLevel = "MODERATE";
      reasons.push("Unquoted enquiry aging in inbox.");
      recommendations.push("Sales to run Messy Lead Intake parser and send initial quote.");
    }

    if (job.notes && /paper stock|stock delay|out of stock|paper/i.test(job.notes)) {
      if (riskLevel === "LOW") riskLevel = "MODERATE";
      reasons.push("Paper stock dependency flagged in notes.");
      recommendations.push("Check warehouse reserve for 300gsm stock or contact local distributor.");
    }

    if (job.notes && /lamination|machine|emboss|foil/i.test(job.notes)) {
      reasons.push("Special finishing required (foil/lamination) requires additional drying time.");
    }

    return {
      jobId: job.id,
      title: job.title,
      customer_id: job.customer_id,
      stage: job.stage,
      priority: job.priority,
      due_date: job.due_date,
      quote_amount: job.quote_amount,
      riskLevel,
      reasons,
      recommendations
    };
  });

  // Calculate bottlenecks
  const bottlenecks = [];
  if (printJobs.length >= 2) {
    bottlenecks.push({
      stage: "PRINTING",
      severity: "High",
      description: `${printJobs.length} heavy jobs currently queued on the print floor. Machine throughput is near peak capacity.`,
      solution: "Stagger jobs across Offset vs Digital presses to clear finishing backlog."
    });
  }
  if (designJobs.length >= 1) {
    bottlenecks.push({
      stage: "DESIGN",
      severity: "Moderate",
      description: "Client design proof sign-offs are gating print starts.",
      solution: "Send WhatsApp 1-click proof approval links to speed up sign-offs."
    });
  }
  if (lateJobs.length > 0) {
    bottlenecks.push({
      stage: "DELIVERY",
      severity: "Critical",
      description: `${lateJobs.length} job(s) past promised SLA.`,
      solution: "Deploy express delivery courier or personal handoff for VIP clients."
    });
  }

  return {
    overallHealth: lateJobs.length > 1 ? "Attention Required" : lateJobs.length === 1 ? "Moderate Risk" : "Healthy",
    lateCount: lateJobs.length,
    highRiskCount: riskEvaluations.filter(r => r.riskLevel === "CRITICAL" || r.riskLevel === "HIGH").length,
    riskEvaluations,
    bottlenecks,
    summary: {
      enquiry: enquiryJobs.length,
      quoted: quotedJobs.length,
      design: designJobs.length,
      printing: printJobs.length,
      ready: readyJobs.length,
      delivered: allJobs.filter(j => j.stage === "DELIVERED").length
    }
  };
}

/**
 * "What needs me today", phrased the way a busy person actually types it.
 *
 * A hand-written intent router only looks clever until someone uses it. The
 * original pattern (`what should i (focus|do|prioritize)`) missed the obvious
 * "what should Abhishek work on today" and dropped it to the fallback help menu
 * — which reads to a user as "the AI didn't understand", not "I phrased it
 * unusually". These variants are additive and each still requires a
 * prioritisation verb, so none of them steal a turn from the narrower intents
 * below (late jobs, revenue, bottlenecks, customer history).
 */
const BRIEFING_INTENT = new RegExp(
  [
    "briefing|daily digest|good morning|morning (update|brief|report)",
    "\\b(priorities|agenda)\\b",
    "what(?:'s| is)? on my (plate|desk|list|radar)",
    "what needs (my|the|our) (attention|focus)",
    // Subject may be "i"/"we" or a teammate's name/role, because the team asks
    // about each other in the third person ("what should siddhant pick up").
    "what should (i|we|samyak|abhishek|siddhant|the (owner|sales (?:guy|person|team)?|production|prod\\w*)) (focus(?: on)?|work(?: on)?|do|prioritize|start(?: with| on)?|pick up|tackle|handle)",
  ].join("|"),
  "i"
);

/**
 * A named teammate in the query selects *their* lens, so the owner asking
 * "what should siddhant work on" gets the production brief, not his own.
 */
const BRIEFING_LENS_BY_PERSONA = [
  [/samyak|the owner/i, "OWNER"],
  [/abhishek|sales/i, "SALES"],
  [/siddhant|production|print floor/i, "PRODUCTION"],
];

/**
 * Natural Language Query & Action Agent Copilot
 * Understands cross-role queries, calculates financials, analyzes jobs, and drafts communications.
 */
export function processCopilotQuery(queryText, userRole = "OWNER") {
  const query = String(queryText || "").trim().toLowerCase();
  const customerList = getCustomers();

  // 1. Draft Communications (WhatsApp follow-ups, delay apologies, quote emails) - Check this FIRST
  if (/draft|apology|message|whatsapp|reply|write to|email/.test(query)) {
    if (/singh|delay|late/i.test(query)) {
      return {
        answer: `### ✍️ Draft Apology Message for Singh & Sons\n\n*Copy & send via WhatsApp:*\n\n> "Hi Karan, Samyak here from Shyft Studio. I am personally following up regarding your visiting cards (Job #7). Our premium paper stock was held up at the distributor yesterday, causing a 24-hour delay. We have expedited your print run on priority this morning and will personally deliver it to your office by 3:00 PM today. We sincerely apologize for the delay and thank you for your patience!"`
      };
    }
    if (/priya|enquiry|messy|follow up/i.test(query)) {
      return {
        answer: `### ✍️ Draft Follow-up for Priya Nair (Messy Enquiry)\n\n*Copy & send via WhatsApp:*\n\n> "Hi Priya! Abhishek from Shyft Studio following up on your conference brochure enquiry. We want to ensure you get the best pricing and print finish. Could you please share the approximate quantity needed (e.g. 100 or 500 copies) and if you require A4 tri-fold or booklet format? We can share digital samples right away!"`
      };
    }
    return {
      answer: `### ✍️ General Client Follow-up Draft\n\n> "Hi! Following up from Shyft Studio regarding your print project. We have your specifications ready and can proceed with printing as soon as you approve the digital proof. Please let us know if you have any questions!"`
    };
  }

  // 2. Daily Briefing — one-screen "what needs me today" per role
  if (BRIEFING_INTENT.test(query)) {
    const personaLens = BRIEFING_LENS_BY_PERSONA.find(([re]) => re.test(query));
    const briefRole = personaLens ? personaLens[1] : userRole;
    const brief = generateDailyBriefing(briefRole);
    return {
      answer: `### 📌 Daily Briefing — ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}\n\n${brief.headline}\n\n${brief.bullets.map((b) => `• ${b}`).join("\n")}\n\n*Open the Dashboard for the live view behind this summary.*`
    };
  }

  // 3. Proactive re-engagement — repeat customers overdue for their next order
  if (/check.?in|hasn.?t ordered|haven.?t ordered|not ordered in|who (has|hasn.?t|haven.?t).*ordered|re.?engag|cadence|churn|due for (a )?(repeat|re.?order|new order)|repeat (customers?|clients?|accounts?) (who|due|overdue|not)|catch .*next (order|job)/.test(query)) {
    const due = computeReengagementNudges();
    const customerRef = customerList.find(
      (c) => query.includes(c.name.toLowerCase()) ||
        (c.company && c.company.toLowerCase().split(/[^a-z0-9]+/).some((t) => t.length >= 5 && query.includes(t)))
    );
    const filtered = customerRef ? due.filter((n) => n.customerId === customerRef.id) : due;
    if (customerRef && !filtered.length) {
      return { answer: `✅ **${customerRef.name} is not due for a check-in.** They have no open job but are still inside their usual reorder window (or have an active job).` };
    }
    if (!filtered.length) {
      return { answer: "✅ **No repeat customer is currently due for a check-in.** Everyone with a reorder cadence is inside their window or already has an open job." };
    }
    const lines = filtered.map(n => `• **${n.customerName}**${n.company ? ` (${n.company})` : ""} — ${n.daysSinceLastOrder} days since last order, typical cadence ~${n.avgIntervalDays} days (${n.overdueByDays} days past window).`).join("\n");
    return {
      answer: `### 🔔 ${customerRef ? `${customerRef.name} — due for a check-in` : `Repeat Customers Due for a Check-in (${filtered.length})`}\n\n${lines}\n\n👉 *Open their customer profile and use **1-Click Repeat Order** to prep the next quote in seconds.*`
    };
  }

  // 4. Sales intake hygiene — unquoted / aging enquiries
  if (/unquoted|enquir(y|ies) (that )?need|leads? (needing|that need)|aging/.test(query)) {
    const open = getJobs().filter(j => j.stage === "ENQUIRY" && !j.quote_amount);
    if (!open.length) return { answer: "✅ **No unquoted enquiries.** Every open enquiry has a quote attached." };
    const lines = open.map(j => { const c = getCustomerById(j.customer_id); return `• **#${j.id}** ${j.title} — ${c?.name || "Customer"} (created ${j.created_at ? j.created_at.split("T")[0] : "?"})`; }).join("\n");
    return {
      answer: `### 🎯 Unquoted Enquiries Needing Follow-up (${open.length})\n\n${lines}\n\n💡 *Tip: run the AI WhatsApp Intake parser to turn any of these into a structured quote.*`
    };
  }

  // 5. Revenue & Financial Summary
  if (/revenue|pipeline value|financial|money|total quoted|quoted deals|value of quoted|income|sales summary|how much/.test(query)) {
    const allJobs = getJobs();
    const activeJobs = allJobs.filter(j => j.stage !== "DELIVERED");
    const pipelineValue = activeJobs.reduce((sum, j) => sum + (j.quote_amount || 0), 0);
    const realizedValue = allJobs.filter(j => j.stage === "DELIVERED").reduce((sum, j) => sum + (j.quote_amount || 0), 0);
    const lateJobs = getLateJobs();
    const lateValue = lateJobs.reduce((sum, j) => sum + (j.quote_amount || 0), 0);

    return {
      answer: `### 📊 Financial & Pipeline Summary\n\n- **Active Pipeline Value:** ₹${pipelineValue.toLocaleString("en-IN")} (${activeJobs.length} active jobs)\n- **Realized Delivered Revenue:** ₹${realizedValue.toLocaleString("en-IN")}\n- **Revenue at Late / Delay Risk:** ₹${lateValue.toLocaleString("en-IN")} (${lateJobs.length} jobs)\n- **Average Ticket Size:** ₹${Math.round(pipelineValue / (activeJobs.length || 1)).toLocaleString("en-IN")}\n\n*Top active pipeline deal:* ${activeJobs.sort((a,b) => (b.quote_amount||0) - (a.quote_amount||0))[0]?.title || "None"}.`
    };
  }

  // 6. Operational Bottlenecks & Print Floor
  if (/bottleneck|stuck|machine|print floor|queue|backlog|capacity|throughput|paper stock|lamination|stock alert/.test(query) || (/delay/i.test(query) && !/draft|message/i.test(query))) {
    const riskData = analyzeProductionRisks();
    const bottlenecksList = riskData.bottlenecks.map(b => `• **[${b.stage}]** ${b.description} *(Action: ${b.solution})*`).join("\n");
    return {
      answer: `### ⚙️ Production Bottleneck Radar\n\n**Overall Status:** ${riskData.overallHealth} (${riskData.highRiskCount} jobs needing active intervention)\n\n${bottlenecksList || "No major hardware or stage bottlenecks detected today."}\n\n**Next Best Action:** Siddhant to prioritize Job #7 (Singh & Sons) and complete Job #6 lamination.`
    };
  }

  // 7. Specific customer history & re-orders
  // Exact mention first; otherwise a scored match on first name / company
  // fragment so "what did Neha from BrightTech order last time?" still resolves.
  let matchedCustomer = null;
  let bestCustomerScore = 0;
  for (const c of customerList) {
    let score = 0;
    if (query.includes(c.name.toLowerCase())) score += 3;
    if (c.company && query.includes(c.company.toLowerCase())) score += 3;
    const nameWords = c.name.toLowerCase().split(" ");
    if (nameWords.length >= 2 && nameWords[0].length >= 3 && query.includes(nameWords[0])) score += 1.5;
    if (c.company) {
      const companyTokens = c.company.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 5);
      if (companyTokens.some((t) => query.includes(t))) score += 2;
    }
    if (score > bestCustomerScore) {
      bestCustomerScore = score;
      matchedCustomer = c;
    }
  }

  if (matchedCustomer && bestCustomerScore >= 1.5 && (/order|history|what did|repeat|specs|previous|spend|ltv|last|pending|active jobs/.test(query))) {
    const jobs = getCustomerJobs(matchedCustomer.id);
    const totalSpent = jobs.reduce((s, j) => s + (j.quote_amount || 0), 0);
    const jobLines = jobs.map(j => `• **#${j.id} [${j.stage}]** ${j.title} — ₹${(j.quote_amount||0).toLocaleString("en-IN")} *(Due: ${j.due_date ? j.due_date.split("T")[0] : "N/A"})*`).join("\n");

    return {
      answer: `### 👤 Customer 360: ${matchedCustomer.name} (${matchedCustomer.company || "Independent"})\n\n- **Phone:** ${matchedCustomer.phone || "N/A"} | **Email:** ${matchedCustomer.email || "N/A"}\n- **Lifetime Value (LTV):** ₹${totalSpent.toLocaleString("en-IN")} across ${jobs.length} orders\n- **Client Notes:** ${matchedCustomer.notes || "None"}\n\n**Order History:**\n${jobLines}\n\n💡 *Tip: You can generate a 1-click repeat order for this client directly from their profile page.*`
    };
  }

  // 8. Late / Overdue jobs check
  if (/late|delayed|overdue|behind|urgent/.test(query)) {
    const late = getLateJobs();
    if (!late.length) return { answer: "✅ **All jobs are currently on schedule.** No late orders flagged in the pipeline." };
    const list = late.map(j => `• **#${j.id} ${j.title}** (${j.customer_name}) — Stage: \`${j.stage}\` | Due: ${j.due_date ? j.due_date.split("T")[0] : "Overdue"} | Note: *${j.notes || "No notes"}*`).join("\n");
    return {
      answer: `### ⚠️ Late / At-Risk Jobs (${late.length})\n\n${list}\n\n**Recommended Action:** Siddhant to fast-track print completion; Abhishek to notify clients.`
    };
  }

  // 9. Stage summary & pipeline overview
  if (/pipeline|summary|overview|status|stages|all jobs/.test(query)) {
    const stages = getStageCounts();
    const total = stages.reduce((s, r) => s + r.count, 0);
    const stageLines = stages.map(s => `• **${s.stage}:** ${s.count} jobs`).join("\n");
    return {
      answer: `### 📋 Pipeline Stage Breakdown (${total} Total Jobs)\n\n${stageLines}\n\n👉 *Use the Role Lens tabs on the Pipeline Board to view specialized Sales, Production, or Financial perspectives.*`
    };
  }

  // 10. Fallback helpful response
  return {
    answer: `### 🤖 Shyft Copilot Ready\n\nI can assist with:\n- 📌 **Daily Briefing:** *"Give me today's briefing"*\n- 📈 **Financials:** *"What is our total pipeline revenue?"*\n- ⚠️ **Operations:** *"Show print floor bottlenecks and machine load"*\n- 👤 **Customer 360:** *"What did Neha from BrightTech order last time?"*\n- ✍️ **Action Drafts:** *"Draft an apology message for Singh & Sons delay"*\n- 🔔 **Re-engagement:** *"Which repeat clients are due for a check-in?"*\n- 🎯 **Sales:** *"Show unquoted leads needing follow-up"*`
  };
}
