export type ReviewValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason: "product_required" | "invalid_price" | "invalid_range";
    };

export function validateReviewCandidate(candidate: {
  product: string;
  price_min: number;
  price_max: number;
}): ReviewValidationResult {
  if (!candidate.product.trim()) {
    return { valid: false, reason: "product_required" };
  }

  if (
    !Number.isFinite(candidate.price_min) ||
    !Number.isFinite(candidate.price_max) ||
    candidate.price_min < 0 ||
    candidate.price_max < 0
  ) {
    return { valid: false, reason: "invalid_price" };
  }

  if (candidate.price_min > candidate.price_max) {
    return { valid: false, reason: "invalid_range" };
  }

  return { valid: true };
}
