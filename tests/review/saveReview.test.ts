import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppDatabase } from "../../src/db/database";
import { applyProductAlias } from "../../src/aliases/productAliases";
import {
  saveReviewedCandidates,
  type EditableReviewCandidate,
} from "../../src/review/saveReview";

describe("review save gate", () => {
  let db: ReturnType<typeof createAppDatabase>;

  beforeEach(async () => {
    db = createAppDatabase("review-test-" + crypto.randomUUID());
    await db.open();
    await db.runs.add({
      id: "run-1",
      started_at: "2026-09-18T00:00:00.000Z",
      selected_sources: ["source-1"],
      posts_received: 1,
      images_processed: 0,
      candidates_found: 2,
      candidates_saved: 0,
      candidates_rejected: 0,
      errors: [],
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  const base: EditableReviewCandidate = {
    id: "candidate-1",
    original_product: "بطاط",
    product: "بطاطا",
    normalized_product: "بطاطا",
    price_min: 80,
    price_max: 80,
    currency: "DZD",
    market: "الشلف",
    source_id: "source-1",
    source_page: "سوق الجملة",
    post_id: "post-1",
    post_url: "https://www.facebook.com/market/posts/1",
    post_date: "2026-09-18T00:00:00.000Z",
    source_type: "post_text",
    raw_text: "بطاط 80 دج",
    confidence: "high",
    accepted: true,
    remember_correction: true,
  };

  it("persists only accepted rows and can remember product corrections", async () => {
    const rejected: EditableReviewCandidate = {
      ...base,
      id: "candidate-2",
      post_id: "post-2",
      original_product: "بصل",
      product: "بصل",
      normalized_product: "بصل",
      accepted: false,
      remember_correction: false,
    };

    const result = await saveReviewedCandidates(db, "run-1", [base, rejected]);

    expect(result).toEqual({ saved: 1, rejected: 1, duplicates: 0 });
    expect(await db.price_history.count()).toBe(1);

    const saved = await db.price_history.toCollection().first();
    expect(saved?.product).toBe("بطاطا");
    expect(saved?.price_min).toBe(80);
    expect(saved?.price_max).toBe(80);

    expect(await applyProductAlias(db, "بطاط")).toBe("بطاطا");

    const run = await db.runs.get("run-1");
    expect(run?.candidates_saved).toBe(1);
    expect(run?.candidates_rejected).toBe(1);
  });

  it("does not duplicate an already saved reviewed observation", async () => {
    expect(
      await saveReviewedCandidates(db, "run-1", [
        { ...base, remember_correction: false },
      ]),
    ).toEqual({ saved: 1, rejected: 0, duplicates: 0 });

    expect(
      await saveReviewedCandidates(db, "run-1", [
        { ...base, id: "candidate-copy", remember_correction: false },
      ]),
    ).toEqual({ saved: 0, rejected: 0, duplicates: 1 });

    expect(await db.price_history.count()).toBe(1);
  });

  it("applies remembered aliases across harmless writing variations", async () => {
    await saveReviewedCandidates(db, "run-1", [base]);

    expect(await applyProductAlias(db, "  بَطاط  ")).toBe("بطاطا");

    await db.product_aliases.put({
      id: crypto.randomUUID(),
      observed_name: "Pomme de terre",
      canonical_name: "بطاطا",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(await applyProductAlias(db, "pomme   DE TERRE")).toBe("بطاطا");
  });

});
