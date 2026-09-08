/**
 * Shyft Studio — LLM provider seam.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The intake parser in `ai-engine.mjs` is a deterministic rules engine: fast,
 * free, debuggable offline, and good enough to demo. Its known ceiling is
 * exactly the kind of message a regex cannot read ("the usual, but make it the
 * thicker stock this time"). The README always described this engine as sitting
 * behind a "provider seam" — this file makes that seam real instead of a claim.
 *
 * DESIGN RULES
 * ------------
 * 1. OFFLINE BY DEFAULT. No API key configured → `available: false`, and the
 *    app behaves byte-for-byte as it does today. Nothing calls the network.
 * 2. THE LLM MAY FILL GAPS, IT MAY NOT SET PRICES. Quantities, line items and
 *    `quoteAmount` always come from the deterministic engine plus the canonical
 *    rate table in `pricing.mjs`. A model can never invent a rate.
 * 3. HUMAN IN THE LOOP IS UNCHANGED. Enriched output still lands in the same
 *    editable review panel; nothing is written to the DB without a click.
 * 4. FAIL SOFT. A provider timeout, a 429, or malformed JSON degrades to the
 *    deterministic result — a flaky LLM must never take intake down.
 */

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Build a provider client from the environment.
 * Any OpenAI-compatible endpoint works (OpenAI, Groq, Together, vLLM, Ollama)
 * by pointing SHYFT_LLM_BASE_URL at it.
 */
export function createLlmClient(env = process.env) {
  const apiKey = env.SHYFT_LLM_API_KEY || "";
  if (!apiKey) {
    return {
      available: false,
      reason: "SHYFT_LLM_API_KEY is not set — running on the deterministic engine",
      async complete() {
        throw new Error("No LLM provider configured");
      },
    };
  }

  const baseUrl = (env.SHYFT_LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = env.SHYFT_LLM_MODEL || DEFAULT_MODEL;

  return {
    available: true,
    reason: `OpenAI-compatible provider at ${baseUrl} (${model})`,
    /** @param {string} system @param {string} user @returns {Promise<object>} parsed JSON */
    async complete(system, user) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`provider responded ${response.status}`);
      }
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("provider returned an empty completion");
      return JSON.parse(text);
    },
  };
}

const SYSTEM_PROMPT = `You are the intake assistant for Shyft Studio, a 3-person commercial print shop in India.
Read one messy customer message (WhatsApp, voice-note transcript, or walk-in note) and return JSON only.

Return exactly these keys:
  "contactName": string  — the human's name, or "" if not stated
  "company":     string  — the business name, or "" if not stated
  "phone":       string  — digits only, or "" if not stated
  "email":       string  — or "" if not stated
  "specs":       string  — paper stock / GSM / finish / size details, or ""
  "artwork":     string  — one of "client file", "needs design", "reuse previous", "unknown"
  "missingInfo": string[] — facts the shop needs before it can quote

RULES:
- Only report what the message actually says. Never guess or invent values.
- Do NOT estimate prices, quantities, or dates. Those are computed elsewhere.
- If a field is absent, use "" (or [] for missingInfo).`;

const clamp = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/**
 * Ask the provider to fill the gaps the rules engine could not, then merge.
 *
 * @param {string} rawText   the original message
 * @param {object} base      result of `parseMessyLead(rawText)`
 * @param {object} client    from `createLlmClient()`
 * @returns {Promise<object>} `base` with `enrichment` provenance attached
 */
export async function enrichLeadWithLLM(rawText, base, client) {
  if (!base?.success) return base;
  if (!client?.available) {
    return {
      ...base,
      enrichment: { applied: false, reason: client?.reason || "no provider configured" },
    };
  }

  let payload;
  try {
    payload = await client.complete(SYSTEM_PROMPT, String(rawText || ""));
  } catch (error) {
    // Fail soft: the deterministic extraction is already a usable result.
    return {
      ...base,
      enrichment: { applied: false, reason: `provider error — ${error.message}` },
    };
  }

  const out = JSON.parse(JSON.stringify(base)); // deep copy, never mutate the input
  const provenance = [];

  // --- contact identity: fill blanks only -------------------------------
  const placeholderContact = !base.customer.match && /Contact$/.test(base.customer.name);
  const llmName = clamp(payload.contactName, 80);
  if (llmName && (placeholderContact || base.customer.name === "Unknown Lead")) {
    out.customer.name = llmName;
    provenance.push("customer.name");
  }

  // Only trust a company the rules engine failed to find, and only when there
  // is no existing account already matched (identity resolution stays local).
  const llmCompany = clamp(payload.company, 120);
  if (llmCompany && !base.customer.match && base.customer.company === "Independent / Individual") {
    out.customer.company = llmCompany;
    provenance.push("customer.company");
  }

  const llmPhone = clamp(payload.phone, 32).replace(/[^\d+]/g, "");
  if (llmPhone && /\d{5}/.test(llmPhone) && !/\d{5}/.test(base.customer.phone || "")) {
    out.customer.phone = llmPhone;
    provenance.push("customer.phone");
  }

  const llmEmail = clamp(payload.email, 160);
  if (/@/.test(llmEmail) && /pending@/.test(base.customer.email || "")) {
    out.customer.email = llmEmail;
    provenance.push("customer.email");
  }

  // --- specs: append, never overwrite the priced line items -------------
  const llmSpecs = clamp(payload.specs, 300);
  if (llmSpecs && !out.job.specsSummary.includes(llmSpecs)) {
    out.job.specsSummary = `${out.job.specsSummary}${out.job.specsSummary ? "; " : ""}${llmSpecs}`;
    provenance.push("job.specsSummary");
  }

  if (payload.artwork && out.missingInfo.some((m) => /Artwork readiness/i.test(m))) {
    out.missingInfo = out.missingInfo.map((m) =>
      /Artwork readiness/i.test(m) ? `Artwork: ${clamp(payload.artwork, 40)}` : m
    );
    provenance.push("artwork");
  }

  // --- extra missing-info flags, deduped and length-capped ---------------
  if (Array.isArray(payload.missingInfo)) {
    const extra = payload.missingInfo
      .filter((m) => typeof m === "string" && m.trim().length > 3)
      .map((m) => m.trim().slice(0, 160))
      .slice(0, 5)
      .filter((m) => !out.missingInfo.some((x) => x.toLowerCase() === m.toLowerCase()));
    if (extra.length) {
      out.missingInfo = [...out.missingInfo, ...extra];
      provenance.push("missingInfo");
    }
  }

  out.enrichment = {
    applied: provenance.length > 0,
    fields: provenance,
    reason: provenance.length ? "provider filled gaps the rules engine left blank" : "provider added nothing new",
  };

  // The provider must never have touched money or quantities. Enforced, not trusted.
  out.job.quoteAmount = base.job.quoteAmount;
  out.items = base.items;
  return out;
}
