const APIFY_ME_URL = "https://api.apify.com/v2/users/me";

export async function testApifyToken(
  rawToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const token = rawToken.trim();
  if (!token) {
    return false;
  }

  try {
    const response = await fetchImpl(APIFY_ME_URL, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
