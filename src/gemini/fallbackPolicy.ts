import type { PriceCandidate } from "../parser/priceParser";

export function shouldUseGemini(
  candidates: PriceCandidate[],
  enabled: boolean,
  hasKey: boolean,
): boolean {
  return enabled && hasKey && (candidates.length === 0 || candidates.every((candidate) => candidate.confidence === "low"));
}
