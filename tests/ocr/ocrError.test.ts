import { describe, expect, it } from "vitest";
import { classifyOcrError } from "../../src/ocr/ocrError";
describe("OCR safe error classification",()=>{
 it("keeps actionable safe engine categories",()=>{
  expect(classifyOcrError(new Error("Failed to fetch dynamically imported module"))).toBe("ocr_module_load_failed");
  expect(classifyOcrError(new Error("Failed to fetch model.onnx"))).toBe("ocr_model_load_failed");
  expect(classifyOcrError(new Error("no available backend found"))).toBe("ocr_backend_failed");
  expect(classifyOcrError(new Error("random private details"))).toBe("ocr_runtime_failed");
 });
});
