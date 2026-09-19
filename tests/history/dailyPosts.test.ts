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
      record({ id: "a", product: "بطاطا", normalized_product: "بطاطا", price_min: 70, price_max: 80, source_id: "s1", source_page: "المصدر أ" }),
      record({ id: "b", product: "بطاطا", normalized_product: "بطاطا", price_min: 75, price_max: 90, source_id: "s2", source_page: "المصدر ب" }),
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


  it("keeps raw records but excludes an extreme outlier from the displayed daily range when there is enough evidence", () => {
    const groups = groupPriceHistoryByDay([
      record({ id: "a", product: "بطاطا", normalized_product: "بطاطا", price_min: 70, price_max: 70, source_id: "s1" }),
      record({ id: "b", product: "بطاطا", normalized_product: "بطاطا", price_min: 80, price_max: 80, source_id: "s2" }),
      record({ id: "c", product: "بطاطا", normalized_product: "بطاطا", price_min: 90, price_max: 90, source_id: "s3" }),
      record({ id: "d", product: "بطاطا", normalized_product: "بطاطا", price_min: 900, price_max: 900, source_id: "s4" }),
    ]);

    const potato = groups[0].products[0];
    expect(potato).toEqual(expect.objectContaining({
      price_min: 70,
      price_max: 90,
      source_count: 4,
      excluded_outlier_count: 1,
    }));
    expect(potato.records).toHaveLength(4);
  });

  it("does not filter a wide range when there are fewer than three observations", () => {
    const groups = groupPriceHistoryByDay([
      record({ id: "a", product: "فلفل", normalized_product: "فلفل", price_min: 100, price_max: 100, source_id: "s1" }),
      record({ id: "b", product: "فلفل", normalized_product: "فلفل", price_min: 300, price_max: 300, source_id: "s2" }),
    ]);

    expect(groups[0].products[0]).toEqual(expect.objectContaining({
      price_min: 100,
      price_max: 300,
      excluded_outlier_count: 0,
    }));
  });


  it("orders daily products by source coverage, then by product name for a stable mobile list", () => {
    const groups = groupPriceHistoryByDay([
      record({ id: "a", product: "طماطم", normalized_product: "طماطم", price_min: 70, price_max: 70, source_id: "s1" }),
      record({ id: "b", product: "بطاطا", normalized_product: "بطاطا", price_min: 80, price_max: 80, source_id: "s1" }),
      record({ id: "c", product: "بطاطا", normalized_product: "بطاطا", price_min: 85, price_max: 85, source_id: "s2" }),
      record({ id: "d", product: "بصل", normalized_product: "بصل", price_min: 40, price_max: 40, source_id: "s1" }),
      record({ id: "e", product: "بصل", normalized_product: "بصل", price_min: 45, price_max: 45, source_id: "s2" }),
    ]);

    expect(groups[0].products.map((item) => [item.product, item.source_count])).toEqual([
      ["بطاطا", 2],
      ["بصل", 2],
      ["طماطم", 1],
    ]);
  });

});
