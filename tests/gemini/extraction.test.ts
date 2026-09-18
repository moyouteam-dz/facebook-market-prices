import { describe, expect, it, vi } from "vitest";
import { extractPricesWithGemini } from "../../src/gemini/extraction";
function json(value:unknown){return new Response(JSON.stringify(value),{status:200,headers:{"Content-Type":"application/json"}});}
describe("Gemini extraction",()=>{it("validates structured DZD output and normalizes reversed ranges",async()=>{
 const fetcher=vi.fn()
  .mockResolvedValueOnce(json({models:[{name:"models/gemini-3.5-flash",supportedGenerationMethods:["generateContent"]}]}))
  .mockResolvedValueOnce(json({candidates:[{content:{parts:[{text:JSON.stringify([{product:"بطاطا",price_min:100,price_max:80,currency:"DZD"},{product:"",price_min:1,price_max:2,currency:"DZD"},{product:"x",price_min:-1,price_max:2,currency:"DZD"}])}]}}]}));
 const result=await extractPricesWithGemini("secret",{postText:"بطاطا",ocrText:"80 100"},fetcher);
 expect(result).toEqual([expect.objectContaining({product:"بطاطا",price_min:80,price_max:100,currency:"DZD"})]);
 for(const call of fetcher.mock.calls){expect(call[0]).not.toContain("secret"); expect(String(call[1]?.body??"")).not.toContain("secret"); expect((call[1]?.headers as Record<string,string>)["x-goog-api-key"]).toBe("secret");}
 expect(fetcher.mock.calls[1]?.[0]).toContain("gemini-3.5-flash:generateContent");
});});
