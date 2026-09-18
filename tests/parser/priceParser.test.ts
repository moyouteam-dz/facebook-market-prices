import { describe, expect, it } from "vitest";
import {
  normalizeArabicPriceText,
  parsePriceCandidates,
} from "../../src/parser/priceParser";

describe("Arabic price parser", () => {
  it("normalizes Arabic-Indic digits and common range separators", () => {
    expect(normalizeArabicPriceText("البصل ٣٥–٤٠ دج")).toBe(
      "البصل 35-40 دج",
    );
    expect(normalizeArabicPriceText("الثوم ٦٠٠_٧٥٠ دج")).toBe(
      "الثوم 600-750 دج",
    );
  });

  it("extracts a ranged DZD price with a generic product phrase", () => {
    expect(parsePriceCandidates("البصل : 35–40 دج")).toEqual([
      expect.objectContaining({
        product: "البصل",
        price_min: 35,
        price_max: 40,
        currency: "DZD",
        confidence: "high",
      }),
    ]);
  });

  it("stores a single price as min=max", () => {
    expect(parsePriceCandidates("بطاطا 80 دج")).toEqual([
      expect.objectContaining({
        product: "بطاطا",
        price_min: 80,
        price_max: 80,
        currency: "DZD",
      }),
    ]);
  });

  it("parses multiple product lines without requiring a fixed catalog", () => {
    const result = parsePriceCandidates(
      "القرع 80-100 دج\nالزيتون 250-450 دج\nالذرة 85 دج",
    );

    expect(result).toHaveLength(3);
    expect(result.map((row) => row.product)).toEqual([
      "القرع",
      "الزيتون",
      "الذرة",
    ]);
  });

  it("keeps noisy OCR-like candidates with lower confidence", () => {
    expect(parsePriceCandidates("*** فلفل ??? ١٢٠ دج")[0]).toEqual(
      expect.objectContaining({
        product: "فلفل",
        price_min: 120,
        price_max: 120,
        confidence: "medium",
      }),
    );
  });
});
