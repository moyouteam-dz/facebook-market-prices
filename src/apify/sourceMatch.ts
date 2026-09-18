export interface MatchableFacebookSource {
  id: string;
  facebook_url: string;
}

function canonicalFacebookUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (!["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname.toLowerCase())) {
      return "";
    }
    url.protocol = "https:";
    url.hostname = "www.facebook.com";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function matchSourceForApifyItem<T extends MatchableFacebookSource>(
  item: unknown,
  sources: T[],
): T | undefined {
  if (!item || typeof item !== "object") return undefined;
  const raw = item as Record<string, unknown>;
  const evidence = [raw.inputUrl, raw.topLevelUrl]
    .map(canonicalFacebookUrl)
    .filter(Boolean);

  return sources.find((source) => {
    const expected = canonicalFacebookUrl(source.facebook_url);
    if (!expected) return false;
    return evidence.some(
      (value) => value === expected || value.startsWith(expected + "/"),
    );
  });
}
