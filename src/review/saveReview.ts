import type { AppDatabase } from "../db/database";
import { rememberProductAlias } from "../aliases/productAliases";
import { saveReviewedObservation } from "../history/observations";

export interface EditableReviewCandidate {
  id: string;
  original_product: string;
  product: string;
  normalized_product: string;
  price_min: number;
  price_max: number;
  currency: "DZD";
  market: string;
  source_id: string;
  source_page: string;
  post_id: string;
  post_url: string;
  post_date: string;
  source_type: "post_text" | "image_ocr";
  raw_text: string;
  image_url?: string;
  confidence: "high" | "medium" | "low";
  accepted: boolean;
  remember_correction: boolean;
}

export interface ReviewSaveSummary {
  saved: number;
  rejected: number;
  duplicates: number;
}

function cleanProduct(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    throw new Error("product_required");
  }
  return cleaned;
}

function normalizePriceRange(minValue: number, maxValue: number) {
  const min = Number(minValue);
  const max = Number(maxValue);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("invalid_price");
  }

  return {
    price_min: Math.min(min, max),
    price_max: Math.max(min, max),
  };
}

export async function saveReviewedCandidates(
  db: AppDatabase,
  runId: string,
  candidates: EditableReviewCandidate[],
): Promise<ReviewSaveSummary> {
  let saved = 0;
  let rejected = 0;
  let duplicates = 0;

  for (const candidate of candidates) {
    if (!candidate.accepted) {
      rejected += 1;
      continue;
    }

    const product = cleanProduct(candidate.product);
    const normalized_product = product;
    const { price_min, price_max } = normalizePriceRange(
      candidate.price_min,
      candidate.price_max,
    );

    if (
      candidate.remember_correction &&
      candidate.original_product.trim() &&
      candidate.original_product.trim() !== product
    ) {
      await rememberProductAlias(
        db,
        candidate.original_product,
        product,
      );
    }

    const now = new Date().toISOString();
    const inserted = await saveReviewedObservation(db, {
      product,
      normalized_product,
      price_min,
      price_max,
      currency: "DZD",
      market: candidate.market,
      source_id: candidate.source_id,
      source_page: candidate.source_page,
      post_id: candidate.post_id,
      post_url: candidate.post_url,
      source_type: candidate.source_type,
      raw_text: candidate.raw_text,
      ...(candidate.image_url ? { image_url: candidate.image_url } : {}),
      post_date: candidate.post_date,
      scraped_at: now,
      reviewed_at: now,
      confidence: candidate.confidence,
    });

    if (inserted) {
      saved += 1;
    } else {
      duplicates += 1;
    }
  }

  const existingRun = await db.runs.get(runId);
  if (existingRun) {
    await db.runs.update(runId, {
      candidates_saved: existingRun.candidates_saved + saved,
      candidates_rejected: existingRun.candidates_rejected + rejected,
    });
  }

  return { saved, rejected, duplicates };
}
