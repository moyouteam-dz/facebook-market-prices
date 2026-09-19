import type { PriceHistoryRecord } from "../db/database";

export interface DailyPricePost {
  date: string;
  records: PriceHistoryRecord[];
}

function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
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
    .map(([date, items]) => ({
      date,
      records: [...items].sort((a, b) => b.post_date.localeCompare(a.post_date)),
    }));
}
