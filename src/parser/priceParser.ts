export type Confidence = "high" | "medium" | "low";

export interface PriceCandidate {
  product: string;
  normalized_product: string;
  price_min: number;
  price_max: number;
  currency: "DZD";
  confidence: Confidence;
  raw_text: string;
}

const ARABIC_INDIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

export function normalizeArabicPriceText(input: string): string {
  return input
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_INDIC_DIGITS[digit] ?? digit)
    .replace(/[–—_]/g, "-")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *- */g, "-")
    .replace(/ *د\s*ج/g, " دج")
    .trim();
}

function cleanProduct(raw: string): string {
  return raw
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .replace(/[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function confidenceFor(rawProduct: string, product: string): Confidence {
  if (!product) {
    return "low";
  }

  const obviousNoise = (rawProduct.match(/[?*#@!]+/g) ?? []).join("").length;
  if (obviousNoise > 0) {
    return "medium";
  }

  if (product.length <= 1) {
    return "low";
  }

  return "high";
}

const PRICE_PATTERN =
  /^(.*?)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(?:-\s*(\d+(?:[.,]\d+)?))?\s*(?:دج|د\.?\s*j|دينار(?:\s+جزائري)?)(?:\s|$)/iu;

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

export function parsePriceCandidates(input: string): PriceCandidate[] {
  const normalized = normalizeArabicPriceText(input);
  const candidates: PriceCandidate[] = [];

  for (const rawLine of normalized.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const match = line.match(PRICE_PATTERN);
    if (!match) {
      continue;
    }

    const rawProduct = match[1] ?? "";
    const product = cleanProduct(rawProduct);
    if (!product) {
      continue;
    }

    const min = parseNumber(match[2]);
    const max = match[3] ? parseNumber(match[3]) : min;

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      continue;
    }

    candidates.push({
      product,
      normalized_product: product,
      price_min: Math.min(min, max),
      price_max: Math.max(min, max),
      currency: "DZD",
      confidence: confidenceFor(rawProduct, product),
      raw_text: rawLine,
    });
  }

  return candidates;
}
