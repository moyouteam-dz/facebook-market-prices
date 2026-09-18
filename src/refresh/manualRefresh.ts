import { applyProductAlias } from "../aliases/productAliases";
import type { NormalizedFacebookPost } from "../apify/apifyAdapter";
import type { AppDatabase } from "../db/database";
import { buildObservationFingerprint } from "../history/observations";
import type { OcrEngine } from "../ocr/types";
import {
  parsePriceCandidates,
  type Confidence,
} from "../parser/priceParser";

export interface RefreshSource {
  id: string;
  name: string;
  market: string;
  facebook_url: string;
  enabled: boolean;
}

export type RefreshStage = "collecting" | "parsing" | "ocr" | "review";

export interface RefreshProgressEvent {
  stage: RefreshStage;
  completed?: number;
  total?: number;
}

export interface ReviewCandidate {
  id: string;
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
  confidence: Confidence;
}

export class MissingRefreshConfigurationError extends Error {
  constructor(message: "missing_apify_token" | "no_enabled_sources") {
    super(message);
    this.name = "MissingRefreshConfigurationError";
  }
}

export interface ManualRefreshOptions {
  db: AppDatabase;
  token: string;
  sources: RefreshSource[];
  collectPosts: (
    token: string,
    sources: RefreshSource[],
    signal?: AbortSignal,
  ) => Promise<NormalizedFacebookPost[]>;
  fetchImage: (url: string, signal?: AbortSignal) => Promise<Blob>;
  ocrEngine: OcrEngine;
  signal?: AbortSignal;
  onProgress?: (event: RefreshProgressEvent) => void;
}

export interface ManualRefreshResult {
  runId: string;
  candidates: ReviewCandidate[];
  errors: string[];
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("refresh_cancelled", "AbortError");
  }
}

async function candidateFromParsed(
  db: AppDatabase,
  post: NormalizedFacebookPost,
  parsed: ReturnType<typeof parsePriceCandidates>[number],
  sourceType: "post_text" | "image_ocr",
  imageUrl?: string,
): Promise<ReviewCandidate> {
  const canonical = await applyProductAlias(db, parsed.normalized_product);

  return {
    id: crypto.randomUUID(),
    product: canonical,
    normalized_product: canonical,
    price_min: parsed.price_min,
    price_max: parsed.price_max,
    currency: "DZD",
    market: post.market,
    source_id: post.source_id,
    source_page: post.source_page,
    post_id: post.post_id,
    post_url: post.post_url,
    post_date: post.post_date,
    source_type: sourceType,
    raw_text: parsed.raw_text,
    ...(imageUrl ? { image_url: imageUrl } : {}),
    confidence: parsed.confidence,
  };
}

function deduplicateReviewCandidates(
  candidates: ReviewCandidate[],
): ReviewCandidate[] {
  const seen = new Set<string>();
  const output: ReviewCandidate[] = [];

  for (const candidate of candidates) {
    const fingerprint = buildObservationFingerprint(candidate);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    output.push(candidate);
  }

  return output;
}

export async function runManualRefresh(
  options: ManualRefreshOptions,
): Promise<ManualRefreshResult> {
  const token = options.token.trim();
  if (!token) {
    throw new MissingRefreshConfigurationError("missing_apify_token");
  }

  const enabledSources = options.sources.filter((source) => source.enabled);
  if (enabledSources.length === 0) {
    throw new MissingRefreshConfigurationError("no_enabled_sources");
  }

  throwIfAborted(options.signal);

  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const candidates: ReviewCandidate[] = [];
  let posts: NormalizedFacebookPost[] = [];
  let imagesProcessed = 0;

  await options.db.runs.add({
    id: runId,
    started_at: startedAt,
    selected_sources: enabledSources.map((source) => source.id),
    posts_received: 0,
    images_processed: 0,
    candidates_found: 0,
    candidates_saved: 0,
    candidates_rejected: 0,
    errors: [],
  });

  options.onProgress?.({ stage: "collecting" });

  try {
    posts = await options.collectPosts(token, enabledSources, options.signal);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "facebook_collection_failed";
    await options.db.runs.update(runId, {
      finished_at: new Date().toISOString(),
      errors: [message],
    });
    throw error;
  }

  throwIfAborted(options.signal);
  options.onProgress?.({ stage: "parsing", completed: 0, total: posts.length });

  for (let postIndex = 0; postIndex < posts.length; postIndex += 1) {
    const post = posts[postIndex];
    if (!post || post.unavailable) {
      options.onProgress?.({
        stage: "parsing",
        completed: postIndex + 1,
        total: posts.length,
      });
      continue;
    }

    for (const parsed of parsePriceCandidates(post.text)) {
      candidates.push(
        await candidateFromParsed(
          options.db,
          post,
          parsed,
          "post_text",
        ),
      );
    }

    options.onProgress?.({
      stage: "parsing",
      completed: postIndex + 1,
      total: posts.length,
    });
  }

  const imageJobs = posts.flatMap((post) =>
    post.unavailable
      ? []
      : post.image_urls.map((imageUrl) => ({ post, imageUrl })),
  );

  options.onProgress?.({
    stage: "ocr",
    completed: 0,
    total: imageJobs.length,
  });

  for (const job of imageJobs) {
    throwIfAborted(options.signal);

    try {
      const blob = await options.fetchImage(job.imageUrl, options.signal);
      throwIfAborted(options.signal);
      const ocr = await options.ocrEngine.recognize(blob);
      imagesProcessed += 1;

      for (const parsed of parsePriceCandidates(ocr.text)) {
        candidates.push(
          await candidateFromParsed(
            options.db,
            job.post,
            parsed,
            "image_ocr",
            job.imageUrl,
          ),
        );
      }
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }

      const reason =
        error instanceof Error ? error.message : "image_ocr_failed";
      errors.push(job.imageUrl + ": " + reason);
    }

    options.onProgress?.({
      stage: "ocr",
      completed: imagesProcessed + errors.length,
      total: imageJobs.length,
    });
  }

  const deduplicated = deduplicateReviewCandidates(candidates);

  await options.db.runs.update(runId, {
    finished_at: new Date().toISOString(),
    posts_received: posts.length,
    images_processed: imagesProcessed,
    candidates_found: deduplicated.length,
    errors,
  });

  options.onProgress?.({
    stage: "review",
    completed: deduplicated.length,
    total: deduplicated.length,
  });

  return {
    runId,
    candidates: deduplicated,
    errors,
  };
}
