import { describe, expect, it, vi } from "vitest";
import { createArabicPaddleOcrEngine } from "../../src/ocr/paddleOcrEngine";

describe("Arabic PaddleOCR engine", () => {
  it("loads Arabic PP-OCRv5 lazily in worker mode and joins recognized lines", async () => {
    const predict = vi.fn().mockResolvedValue([
      {
        items: [
          { text: "بطاطا 80 دج", score: 0.92 },
          { text: "بصل 35-40 دج", score: 0.84 },
        ],
      },
    ]);
    const dispose = vi.fn();
    const create = vi.fn().mockResolvedValue({ predict, dispose });

    const engine = createArabicPaddleOcrEngine(async () => ({ PaddleOCR: { create } }));
    const result = await engine.recognize(new Blob(["image"], { type: "image/jpeg" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: "ar",
        ocrVersion: "PP-OCRv5",
        worker: true,
        ortOptions: expect.objectContaining({
          backend: "wasm",
          numThreads: 1,
          simd: true,
        }),
      }),
    );
    expect(result.text).toBe("بطاطا 80 دج\nبصل 35-40 دج");
    expect(result.confidence).toBeCloseTo(0.88);
    await engine.dispose?.();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("reuses one loaded OCR pipeline across sequential images", async () => {
    const predict = vi.fn().mockResolvedValue([{ items: [] }]);
    const create = vi.fn().mockResolvedValue({ predict, dispose: vi.fn() });
    const engine = createArabicPaddleOcrEngine(async () => ({ PaddleOCR: { create } }));

    await engine.recognize(new Blob(["one"]));
    await engine.recognize(new Blob(["two"]));

    expect(create).toHaveBeenCalledTimes(1);
    expect(predict).toHaveBeenCalledTimes(2);
  });
  it("wraps initialization and prediction failures with safe stage codes", async () => {
    const initEngine=createArabicPaddleOcrEngine(async()=>({PaddleOCR:{create:vi.fn().mockRejectedValue(new Error("private init detail"))}}));
    await expect(initEngine.recognize(new Blob(["x"]))).rejects.toThrow("ocr_init_failed");

    const predict=vi.fn().mockRejectedValue(new Error("private predict detail"));
    const predictEngine=createArabicPaddleOcrEngine(async()=>({PaddleOCR:{create:vi.fn().mockResolvedValue({predict,dispose:vi.fn()})}}));
    await expect(predictEngine.recognize(new Blob(["x"]))).rejects.toThrow("ocr_predict_failed");
  });

  it("does not permanently cache a rejected initialization", async () => {
    const create=vi.fn().mockRejectedValueOnce(new Error("first")).mockResolvedValueOnce({predict:vi.fn().mockResolvedValue([{items:[]}]),dispose:vi.fn()});
    const engine=createArabicPaddleOcrEngine(async()=>({PaddleOCR:{create}}));
    await expect(engine.recognize(new Blob(["x"]))).rejects.toThrow("ocr_init_failed");
    await expect(engine.recognize(new Blob(["y"]))).resolves.toEqual({text:"",confidence:0});
    expect(create).toHaveBeenCalledTimes(2);
  });
});
