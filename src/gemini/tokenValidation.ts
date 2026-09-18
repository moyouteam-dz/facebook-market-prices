type FetchLike = typeof fetch;

export async function testGeminiApiKey(apiKey: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  const key = apiKey.trim();
  if (!key) return false;
  try {
    const response = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/models", {
      method: "GET",
      headers: { "x-goog-api-key": key },
    });
    return response.ok;
  } catch {
    return false;
  }
}
