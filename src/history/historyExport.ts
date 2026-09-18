import type { AppDatabase, PriceHistoryRecord } from "../db/database";

export interface HistoryQuery {
  product?: string;
  market?: string;
  from?: string;
  to?: string;
}

function includesFolded(value: string, query?: string) {
  const needle = query?.trim().toLocaleLowerCase("ar");
  if (!needle) return true;
  return value.toLocaleLowerCase("ar").includes(needle);
}

export async function queryPriceHistory(
  db: AppDatabase,
  query: HistoryQuery = {},
): Promise<PriceHistoryRecord[]> {
  const records = await db.price_history.toArray();
  const from = query.from ? new Date(query.from + "T00:00:00.000Z").getTime() : null;
  const to = query.to ? new Date(query.to + "T23:59:59.999Z").getTime() : null;

  return records
    .filter((record) => includesFolded(record.product, query.product))
    .filter((record) => includesFolded(record.market, query.market))
    .filter((record) => {
      const time = new Date(record.post_date).getTime();
      if (from !== null && time < from) return false;
      if (to !== null && time > to) return false;
      return true;
    })
    .sort((a, b) => b.post_date.localeCompare(a.post_date));
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

export async function buildCsvExport(db: AppDatabase): Promise<string> {
  const records = await queryPriceHistory(db);
  const header = [
    "product",
    "price_min",
    "price_max",
    "currency",
    "market",
    "source_page",
    "post_date",
    "source_type",
    "post_url",
    "confidence",
  ];

  const lines = records.map((record) =>
    [
      record.product,
      record.price_min,
      record.price_max,
      record.currency,
      record.market,
      record.source_page,
      record.post_date,
      record.source_type,
      record.post_url,
      record.confidence,
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
