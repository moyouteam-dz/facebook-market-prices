import type {
  AppDatabase,
  PriceHistoryRecord,
} from "../db/database";

export interface FingerprintInput {
  source_id: string;
  post_id: string;
  normalized_product: string;
  price_min: number;
  price_max: number;
  source_type: "post_text" | "image_ocr";
}

export interface CandidateForDedup extends FingerprintInput {
  product: string;
  [key: string]: unknown;
}

export type ReviewedObservationInput = Omit<
  PriceHistoryRecord,
  "id" | "fingerprint"
>;

function part(value: string | number): string {
  return String(value).trim().toLocaleLowerCase("ar");
}

export function buildObservationFingerprint(
  input: FingerprintInput,
): string {
  return [
    part(input.source_id),
    part(input.post_id),
    part(input.normalized_product),
    part(input.price_min),
    part(input.price_max),
    part(input.source_type),
  ].join("|");
}

export function deduplicateCandidates<T extends CandidateForDedup>(
  candidates: T[],
): T[] {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const candidate of candidates) {
    const fingerprint = buildObservationFingerprint(candidate);
    if (seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    output.push(candidate);
  }

  return output;
}

export async function saveReviewedObservation(
  db: AppDatabase,
  observation: ReviewedObservationInput,
): Promise<boolean> {
  const fingerprint = buildObservationFingerprint(observation);
  const exists = await db.price_history
    .where("fingerprint")
    .equals(fingerprint)
    .first();

  if (exists) {
    return false;
  }

  try {
    await db.price_history.add({
      ...observation,
      id: crypto.randomUUID(),
      fingerprint,
    });
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "ConstraintError" ||
        error.name === "ConstraintErrorError")
    ) {
      return false;
    }
    throw error;
  }
}
