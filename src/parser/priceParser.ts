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
const PRICE_WITHOUT_CURRENCY_PATTERN =
  /^(.*?)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*$/u;
const PRICE_ONLY_PATTERN =
  /^(\d+(?:[.,]\d+)?)\s*(?:-\s*(\d+(?:[.,]\d+)?))?\s*(?:دج|د\.?\s*j|دينار(?:\s+جزائري)?)(?:\s|$)/iu;

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

export function parsePriceCandidates(input: string): PriceCandidate[] {
  const normalized = normalizeArabicPriceText(input);
  const candidates: PriceCandidate[] = [];

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    let match = rawLine.match(PRICE_PATTERN);
    let rawProduct = match?.[1] ?? "";
    // A price-only line also matches PRICE_PATTERN with an empty product.
    // Treat that as unresolved so OCR layouts split across adjacent lines can use the previous line.
    if (match && !cleanProduct(rawProduct)) match = null;
    let confidence: Confidence | undefined;

    if (!match) {
      const priceOnly = rawLine.match(PRICE_ONLY_PATTERN);
      const previousLine = index > 0 ? lines[index - 1] ?? "" : "";
      if (priceOnly && previousLine && !/\d/.test(previousLine)) {
        rawProduct = previousLine;
        match = [rawLine, rawProduct, priceOnly[1], priceOnly[2]] as RegExpMatchArray;
      }
    }

    if (!match) {
      match = rawLine.match(PRICE_WITHOUT_CURRENCY_PATTERN);
      if (match) confidence = "medium";
    }

    if (!match) continue;

    const product = cleanProduct(rawProduct || match[1] || "");
    if (!product) continue;

    const min = parseNumber(match[2]);
    const max = match[3] ? parseNumber(match[3]) : min;
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;

    candidates.push({
      product,
      normalized_product: product,
      price_min: Math.min(min, max),
      price_max: Math.max(min, max),
      currency: "DZD",
      confidence: confidence ?? confidenceFor(rawProduct || match[1] || "", product),
      raw_text: rawLine,
    });
  }

  return candidates;
}
