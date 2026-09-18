import type { AppDatabase, SourceRecord } from "../db/database";

export type FacebookUrlValidation =
  | { valid: true; normalizedUrl: string }
  | {
      valid: false;
      reason:
        | "invalid_url"
        | "unsupported_host"
        | "groups_not_supported"
        | "missing_page";
    };

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
]);

export function validateFacebookPageUrl(
  rawUrl: string,
): FacebookUrlValidation {
  let url: URL;

  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: "invalid_url" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { valid: false, reason: "invalid_url" };
  }

  const host = url.hostname.toLowerCase();
  if (!FACEBOOK_HOSTS.has(host)) {
    return { valid: false, reason: "unsupported_host" };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0]?.toLowerCase() === "groups") {
    return { valid: false, reason: "groups_not_supported" };
  }

  const isProfileById =
    url.pathname.toLowerCase() === "/profile.php" && Boolean(url.searchParams.get("id"));

  if (segments.length === 0 && !isProfileById) {
    return { valid: false, reason: "missing_page" };
  }

  url.protocol = "https:";
  url.hostname = "www.facebook.com";
  url.hash = "";

  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return { valid: true, normalizedUrl: url.toString() };
}

export interface SourceInput {
  name: string;
  market: string;
  facebook_url: string;
}

function cleanRequired(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned) {
    throw new Error(`${field}_required`);
  }
  return cleaned;
}

function normalizeFacebookUrl(rawUrl: string): string {
  const validation = validateFacebookPageUrl(rawUrl);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }
  return validation.normalizedUrl;
}

export async function createSource(
  db: AppDatabase,
  input: SourceInput,
): Promise<SourceRecord> {
  const now = new Date().toISOString();
  const record: SourceRecord = {
    id: crypto.randomUUID(),
    name: cleanRequired(input.name, "name"),
    market: cleanRequired(input.market, "market"),
    facebook_url: normalizeFacebookUrl(input.facebook_url),
    enabled: true,
    created_at: now,
    updated_at: now,
  };

  await db.sources.add(record);
  return record;
}

export async function listSources(db: AppDatabase): Promise<SourceRecord[]> {
  const records = await db.sources.toArray();
  return records.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function updateSource(
  db: AppDatabase,
  id: string,
  patch: Partial<SourceInput>,
): Promise<SourceRecord> {
  const current = await db.sources.get(id);
  if (!current) {
    throw new Error("source_not_found");
  }

  const next: SourceRecord = {
    ...current,
    ...(patch.name === undefined
      ? {}
      : { name: cleanRequired(patch.name, "name") }),
    ...(patch.market === undefined
      ? {}
      : { market: cleanRequired(patch.market, "market") }),
    ...(patch.facebook_url === undefined
      ? {}
      : { facebook_url: normalizeFacebookUrl(patch.facebook_url) }),
    updated_at: new Date().toISOString(),
  };

  await db.sources.put(next);
  return next;
}

export async function setSourceEnabled(
  db: AppDatabase,
  id: string,
  enabled: boolean,
): Promise<void> {
  const count = await db.sources.update(id, {
    enabled,
    updated_at: new Date().toISOString(),
  });

  if (count === 0) {
    throw new Error("source_not_found");
  }
}

export async function deleteSource(
  db: AppDatabase,
  id: string,
): Promise<void> {
  await db.sources.delete(id);
}
