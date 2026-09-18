import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppDatabase } from "../../src/db/database";
import {
  applyProductAlias,
  rememberProductAlias,
} from "../../src/aliases/productAliases";
import {
  buildObservationFingerprint,
  deduplicateCandidates,
  saveReviewedObservation,
} from "../../src/history/observations";

describe("aliases, fingerprints, and deduplication", () => {
  let db: ReturnType<typeof createAppDatabase>;

  beforeEach(async () => {
    db = createAppDatabase(\`dedup-test-\${crypto.randomUUID()}\`);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("remembers a local product correction and applies it later", async () => {
    await rememberProductAlias(db, "بطاط", "بطاطا");
    expect(await applyProductAlias(db, "بطاط")).toBe("بطاطا");
    expect(await applyProductAlias(db, "بصل")).toBe("بصل");
  });

  it("builds the same fingerprint for the same evidence", () => {
    const first = buildObservationFingerprint({
      source_id: "s1",
      post_id: "p1",
      normalized_product: "بطاطا",
      price_min: 80,
      price_max: 80,
      source_type: "post_text",
    });

    const second = buildObservationFingerprint({
      source_id: "s1",
      post_id: "p1",
      normalized_product: "بطاطا",
      price_min: 80,
      price_max: 80,
      source_type: "post_text",
    });

    expect(first).toBe(second);
  });

  it("removes repeated candidates before review", () => {
    const base = {
      source_id: "s1",
      post_id: "p1",
      normalized_product: "البصل",
      product: "البصل",
      price_min: 35,
      price_max: 40,
      source_type: "post_text" as const,
    };

    expect(deduplicateCandidates([base, { ...base }])).toHaveLength(1);
  });

  it("does not persist the same reviewed observation twice", async () => {
    const observation = {
      product: "البصل",
      normalized_product: "البصل",
      price_min: 35,
      price_max: 40,
      currency: "DZD" as const,
      market: "الجزائر",
      source_id: "s1",
      source_page: "سوق الجملة",
      post_id: "p1",
      post_url: "https://www.facebook.com/example/posts/1",
      source_type: "post_text" as const,
      raw_text: "البصل 35-40 دج",
      post_date: "2026-09-18T00:00:00.000Z",
      scraped_at: "2026-09-18T01:00:00.000Z",
      reviewed_at: "2026-09-18T01:05:00.000Z",
      confidence: "high" as const,
    };

    expect(await saveReviewedObservation(db, observation)).toBe(true);
    expect(await saveReviewedObservation(db, observation)).toBe(false);
    expect(await db.price_history.count()).toBe(1);
  });
});
