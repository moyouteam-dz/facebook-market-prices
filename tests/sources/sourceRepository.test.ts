import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppDatabase } from "../../src/db/database";
import {
  createSource,
  deleteSource,
  listSources,
  setSourceEnabled,
  updateSource,
  validateFacebookPageUrl,
} from "../../src/sources/sourceRepository";

describe("Facebook source management", () => {
  let db: ReturnType<typeof createAppDatabase>;

  beforeEach(async () => {
    db = createAppDatabase(`source-test-${crypto.randomUUID()}`);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("accepts public Facebook page URLs and rejects groups or invalid hosts", () => {
    expect(
      validateFacebookPageUrl("https://www.facebook.com/Emagfel"),
    ).toEqual({
      valid: true,
      normalizedUrl: "https://www.facebook.com/Emagfel",
    });

    expect(
      validateFacebookPageUrl("https://facebook.com/groups/12345"),
    ).toEqual({
      valid: false,
      reason: "groups_not_supported",
    });

    expect(
      validateFacebookPageUrl("https://example.com/Emagfel"),
    ).toEqual({
      valid: false,
      reason: "unsupported_host",
    });
  });

  it("creates, edits, enables/disables, lists, and deletes sources", async () => {
    const created = await createSource(db, {
      name: "سوق الجملة",
      market: "الجزائر",
      facebook_url: "https://www.facebook.com/Emagfel",
    });

    expect(created.enabled).toBe(true);
    expect(await listSources(db)).toHaveLength(1);

    const edited = await updateSource(db, created.id, {
      name: "سوق الجملة المعدل",
      market: "الحراش",
    });
    expect(edited.name).toBe("سوق الجملة المعدل");
    expect(edited.market).toBe("الحراش");

    await setSourceEnabled(db, created.id, false);
    expect((await listSources(db))[0]?.enabled).toBe(false);

    await deleteSource(db, created.id);
    expect(await listSources(db)).toEqual([]);
  });
});
