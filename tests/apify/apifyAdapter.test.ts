import fixture from "../fixtures/apify-facebook-posts.json";
import { describe, expect, it, vi } from "vitest";
import {
  buildFacebookPostsInput,
  normalizeApifyFacebookItem,
  runFacebookPostsActor,
} from "../../src/apify/apifyAdapter";

describe("Apify Facebook adapter", () => {
  it("builds bounded actor input from enabled page URLs", () => {
    expect(
      buildFacebookPostsInput([
        "https://www.facebook.com/Emagfel",
        "https://www.facebook.com/MagrosOuarsenisBourached",
      ]),
    ).toEqual({
      captionText: false,
      resultsLimit: 20,
      onlyPostsNewerThan: "7 days",
      startUrls: [
        { url: "https://www.facebook.com/Emagfel" },
        { url: "https://www.facebook.com/MagrosOuarsenisBourached" },
      ],
    });
  });

  it("normalizes text and iterates media to keep only real image URIs", () => {
    const result = normalizeApifyFacebookItem(fixture[0], {
      sourceId: "source-1",
      market: "الشلف",
    });

    expect(result).toEqual(
      expect.objectContaining({
        post_id: "123456789",
        source_id: "source-1",
        source_page: "Magros Ouarsenis",
        market: "الشلف",
        post_url:
          "https://www.facebook.com/MagrosOuarsenisBourached/posts/123456789",
        text: "البصل 35-40 دج",
        image_urls: [
          "https://example.test/price-board.jpg",
          "https://example.test/second-photo.jpg",
        ],
        unavailable: false,
      }),
    );
  });

  it("marks unavailable public content as nonfatal", () => {
    const result = normalizeApifyFacebookItem(fixture[1], {
      sourceId: "source-2",
      market: "الجزائر",
    });

    expect(result.unavailable).toBe(true);
    expect(result.image_urls).toEqual([]);
  });

  it("sends the token only in the Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fixture,
    });

    await runFacebookPostsActor({
      token: "apify_api_sensitive",
      pageUrls: ["https://www.facebook.com/Emagfel"],
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("apify_api_sensitive");
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer apify_api_sensitive",
        "Content-Type": "application/json",
      }),
    );
  });
});
