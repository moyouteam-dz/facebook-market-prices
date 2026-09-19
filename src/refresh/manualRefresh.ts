import { shouldUseGemini } from "../gemini/fallbackPolicy";
import type { GeminiPriceCandidate } from "../gemini/extraction";
import { applyProductAlias } from "../aliases/productAliases";
import type { NormalizedFacebookPost } from "../apify/apifyAdapter";
import type { AppDatabase } from "../db/database";
import { buildObservationFingerprint } from "../history/observations";
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
  source_type: "post_text" | "image_ai";
  raw_text: string;
  image_url?: string;
  confidence: Confidence;
  ai_assisted?: boolean;
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
  signal?: AbortSignal;
  onProgress?: (event: RefreshProgressEvent) => void;
  gemini?: {
    enabled: boolean;
    apiKey: string | null;
    extract: (apiKey: string, evidence: { postText: string; ocrText: string; images?: Array<{ mimeType: string; base64: string }>; signal?: AbortSignal }) => Promise<GeminiPriceCandidate[]>;
  };
}

export interface ManualRefreshResult {
  runId: string;
  candidates: ReviewCandidate[];
  errors: string[];
  diagnostics: { posts: number; images_processed: number; image_failures: number; image_failure_categories: Record<string, number>; gemini_attempted: number; gemini_failed: number; gemini_failure_categories: Record<string, number> };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
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
  sourceType: "post_text" | "image_ai",
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
  const deterministicByPost = new Map<string, ReturnType<typeof parsePriceCandidates>>();
  const aiImagesByPost = new Map<string, Array<{ mimeType: string; base64: string; imageUrl: string }>>();
  let posts: NormalizedFacebookPost[] = [];
  let imagesProcessed = 0;
  let geminiAttempted = 0;
  let geminiFailed = 0;
  let geminiQuotaLimited = false;
  const imageFailureCategories: Record<string, number> = {};
  const geminiFailureCategories: Record<string, number> = {};
  const increment = (map: Record<string, number>, key: string) => { map[key] = (map[key] ?? 0) + 1; };

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

  try {
    throwIfAborted(options.signal);
  } catch (error) {
    await options.db.runs.update(runId, {
      finished_at: new Date().toISOString(),
      errors: ["refresh_cancelled"],
    });
    throw error;
  }
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

    const textParsed = parsePriceCandidates(post.text);
    deterministicByPost.set(post.post_id, [...(deterministicByPost.get(post.post_id) ?? []), ...textParsed]);
    for (const parsed of textParsed) {
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
    try {
      throwIfAborted(options.signal);
      const blob = await options.fetchImage(job.imageUrl, options.signal);
      throwIfAborted(options.signal);
      imagesProcessed += 1;

      if (options.gemini?.enabled && options.gemini.apiKey) {
        const base64 = await blobToBase64(blob);
        aiImagesByPost.set(job.post.post_id, [
          ...(aiImagesByPost.get(job.post.post_id) ?? []),
          { mimeType: blob.type || "image/jpeg", base64, imageUrl: job.imageUrl },
        ]);
      }
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const reason = error instanceof Error ? error.message : "image_processing_failed";
      const category = error instanceof TypeError && /fetch/i.test(reason)
        ? "image_fetch_network"
        : reason === "image_download_failed" ? "image_http_failed" : "image_processing_failed";
      increment(imageFailureCategories, category);
      errors.push(category);
    }
    options.onProgress?.({ stage: "ocr", completed: imagesProcessed + errors.length, total: imageJobs.length });
  }

  if (options.gemini?.enabled && options.gemini.apiKey) {
    for (const post of posts) {
      if (post.unavailable || geminiQuotaLimited) continue;
      const deterministic = deterministicByPost.get(post.post_id) ?? [];
      if (!shouldUseGemini(deterministic, true, true)) continue;
      geminiAttempted += 1;
      try {
        const visionImages = aiImagesByPost.get(post.post_id) ?? [];
        const ai = await options.gemini.extract(options.gemini.apiKey, {
          postText: post.text,
          ocrText: "",
          images: visionImages.map(({ mimeType, base64 }) => ({ mimeType, base64 })),
          signal: options.signal,
        });
        for (const parsed of ai) {
          const evidenceImageUrl = visionImages.length === 1
            ? visionImages[0]?.imageUrl
            : typeof parsed.image_index === "number"
              ? visionImages[parsed.image_index]?.imageUrl
              : undefined;
          const candidate = await candidateFromParsed(options.db, post, parsed, visionImages.length ? "image_ai" : "post_text", evidenceImageUrl);
          candidate.ai_assisted = true;
          candidates.push(candidate);
        }
      } catch (error) {
        if (options.signal?.aborted) throw error;
        geminiFailed += 1;
        const reason = error instanceof Error ? error.message : "gemini_failed";
        const category = /^gemini_http_\d{3}$/.test(reason) ? reason : reason === "gemini_request_failed" ? "gemini_request_failed" : "gemini_failed";
        increment(geminiFailureCategories, category);
        errors.push(category);
        if (category === "gemini_http_429") geminiQuotaLimited = true;
      }
    }
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
    diagnostics: { posts: posts.length, images_processed: imagesProcessed, image_failures: Object.values(imageFailureCategories).reduce((sum, count) => sum + count, 0), image_failure_categories: imageFailureCategories, gemini_attempted: geminiAttempted, gemini_failed: geminiFailed, gemini_failure_categories: geminiFailureCategories },
  };
}
