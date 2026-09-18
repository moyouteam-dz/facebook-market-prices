import { describe, expect, it } from "vitest";
import { parseOcrPriceCandidates } from "../../src/parser/ocrPriceParser";

describe("OCR price parser", () => {
  it("rejects photo OCR noise that merely ends with tiny numbers", () => {
    expect(parseOcrPriceCandidates("خخ ال 5\nويا 2\n4 12734 21\nل ا 0")).toEqual([]);
  });

  it("extracts plausible wholesale table rows with two prices", () => {
    expect(parseOcrPriceCandidates("البطاطا 70 75\nالثوم 600 750")).toEqual([
      expect.objectContaining({ product: "البطاطا", price_min: 70, price_max: 75 }),
      expect.objectContaining({ product: "الثوم", price_min: 600, price_max: 750 }),
    ]);
  });

  it("keeps explicit DZD OCR prices", () => {
    expect(parseOcrPriceCandidates("القرع 80 دج")).toEqual([
      expect.objectContaining({ product: "القرع", price_min: 80, price_max: 80 }),
    ]);
  });

  it("keeps plausible one-price OCR rows without currency but rejects dates and row numbers", () => {
    expect(parseOcrPriceCandidates("البصل 35\n2026/09/18\n01")).toEqual([
      expect.objectContaining({ product: "البصل", price_min: 35, price_max: 35 }),
    ]);
  });
  it("rejects common Arabic document/header noise with plausible-looking numbers", () => {
    expect(parseOcrPriceCandidates("الجمهورية الجزائرية 2026\nرقم الوثيقة 12734\nالصفحة 21\nالسوق 43")).toEqual([]);
  });

  it("rejects implausibly wide OCR ranges caused by unrelated table columns", () => {
    expect(parseOcrPriceCandidates("البطاطا 35 750")).toEqual([]);
  });

  it("accepts common one-word Arabic vegetable names", () => {
    expect(parseOcrPriceCandidates("لفت 80\nثوم 600")).toEqual([
      expect.objectContaining({ product: "لفت", price_min: 80, price_max: 80 }),
      expect.objectContaining({ product: "ثوم", price_min: 600, price_max: 600 }),
    ]);
  });
});
