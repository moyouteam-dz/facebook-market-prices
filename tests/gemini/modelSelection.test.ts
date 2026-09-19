import { describe, expect, it, vi } from "vitest";
import { listGeminiGenerateContentModels, selectGeminiGenerateContentModel } from "../../src/gemini/modelSelection";

describe("Gemini model selection",()=>{it("selects an available stable Flash model supporting generateContent",async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({models:[
  {name:"models/gemini-3.8-live",supportedGenerationMethods:["bidiGenerateContent"]},
  {name:"models/gemini-3.5-flash",supportedGenerationMethods:["generateContent"]},
  {name:"models/gemini-3.8-flash",supportedGenerationMethods:["generateContent"]}
 ]}),{status:200,headers:{"Content-Type":"application/json"}}));
 await expect(selectGeminiGenerateContentModel("secret",fetcher)).resolves.toBe("gemini-3.8-flash");
 expect(fetcher.mock.calls[0]?.[0]).not.toContain("secret");
 expect((fetcher.mock.calls[0]?.[1]?.headers as Record<string,string>)["x-goog-api-key"]).toBe("secret");
});it("prioritizes Flash-Lite multimodal models for quota-efficient extraction and keeps fallbacks",async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({models:[
  {name:"models/gemini-3.8-flash",supportedGenerationMethods:["generateContent"]},
  {name:"models/gemini-3.5-flash-lite",supportedGenerationMethods:["generateContent"]},
  {name:"models/gemini-2.5-flash-lite",supportedGenerationMethods:["generateContent"]}
 ]}),{status:200,headers:{"Content-Type":"application/json"}}));
 await expect(listGeminiGenerateContentModels("secret",fetcher)).resolves.toEqual([
  "gemini-3.5-flash-lite","gemini-2.5-flash-lite","gemini-3.8-flash"
 ]);
});
});