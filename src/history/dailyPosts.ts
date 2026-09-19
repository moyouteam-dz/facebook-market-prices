import type { PriceHistoryRecord } from "../db/database";

export interface DailyProductSummary {
  product: string;
  normalized_product: string;
  price_min: number;
  price_max: number;
  source_count: number;
  records: PriceHistoryRecord[];
}

export interface DailyPricePost {
  date: string;
  records: PriceHistoryRecord[];
  products: DailyProductSummary[];
}

function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function summarizeProducts(records: PriceHistoryRecord[]): DailyProductSummary[] {
  const byProduct = new Map<string, DailyProductSummary>();

  for (const record of records) {
    const key = record.normalized_product.trim().toLocaleLowerCase("ar");
    const existing = byProduct.get(key);

    if (!existing) {
      byProduct.set(key, {
        product: record.product,
        normalized_product: record.normalized_product,
        price_min: record.price_min,
        price_max: record.price_max,
        source_count: 1,
        records: [record],
      });
      continue;
    }

    existing.price_min = Math.min(existing.price_min, record.price_min);
    existing.price_max = Math.max(existing.price_max, record.price_max);
    existing.records.push(record);
    existing.source_count = new Set(existing.records.map((item) => item.source_id)).size;
  }

  return [...byProduct.values()];
}

export function groupPriceHistoryByDay(records: PriceHistoryRecord[]): DailyPricePost[] {
  const groups = new Map<string, PriceHistoryRecord[]>();

  for (const record of records) {
    const date = dayKey(record.post_date);
    const bucket = groups.get(date) ?? [];
    bucket.push(record);
    groups.set(date, bucket);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => {
      const sortedRecords = [...items].sort((a, b) => b.post_date.localeCompare(a.post_date));
      return {
        date,
        records: sortedRecords,
        products: summarizeProducts(sortedRecords),
      };
    });
}
