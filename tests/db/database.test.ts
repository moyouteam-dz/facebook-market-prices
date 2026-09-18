import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppDatabase } from "../../src/db/database";
import {
  deleteApifyToken,
  getApifyToken,
  replaceApifyToken,
} from "../../src/db/secrets";
import { buildExportSnapshot } from "../../src/db/exportSnapshot";

describe("local persistence and secret boundary", () => {
  let db: ReturnType<typeof createAppDatabase>;

  beforeEach(async () => {
    db = createAppDatabase(`market-prices-test-${crypto.randomUUID()}`);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("creates all v1 tables", () => {
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        "price_history",
        "product_aliases",
        "runs",
        "secret_settings",
        "settings",
        "sources",
      ].sort(),
    );
  });

  it("persists, replaces, and deletes the Apify token in secret_settings", async () => {
    await replaceApifyToken(db, "apify_api_first");
    expect(await getApifyToken(db)).toBe("apify_api_first");

    await replaceApifyToken(db, "apify_api_second");
    expect(await getApifyToken(db)).toBe("apify_api_second");

    await deleteApifyToken(db);
    expect(await getApifyToken(db)).toBeNull();
  });

  it("never includes secret_settings in export snapshots", async () => {
    await replaceApifyToken(db, "apify_api_must_not_export");
    await db.settings.put({ key: "schema_version", value: 1 });

    const snapshot = await buildExportSnapshot(db);

    expect(snapshot.settings).toEqual([{ key: "schema_version", value: 1 }]);
    expect(JSON.stringify(snapshot)).not.toContain("apify_api_must_not_export");
    expect(snapshot).not.toHaveProperty("secret_settings");
  });
});
