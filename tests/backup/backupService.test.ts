import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppDatabase } from "../../src/db/database";
import {
  buildCsvExport,
  queryPriceHistory,
} from "../../src/history/historyExport";
import {
  BackupValidationError,
  buildBackup,
  restoreBackup,
} from "../../src/backup/backupService";
import { replaceApifyToken } from "../../src/db/secrets";

describe("history, CSV, backup, and restore", () => {
  let db: ReturnType<typeof createAppDatabase>;

  beforeEach(async () => {
    db = createAppDatabase("backup-test-" + crypto.randomUUID());
    await db.open();

    await db.price_history.bulkAdd([
      {
        id: "h1",
        product: "البصل",
        normalized_product: "البصل",
        price_min: 35,
        price_max: 40,
        currency: "DZD",
        market: "الشلف",
        source_id: "s1",
        source_page: "سوق الجملة",
        post_id: "p1",
        post_url: "https://facebook.com/p1",
        source_type: "post_text",
        raw_text: "البصل 35-40 دج",
        post_date: "2026-09-17T00:00:00.000Z",
        scraped_at: "2026-09-17T01:00:00.000Z",
        reviewed_at: "2026-09-17T01:05:00.000Z",
        confidence: "high",
        fingerprint: "fp1",
      },
      {
        id: "h2",
        product: "بطاطا",
        normalized_product: "بطاطا",
        price_min: 80,
        price_max: 80,
        currency: "DZD",
        market: "الجزائر",
        source_id: "s2",
        source_page: "سوق 2",
        post_id: "p2",
        post_url: "https://facebook.com/p2",
        source_type: "image_ocr",
        raw_text: "بطاطا 80 دج",
        post_date: "2026-09-18T00:00:00.000Z",
        scraped_at: "2026-09-18T01:00:00.000Z",
        reviewed_at: "2026-09-18T01:05:00.000Z",
        confidence: "medium",
        fingerprint: "fp2",
      },
    ]);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("filters history by product, market, and date", async () => {
    expect(
      await queryPriceHistory(db, {
        product: "بطاط",
        market: "الجزائر",
        from: "2026-09-18",
        to: "2026-09-18",
      }),
    ).toEqual([expect.objectContaining({ id: "h2", product: "بطاطا" })]);
  });

  it("exports UTF-8 CSV with separate min/max columns and no secrets", async () => {
    await replaceApifyToken(db, "apify_api_never_export");
    const csv = await buildCsvExport(db);

    expect(csv).toContain("product,price_min,price_max,currency");
    expect(csv).toContain("البصل,35,40,DZD");
    expect(csv).not.toContain("apify_api_never_export");
  });

  it("builds a versioned JSON backup without the Apify token", async () => {
    await replaceApifyToken(db, "apify_api_never_backup");
    await db.sources.add({
      id: "s1",
      name: "سوق الجملة",
      market: "الشلف",
      facebook_url: "https://www.facebook.com/market",
      enabled: true,
      created_at: "2026-09-18T00:00:00.000Z",
      updated_at: "2026-09-18T00:00:00.000Z",
    });

    const backup = await buildBackup(db);

    expect(backup.schema_version).toBe(1);
    expect(backup.sources).toHaveLength(1);
    expect(backup.price_history).toHaveLength(2);
    expect(JSON.stringify(backup)).not.toContain("apify_api_never_backup");
    expect(backup).not.toHaveProperty("secret_settings");
  });

  it("restores by merge and deduplicates history fingerprints", async () => {
    const backup = await buildBackup(db);
    await db.price_history.clear();

    expect(await restoreBackup(db, backup)).toEqual(
      expect.objectContaining({ restored_history: 2 }),
    );
    expect(await db.price_history.count()).toBe(2);

    expect(await restoreBackup(db, backup)).toEqual(
      expect.objectContaining({ restored_history: 0, duplicate_history: 2 }),
    );
    expect(await db.price_history.count()).toBe(2);
  });

  it("rejects incompatible backup schemas before modifying local data", async () => {
    const before = await db.price_history.count();

    await expect(
      restoreBackup(db, { schema_version: 999 } as never),
    ).rejects.toBeInstanceOf(BackupValidationError);

    expect(await db.price_history.count()).toBe(before);
  });
});
