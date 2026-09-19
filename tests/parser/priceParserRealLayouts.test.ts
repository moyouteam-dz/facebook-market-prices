import { describe, expect, it } from "vitest";
import { parsePriceCandidates } from "../../src/parser/priceParser";

describe("price parser with real Facebook/OCR layouts", () => {
  it("extracts a price when DZD is omitted but the line is product plus a plausible price", () => {
    expect(parsePriceCandidates("البصل 35-40")).toEqual([
      expect.objectContaining({
        product: "البصل",
        price_min: 35,
        price_max: 40,
        currency: "DZD",
        confidence: "medium",
      }),
    ]);
  });

  it("extracts a product and price split by OCR onto adjacent lines", () => {
    expect(parsePriceCandidates("بطاطا\n80 دج")).toEqual([
      expect.objectContaining({
        product: "بطاطا",
        price_min: 80,
        price_max: 80,
      }),
    ]);
  });
  it("rejects a bare single number without currency so phone numbers, years, and quantities are not treated as prices", () => {
    expect(parsePriceCandidates("الهاتف 0550123456")).toEqual([]);
    expect(parsePriceCandidates("سنة 2026")).toEqual([]);
    expect(parsePriceCandidates("الكمية 25")).toEqual([]);
  });

});
