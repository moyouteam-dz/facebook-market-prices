import { describe, expect, it } from "vitest";
import { validateReviewCandidate } from "../../src/review/validation";

const base = {
  product: "بطاطا",
  price_min: 80,
  price_max: 100,
};

describe("review validation", () => {
  it("accepts a non-empty product and finite non-negative ordered prices", () => {
    expect(validateReviewCandidate(base)).toEqual({ valid: true });
  });

  it("rejects blank products", () => {
    expect(validateReviewCandidate({ ...base, product: "   " })).toEqual({
      valid: false,
      reason: "product_required",
    });
  });

  it("rejects NaN, infinity and negative prices", () => {
    expect(validateReviewCandidate({ ...base, price_min: Number.NaN })).toEqual({
      valid: false,
      reason: "invalid_price",
    });
    expect(validateReviewCandidate({ ...base, price_max: Number.POSITIVE_INFINITY })).toEqual({
      valid: false,
      reason: "invalid_price",
    });
    expect(validateReviewCandidate({ ...base, price_min: -1 })).toEqual({
      valid: false,
      reason: "invalid_price",
    });
  });

  it("rejects a minimum price greater than maximum price", () => {
    expect(validateReviewCandidate({ ...base, price_min: 120, price_max: 100 })).toEqual({
      valid: false,
      reason: "invalid_range",
    });
  });
});
