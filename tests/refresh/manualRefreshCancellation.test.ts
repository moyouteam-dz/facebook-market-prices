import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppDatabase } from "../../src/db/database";
import { runManualRefresh } from "../../src/refresh/manualRefresh";

const databases: ReturnType<typeof createAppDatabase>[] = [];
const source = {
  id: "source-1",
  name: "السوق",
  market: "الشلف",
  facebook_url: "https://www.facebook.com/Emagfel",
  enabled: true,
};

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

describe("manual refresh cancellation", () => {
  it("finishes the run as cancelled instead of leaving an unfinished run", async () => {
    const db = createAppDatabase(`cancel-${crypto.randomUUID()}`);
    databases.push(db);
    const controller = new AbortController();

    const promise = runManualRefresh({
      db,
      token: "apify_api_test",
      sources: [source],
      collectPosts: async () => {
        controller.abort();
        return [];
      },
      fetchImage: vi.fn(),
      ocrEngine: { recognize: vi.fn() },
      signal: controller.signal,
    });

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });

    const runs = await db.runs.toArray();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.finished_at).toBeTruthy();
    expect(runs[0]?.errors).toContain("refresh_cancelled");
  });
});
