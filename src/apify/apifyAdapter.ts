export const FACEBOOK_POSTS_ACTOR_ID = "apify~facebook-posts-scraper";
const APIFY_API_BASE = "https://api.apify.com/v2";

export interface FacebookPostsInput {
  captionText: false;
  resultsLimit: number;
  onlyPostsNewerThan: string;
  startUrls: Array<{ url: string }>;
}

export interface NormalizedFacebookPost {
  post_id: string;
  source_id: string;
  source_page: string;
  market: string;
  post_url: string;
  post_date: string;
  text: string;
  image_urls: string[];
  unavailable: boolean;
}

export interface NormalizeContext {
  sourceId: string;
  market: string;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nestedImageUri(mediaItem: unknown): string[] {
  const item = asRecord(mediaItem);
  if (!item) return [];

  const output: string[] = [];
  for (const key of ["image", "photo_image"]) {
    const nested = asRecord(item[key]);
    const uri = stringValue(nested?.uri);
    if (uri) output.push(uri);
  }
  return output;
}

export function buildFacebookPostsInput(
  pageUrls: string[],
  options?: { resultsLimit?: number; onlyPostsNewerThan?: string },
): FacebookPostsInput {
  const urls = pageUrls.map((url) => url.trim()).filter(Boolean);
  if (urls.length === 0) {
    throw new Error("no_facebook_sources");
  }

  return {
    captionText: false,
    resultsLimit: options?.resultsLimit ?? 20,
    onlyPostsNewerThan: options?.onlyPostsNewerThan ?? "7 days",
    startUrls: urls.map((url) => ({ url })),
  };
}

function looksUnavailable(text: string): boolean {
  const lowered = text.toLowerCase();
  return (
    lowered.includes("content isn't available") ||
    lowered.includes("content is not available") ||
    lowered.includes("هذا المحتوى غير متاح")
  );
}

export function normalizeApifyFacebookItem(
  value: unknown,
  context: NormalizeContext,
): NormalizedFacebookPost {
  const item = asRecord(value) ?? {};
  const text = stringValue(item.text);
  const media = Array.isArray(item.media) ? item.media : [];

  const image_urls = Array.from(
    new Set(media.flatMap((entry) => nestedImageUri(entry))),
  );

  const postUrl =
    stringValue(item.url) ||
    stringValue(item.facebookUrl) ||
    stringValue(item.topLevelUrl);
  const sourcePage =
    stringValue(item.pageName) ||
    stringValue(asRecord(item.user)?.name) ||
    stringValue(item.inputUrl);

  return {
    post_id:
      stringValue(item.postId) ||
      stringValue(item.facebookId) ||
      postUrl ||
      crypto.randomUUID(),
    source_id: context.sourceId,
    source_page: sourcePage,
    market: context.market,
    post_url: postUrl,
    post_date:
      stringValue(item.timestamp) ||
      stringValue(item.time) ||
      new Date(0).toISOString(),
    text,
    image_urls,
    unavailable: looksUnavailable(text),
  };
}

export class ApifyRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = "ApifyRequestError";
  }
}

export interface RunFacebookPostsOptions {
  token: string;
  pageUrls: string[];
  resultsLimit?: number;
  onlyPostsNewerThan?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function runFacebookPostsActor(
  options: RunFacebookPostsOptions,
): Promise<unknown[]> {
  const token = options.token.trim();
  if (!token) {
    throw new Error("missing_apify_token");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const input = buildFacebookPostsInput(options.pageUrls, {
    resultsLimit: options.resultsLimit,
    onlyPostsNewerThan: options.onlyPostsNewerThan,
  });

  const endpoint =
    APIFY_API_BASE +
    "/actors/" +
    FACEBOOK_POSTS_ACTOR_ID +
    "/run-sync-get-dataset-items?clean=true";

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal: options.signal,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApifyRequestError(response.status, "invalid_apify_token");
    }
    if (response.status === 408) {
      throw new ApifyRequestError(response.status, "apify_run_timeout");
    }
    throw new ApifyRequestError(response.status, "apify_request_failed");
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("invalid_apify_dataset_response");
  }

  return payload;
}
