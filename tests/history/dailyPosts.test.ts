import { describe, expect, it } from "vitest";
import type { PriceHistoryRecord } from "../../src/db/database";
import { groupPriceHistoryByDay } from "../../src/history/dailyPosts";

function record(overrides: Partial<PriceHistoryRecord>): PriceHistoryRecord {
  return {
    id: crypto.randomUUID(),
    product: "بطاطا",
    normalized_product: "بطاطا",
    price_min: 80,
    price_max: 80,
    currency: "DZD",
    market: "الشلف",
    source_id: "s1",
    source_page: "سوق الجملة",
    post_id: crypto.randomUUID(),
    post_url: "https://facebook.com/post",
    source_type: "image_ai",
    raw_text: "بطاطا 80",
    post_date: "2026-09-19T10:00:00.000Z",
    scraped_at: "2026-09-19T11:00:00.000Z",
    reviewed_at: "2026-09-19T11:05:00.000Z",
    confidence: "medium",
    fingerprint: crypto.randomUUID(),
    ...overrides,
  };
}

describe("daily price posts", () => {
  it("groups every saved price from the same calendar day into one daily post", () => {
    const groups = groupPriceHistoryByDay([
      record({ id: "a", product: "بطاطا", post_date: "2026-09-19T08:00:00.000Z" }),
      record({ id: "b", product: "بصل", post_date: "2026-09-19T17:30:00.000Z" }),
      record({ id: "c", product: "طماطم", post_date: "2026-09-18T23:30:00.000Z" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe("2026-09-19");
    expect(groups[0].records.map((item) => item.product)).toEqual(["بصل", "بطاطا"]);
    expect(groups[1].date).toBe("2026-09-18");
    expect(groups[1].records.map((item) => item.product)).toEqual(["طماطم"]);
  });

  it("keeps individual source records inside the daily post instead of losing evidence", () => {
    const first = record({ id: "a", product: "بطاطا", price_min: 70, price_max: 70, source_page: "المصدر أ" });
    const second = record({ id: "b", product: "بطاطا", price_min: 80, price_max: 80, source_page: "المصدر ب" });

    const [daily] = groupPriceHistoryByDay([first, second]);

    expect(daily.records).toHaveLength(2);
    expect(daily.records.map((item) => item.source_page)).toEqual(["المصدر أ", "المصدر ب"]);
  });

  it("summarizes repeated products into one daily line with the full observed price range", () => {
    const groups = groupPriceHistoryByDay([
      record({ id: "a", product: "بطاطا", normalized_product: "بطاطا", price_min: 70, price_max: 80, source_page: "المصدر أ" }),
      record({ id: "b", product: "بطاطا", normalized_product: "بطاطا", price_min: 75, price_max: 90, source_page: "المصدر ب" }),
      record({ id: "c", product: "بصل", normalized_product: "بصل", price_min: 35, price_max: 40, source_page: "المصدر ج" }),
    ]);

    expect(groups[0].products).toHaveLength(2);
    expect(groups[0].products[0]).toEqual(expect.objectContaining({
      product: "بطاطا",
      price_min: 70,
      price_max: 90,
      source_count: 2,
    }));
    expect(groups[0].products[0].records).toHaveLength(2);
  });

});
