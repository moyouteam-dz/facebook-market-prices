import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppDatabase } from "../../src/db/database";
import { rememberProductAlias } from "../../src/aliases/productAliases";
import {
  MissingRefreshConfigurationError,
  runManualRefresh,
  type RefreshSource,
} from "../../src/refresh/manualRefresh";

describe("manual refresh orchestration", () => {
  let db: ReturnType<typeof createAppDatabase>;

  beforeEach(async () => {
    db = createAppDatabase("refresh-test-" + crypto.randomUUID());
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  const source: RefreshSource = {
    id: "source-1",
    name: "سوق الجملة",
    market: "الشلف",
    facebook_url: "https://www.facebook.com/market",
    enabled: true,
  };

  it("requires a token and at least one enabled source", async () => {
    await expect(
      runManualRefresh({
        db,
        token: "",
        sources: [source],
        collectPosts: vi.fn(),
        fetchImage: vi.fn(),
        ocrEngine: { recognize: vi.fn() },
      }),
    ).rejects.toBeInstanceOf(MissingRefreshConfigurationError);

    await expect(
      runManualRefresh({
        db,
        token: "token",
        sources: [{ ...source, enabled: false }],
        collectPosts: vi.fn(),
        fetchImage: vi.fn(),
        ocrEngine: { recognize: vi.fn() },
      }),
    ).rejects.toBeInstanceOf(MissingRefreshConfigurationError);
  });

  it("parses post text, OCRs images sequentially, applies aliases, and does not auto-save", async () => {
    await rememberProductAlias(db, "بطاط", "بطاطا");

    const collectPosts = vi.fn().mockResolvedValue([
      {
        post_id: "post-1",
        source_id: "source-1",
        source_page: "سوق الجملة",
        market: "الشلف",
        post_url: "https://www.facebook.com/market/posts/1",
        post_date: "2026-09-18T00:00:00.000Z",
        text: "بطاط 80 دج",
        image_urls: ["https://example.test/price.jpg"],
        unavailable: false,
      },
    ]);

    const fetchImage = vi
      .fn()
      .mockResolvedValue(new Blob(["image"], { type: "image/jpeg" }));
    const recognize = vi.fn().mockResolvedValue({
      text: "البصل 35-40 دج",
      confidence: 0.9,
    });
    const progress: string[] = [];

    const result = await runManualRefresh({
      db,
      token: "token",
      sources: [source],
      collectPosts,
      fetchImage,
      ocrEngine: { recognize },
      onProgress: (event) => progress.push(event.stage),
    });

    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          product: "بطاطا",
          normalized_product: "بطاطا",
          price_min: 80,
          price_max: 80,
          source_type: "post_text",
        }),
        expect.objectContaining({
          product: "البصل",
          price_min: 35,
          price_max: 40,
          source_type: "image_ocr",
          image_url: "https://example.test/price.jpg",
        }),
      ]),
    );
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(await db.price_history.count()).toBe(0);
    expect(await db.runs.count()).toBe(1);
    expect(progress).toContain("collecting");
    expect(progress).toContain("ocr");
    expect(progress.at(-1)).toBe("review");
  });

  it("keeps successful candidates when one image fails", async () => {
    const result = await runManualRefresh({
      db,
      token: "token",
      sources: [source],
      collectPosts: vi.fn().mockResolvedValue([
        {
          post_id: "post-2",
          source_id: "source-1",
          source_page: "سوق الجملة",
          market: "الشلف",
          post_url: "https://www.facebook.com/market/posts/2",
          post_date: "2026-09-18T00:00:00.000Z",
          text: "القرع 100 دج",
          image_urls: ["https://example.test/broken.jpg"],
          unavailable: false,
        },
      ]),
      fetchImage: vi.fn().mockRejectedValue(new Error("network")),
      ocrEngine: { recognize: vi.fn() },
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.product).toBe("القرع");
    expect(result.errors).toHaveLength(1);
  });
});
