import { describe, expect, it, vi } from "vitest";
import { extractPricesWithGemini } from "../../src/gemini/extraction";
function response(items:unknown){return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(items)}]}}]}),{status:200,headers:{"Content-Type":"application/json"}});}
describe("Gemini extraction",()=>{it("validates structured DZD output and normalizes reversed ranges",async()=>{
 const fetcher=vi.fn().mockResolvedValue(response([{product:"بطاطا",price_min:100,price_max:80,currency:"DZD"},{product:"",price_min:1,price_max:2,currency:"DZD"},{product:"x",price_min:-1,price_max:2,currency:"DZD"}]));
 const result=await extractPricesWithGemini("secret",{postText:"بطاطا",ocrText:"80 100"},fetcher);
 expect(result).toEqual([expect.objectContaining({product:"بطاطا",price_min:80,price_max:100,currency:"DZD"})]);
 const init=fetcher.mock.calls[0]?.[1] as RequestInit;
 expect(JSON.stringify(init)).not.toContain("secret");
 expect((init.headers as Record<string,string>)["x-goog-api-key"]).toBe("secret");
});});
