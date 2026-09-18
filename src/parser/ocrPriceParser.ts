import { normalizeArabicPriceText, parsePriceCandidates, type PriceCandidate } from "./priceParser";

const NUMBER = "(\\d+(?:[.,]\\d+)?)";

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

function cleanProduct(value: string): string {
  return value
    .replace(/^[^\p{L}]+/gu, "")
    .replace(/[^\p{L}]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function plausibleProduct(value: string): boolean {
  const product = cleanProduct(value);
  const letters = product.match(/\p{L}/gu)?.length ?? 0;
  return letters >= 3 && !/\d/u.test(product);
}

function candidate(productRaw: string, aRaw: string, bRaw?: string): PriceCandidate | null {
  const product = cleanProduct(productRaw);
  if (!plausibleProduct(product)) return null;

  const a = parseNumber(aRaw);
  const b = bRaw ? parseNumber(bRaw) : a;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  // Wholesale OCR without an explicit currency marker is too noisy below 10 DZD.
  if (a < 10 || b < 10) return null;

  return {
    product,
    normalized_product: product,
    price_min: Math.min(a, b),
    price_max: Math.max(a, b),
    currency: "DZD",
    confidence: "medium",
    raw_text: [productRaw, aRaw, bRaw].filter(Boolean).join(" ").trim(),
  };
}

export function parseOcrPriceCandidates(input: string): PriceCandidate[] {
  const normalized = normalizeArabicPriceText(input);
  const output: PriceCandidate[] = [];

  for (const line of normalized.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    // Dates, row numbers and document references frequently become false prices.
    if (/\b(?:19|20)\d{2}[\/.\-]\d{1,2}(?:[\/.\-]\d{1,2})?\b/u.test(line)) continue;
    if (/^\d{1,3}$/u.test(line)) continue;

    // Explicit DZD markers remain the strongest deterministic evidence.
    if (/(?:دج|د\.?\s*j|دينار)/iu.test(line)) {
      for (const parsed of parsePriceCandidates(line)) {
        if (plausibleProduct(parsed.product)) output.push(parsed);
      }
      continue;
    }

    const twoPrices = line.match(new RegExp("^(.+?\\p{L}.+?)\\s+" + NUMBER + "\\s+" + NUMBER + "$", "u"));
    if (twoPrices) {
      const parsed = candidate(twoPrices[1] ?? "", twoPrices[2] ?? "", twoPrices[3]);
      if (parsed) output.push(parsed);
      continue;
    }

    const onePrice = line.match(new RegExp("^(.+?\\p{L}.+?)\\s+" + NUMBER + "$", "u"));
    if (onePrice) {
      const parsed = candidate(onePrice[1] ?? "", onePrice[2] ?? "");
      if (parsed) output.push(parsed);
    }
  }

  return output;
}
