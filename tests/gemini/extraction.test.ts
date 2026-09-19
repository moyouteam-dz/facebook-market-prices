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
});
it("sends image bytes to Gemini Vision and asks it to return only real visible prices",async()=>{
 const fetcher=vi.fn()
  .mockResolvedValueOnce(json({models:[{name:"models/gemini-3.5-flash",supportedGenerationMethods:["generateContent"]}]}))
  .mockResolvedValueOnce(json({candidates:[{content:{parts:[{text:JSON.stringify([{product:"بصل",price_min:35,price_max:40,currency:"DZD"}])}]}}]}));
 await extractPricesWithGemini("secret",{postText:"",ocrText:"",images:[{mimeType:"image/jpeg",base64:"AQID"}]},fetcher);
 const body=JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
 expect(body.contents[0].parts).toEqual(expect.arrayContaining([
  expect.objectContaining({text:expect.stringContaining("الصورة")}),
  {inlineData:{mimeType:"image/jpeg",data:"AQID"}},
 ]));
 expect(String(fetcher.mock.calls[1]?.[1]?.body)).not.toContain("secret");
});

it("retries another eligible model when the first model is quota-limited",async()=>{
 const fetcher=vi.fn()
  .mockResolvedValueOnce(json({models:[
    {name:"models/gemini-3.5-flash-lite",supportedGenerationMethods:["generateContent"]},
    {name:"models/gemini-2.5-flash-lite",supportedGenerationMethods:["generateContent"]}
  ]}))
  .mockResolvedValueOnce(new Response(JSON.stringify({error:{code:429,status:"RESOURCE_EXHAUSTED"}}),{status:429,headers:{"Content-Type":"application/json"}}))
  .mockResolvedValueOnce(json({candidates:[{content:{parts:[{text:JSON.stringify([{product:"طماطم",price_min:70,price_max:90,currency:"DZD"}])}]}}]}));
 const result=await extractPricesWithGemini("secret",{postText:"",ocrText:"",images:[{mimeType:"image/jpeg",base64:"AQID"}]},fetcher);
 expect(result[0]).toEqual(expect.objectContaining({product:"طماطم",price_min:70,price_max:90}));
 expect(fetcher.mock.calls[1]?.[0]).toContain("gemini-3.5-flash-lite:generateContent");
 expect(fetcher.mock.calls[2]?.[0]).toContain("gemini-2.5-flash-lite:generateContent");
});
});
