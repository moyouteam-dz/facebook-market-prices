import { describe, expect, it, vi } from "vitest";
import { testApifyToken } from "../../src/apify/tokenValidation";

describe("Apify token validation", () => {
  it("checks the current user endpoint with an Authorization header and never puts the token in the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    expect(
      await testApifyToken(
        "apify_api_sensitive",
        fetchMock as unknown as typeof fetch,
      ),
    ).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.apify.com/v2/users/me");
    expect(String(url)).not.toContain("apify_api_sensitive");
    expect(init.headers).toEqual({
      Authorization: "Bearer apify_api_sensitive",
    });
  });

  it("returns false for rejected credentials without exposing response details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    expect(
      await testApifyToken(
        "apify_api_bad",
        fetchMock as unknown as typeof fetch,
      ),
    ).toBe(false);
  });
});
