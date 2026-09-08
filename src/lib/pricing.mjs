// Canonical Shyft Studio pricing table.
//
// This is the SINGLE SOURCE OF TRUTH for money. Both the deterministic parser and the
// LLM provider path price line items through here, so a model can never invent a rate.
// If you change a rate, you change it once, in this file.

export const CARD_RATES = {
  base: 2.5,
  "Gold Foil Stamping + Emboss": 5.0,
  "Velvet Touch Lamination": 4.0,
  "Gloss Lamination": 2.8,
};

export const BROCHURE_RATES = {
  base: 18,
  cover: 26, // 300gsm / "cover" stock
  volumeDiscounts: [
    { minQty: 1000, factor: 0.65 },
    { minQty: 500, factor: 0.8 },
  ],
};

export const POSTER_UNIT_PRICE = 450;
export const CUSTOM_PACKAGE_PRICE = 5000;

function toQty(value) {
  const n = parseInt(String(value ?? "").replace(/,/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Recomputes unitRate + estimatedPrice for a line item from the canonical table.
 * Accepts items produced by the regex parser OR by a normalized LLM extraction.
 * Returns a new object; never mutates the input.
 */
export function repriceItem(rawItem) {
  const item = { ...(rawItem || {}) };
  const type = String(item.type || "");
  const quantity = toQty(item.quantity);
  const finish = String(item.finish || "");
  const paper = String(item.paper || "");

  if (/visiting|business\s*card|^cards?$/i.test(type)) {
    const unitRate =
      CARD_RATES[finish] ??
      (/foil|emboss/i.test(finish) ? CARD_RATES["Gold Foil Stamping + Emboss"]
        : /velvet/i.test(finish) ? CARD_RATES["Velvet Touch Lamination"]
        : /gloss/i.test(finish) ? CARD_RATES["Gloss Lamination"]
        : CARD_RATES.base);
    return { ...item, quantity, unitRate, estimatedPrice: Math.round(quantity * unitRate) };
  }

  if (/brochure|pamphlet|flyer|leaflet/i.test(type)) {
    let unitRate = /300\s*gsm|cover|250gsm/i.test(paper) ? BROCHURE_RATES.cover : BROCHURE_RATES.base;
    for (const tier of BROCHURE_RATES.volumeDiscounts) {
      if (quantity >= tier.minQty) {
        unitRate = Math.round(unitRate * tier.factor);
        break;
      }
    }
    return { ...item, quantity, unitRate, estimatedPrice: Math.round(quantity * unitRate) };
  }

  if (/poster|banner|standee|display/i.test(type)) {
    return { ...item, quantity, estimatedPrice: quantity * POSTER_UNIT_PRICE };
  }

  // Custom / unrecognised package — flat placeholder pending a real quote.
  return { ...item, quantity: quantity || 1, estimatedPrice: CUSTOM_PACKAGE_PRICE };
}

/** Prices every line item and returns { items, total }. */
export function priceItems(items) {
  const priced = (Array.isArray(items) && items.length ? items : [{ type: "Custom Print Package", quantity: 1, paper: "To be confirmed with client", finish: "Standard" }])
    .map(repriceItem);
  const total = priced.reduce((sum, i) => sum + (i.estimatedPrice || 0), 0);
  return { items: priced, total };
}
