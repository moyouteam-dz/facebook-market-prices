import type { PriceHistoryRecord } from "../db/database";

export interface DailyProductSummary {
  product: string;
  normalized_product: string;
  price_min: number;
  price_max: number;
  source_count: number;
  excluded_outlier_count: number;
  records: PriceHistoryRecord[];
}

export interface DailyMarketSummary {
  market: string;
  products: DailyProductSummary[];
  records: PriceHistoryRecord[];
}

export interface DailyPricePost {
  date: string;
  records: PriceHistoryRecord[];
  markets: DailyMarketSummary[];
  products: DailyProductSummary[];
}

function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function displayRange(records: PriceHistoryRecord[]): {
  price_min: number;
  price_max: number;
  excluded_outlier_count: number;
} {
  const allMin = Math.min(...records.map((record) => record.price_min));
  const allMax = Math.max(...records.map((record) => record.price_max));

  if (records.length < 3) {
    return { price_min: allMin, price_max: allMax, excluded_outlier_count: 0 };
  }

  const centers = records.map((record) => (record.price_min + record.price_max) / 2);
  const centerMedian = median(centers);
  if (!Number.isFinite(centerMedian) || centerMedian <= 0) {
    return { price_min: allMin, price_max: allMax, excluded_outlier_count: 0 };
  }

  const lowerBound = centerMedian / 3;
  const upperBound = centerMedian * 3;
  const included = records.filter((record) => {
    const center = (record.price_min + record.price_max) / 2;
    return center >= lowerBound && center <= upperBound;
  });

  if (included.length < 2) {
    return { price_min: allMin, price_max: allMax, excluded_outlier_count: 0 };
  }

  return {
    price_min: Math.min(...included.map((record) => record.price_min)),
    price_max: Math.max(...included.map((record) => record.price_max)),
    excluded_outlier_count: records.length - included.length,
  };
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
        excluded_outlier_count: 0,
        records: [record],
      });
      continue;
    }

    existing.records.push(record);
    existing.source_count = new Set(existing.records.map((item) => item.source_id)).size;
    const range = displayRange(existing.records);
    existing.price_min = range.price_min;
    existing.price_max = range.price_max;
    existing.excluded_outlier_count = range.excluded_outlier_count;
  }

  return [...byProduct.values()].sort((a, b) => {
    if (a.source_count !== b.source_count) {
      return b.source_count - a.source_count;
    }
    return a.product.localeCompare(b.product, "ar");
  });
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
      const marketMap = new Map<string, PriceHistoryRecord[]>();

      for (const record of sortedRecords) {
        const market = record.market.trim() || "سوق غير محدد";
        const bucket = marketMap.get(market) ?? [];
        bucket.push(record);
        marketMap.set(market, bucket);
      }

      const markets = [...marketMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "ar"))
        .map(([market, marketRecords]) => ({
          market,
          records: marketRecords,
          products: summarizeProducts(marketRecords),
        }));

      return {
        date,
        records: sortedRecords,
        markets,
        products: markets.flatMap((market) => market.products),
      };
    });
}


function formatPublishDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("ar-DZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDailyPricePostForPublishing(dailyPost: DailyPricePost): string {
  const sections = dailyPost.markets.flatMap((market) => {
    const lines = market.products.map((product) => {
      const price =
        product.price_min === product.price_max
          ? String(product.price_min)
          : product.price_min + "–" + product.price_max;
      return product.product + ": " + price + " دج";
    });
    return ["سوق " + market.market, ...lines, ""];
  });

  return ["أسعار اليوم — " + formatPublishDate(dailyPost.date), "", ...sections]
    .join("\n")
    .trimEnd();
}
