import { describe, expect, it } from "vitest";
import { shouldUseGemini } from "../../src/gemini/fallbackPolicy";
const c=(confidence:"high"|"medium"|"low")=>({product:"x",normalized_product:"x",price_min:1,price_max:1,currency:"DZD" as const,confidence,raw_text:"x"});
describe("Gemini fallback policy",()=>{it("uses Gemini only for empty or exclusively low confidence deterministic results",()=>{
 expect(shouldUseGemini([],true,true)).toBe(true);
 expect(shouldUseGemini([c("low")],true,true)).toBe(true);
 expect(shouldUseGemini([c("medium")],true,true)).toBe(false);
 expect(shouldUseGemini([c("high")],true,true)).toBe(false);
 expect(shouldUseGemini([],false,true)).toBe(false);
 expect(shouldUseGemini([],true,false)).toBe(false);
});});
