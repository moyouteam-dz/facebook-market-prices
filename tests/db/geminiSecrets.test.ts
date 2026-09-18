import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppDatabase } from "../../src/db/database";
import {
  deleteGeminiApiKey,
  getGeminiApiKey,
  replaceGeminiApiKey,
} from "../../src/db/secrets";
import { buildBackup, resetAllLocalData } from "../../src/backup/backupService";

describe("Gemini local secret", () => {
  let db: ReturnType<typeof createAppDatabase>;
  beforeEach(async () => {
    db = createAppDatabase("gemini-secret-" + crypto.randomUUID());
    await db.open();
  });
  afterEach(async () => { await db.delete(); });

  it("stores, replaces and deletes the Gemini key", async () => {
    await replaceGeminiApiKey(db, "  gemini-secret-1  ");
    expect(await getGeminiApiKey(db)).toBe("gemini-secret-1");
    await replaceGeminiApiKey(db, "gemini-secret-2");
    expect(await getGeminiApiKey(db)).toBe("gemini-secret-2");
    await deleteGeminiApiKey(db);
    expect(await getGeminiApiKey(db)).toBeNull();
  });

  it("never exports Gemini secrets and reset deletes them", async () => {
    await replaceGeminiApiKey(db, "gemini-never-export");
    expect(JSON.stringify(await buildBackup(db))).not.toContain("gemini-never-export");
    await resetAllLocalData(db);
    expect(await getGeminiApiKey(db)).toBeNull();
  });
});
