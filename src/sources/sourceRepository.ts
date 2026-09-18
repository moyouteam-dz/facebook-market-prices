import type { AppDatabase, SourceRecord } from "../db/database";

type UrlValidation =
  | { valid: true; normalizedUrl: string }
  | {
      valid: false;
      reason:
        | "invalid_url"
        | "unsupported_host"
        | "groups_not_supported"
        | "unsupported_path";
    };

const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com"]);

export function validateFacebookPageUrl(value: string): UrlValidation {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { valid: false, reason: "invalid_url" };
  }

  if (url.protocol !== "https:" || !FACEBOOK_HOSTS.has(url.hostname.toLowerCase())) {
    return { valid: false, reason: "unsupported_host" };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const first = segments[0]?.toLowerCase();

  if (first === "groups") return { valid: false, reason: "groups_not_supported" };
  if (["marketplace", "events", "watch", "reel", "share"].includes(first ?? "")) {
    return { valid: false, reason: "unsupported_path" };
  }

  const isProfile = first === "profile.php" && Boolean(url.searchParams.get("id"));
  const isPageSlug = segments.length === 1 && Boolean(first) && first !== "profile.php";
  if (!isProfile && !isPageSlug) {
    return { valid: false, reason: "unsupported_path" };
  }

  url.hash = "";
  const normalizedHost = "www.facebook.com";
  url.hostname = normalizedHost;
  url.protocol = "https:";
  if (isPageSlug) url.search = "";

  return { valid: true, normalizedUrl: url.toString().replace(/\/$/, "") };
}

function requireText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} مطلوب`);
  return trimmed;
}

function requireFacebookUrl(value: string) {
  const validation = validateFacebookPageUrl(value);
  if (!validation.valid) throw new Error("رابط صفحة فيسبوك عامة غير صالح");
  return validation.normalizedUrl;
}

export async function listSources(db: AppDatabase): Promise<SourceRecord[]> {
  return db.sources.orderBy("updated_at").reverse().toArray();
}

export async function createSource(
  db: AppDatabase,
  input: Pick<SourceRecord, "name" | "market" | "facebook_url">,
): Promise<SourceRecord> {
  const now = new Date().toISOString();
  const record: SourceRecord = {
    id: crypto.randomUUID(),
    name: requireText(input.name, "اسم الصفحة"),
    market: requireText(input.market, "السوق"),
    facebook_url: requireFacebookUrl(input.facebook_url),
    enabled: true,
    created_at: now,
    updated_at: now,
  };
  await db.sources.add(record);
  return record;
}

export async function updateSource(
  db: AppDatabase,
  id: string,
  changes: Partial<Pick<SourceRecord, "name" | "market" | "facebook_url" | "enabled">>,
): Promise<SourceRecord> {
  const current = await db.sources.get(id);
  if (!current) throw new Error("المصدر غير موجود");

  const next: SourceRecord = {
    ...current,
    ...(changes.name === undefined ? {} : { name: requireText(changes.name, "اسم الصفحة") }),
    ...(changes.market === undefined ? {} : { market: requireText(changes.market, "السوق") }),
    ...(changes.facebook_url === undefined
      ? {}
      : { facebook_url: requireFacebookUrl(changes.facebook_url) }),
    ...(changes.enabled === undefined ? {} : { enabled: changes.enabled }),
    updated_at: new Date().toISOString(),
  };
  await db.sources.put(next);
  return next;
}

export async function setSourceEnabled(db: AppDatabase, id: string, enabled: boolean) {
  return updateSource(db, id, { enabled });
}

export async function deleteSource(db: AppDatabase, id: string): Promise<void> {
  await db.sources.delete(id);
}
