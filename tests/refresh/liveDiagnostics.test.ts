import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppDatabase } from "../../src/db/database";
import { runManualRefresh, type RefreshSource } from "../../src/refresh/manualRefresh";

describe("live refresh diagnostics", () => {
  let db: ReturnType<typeof createAppDatabase>;
  const source: RefreshSource = { id:"s",name:"سوق",market:"الحطاطبة",facebook_url:"https://facebook.com/x",enabled:true };
  beforeEach(async()=>{ db=createAppDatabase("diag-"+crypto.randomUUID()); await db.open(); });
  afterEach(async()=>{ await db.delete(); });

  it("reports safe image and Gemini failure categories without URLs or secrets", async()=>{
    const result=await runManualRefresh({
      db,token:"apify-secret",sources:[source],
      collectPosts:vi.fn().mockResolvedValue([{post_id:"p",source_id:"s",source_page:"سوق",market:"الحطاطبة",post_url:"https://facebook.com/p",post_date:"2026-09-18T00:00:00Z",text:"لا يوجد سعر",image_urls:["https://cdn.example.test/private?sig=abc"],unavailable:false}]),
      fetchImage:vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      ocrEngine:{recognize:vi.fn()},
      gemini:{enabled:true,apiKey:"gemini-secret",extract:vi.fn().mockRejectedValue(new Error("gemini_http_429"))},
    });
    expect(result.diagnostics).toEqual(expect.objectContaining({
      image_failures:1, image_failure_categories:{image_fetch_network:1},
      gemini_attempted:1, gemini_failed:1, gemini_failure_categories:{gemini_http_429:1},
    }));
    const serialized=JSON.stringify(result);
    expect(serialized).not.toContain("cdn.example.test");
    expect(serialized).not.toContain("apify-secret");
    expect(serialized).not.toContain("gemini-secret");
  });
});
