import { describe, expect, it, vi } from "vitest";
import { createArabicTesseractOcrEngine } from "../../src/ocr/tesseractOcrEngine";

describe("Arabic Tesseract OCR engine", () => {
  it("loads Arabic once, recognizes sequential images, and terminates", async () => {
    const recognize = vi.fn()
      .mockResolvedValueOnce({ data: { text: "بطاطا 80 دج", confidence: 91 } })
      .mockResolvedValueOnce({ data: { text: "بصل 35-40 دج", confidence: 83 } });
    const terminate = vi.fn();
    const createWorker = vi.fn().mockResolvedValue({ recognize, terminate });

    const engine = createArabicTesseractOcrEngine(async () => ({ createWorker }));

    await expect(engine.recognize(new Blob(["one"], { type: "image/jpeg" })))
      .resolves.toEqual({ text: "بطاطا 80 دج", confidence: 0.91 });
    await expect(engine.recognize(new Blob(["two"], { type: "image/jpeg" })))
      .resolves.toEqual({ text: "بصل 35-40 دج", confidence: 0.83 });

    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(createWorker).toHaveBeenCalledWith(
      "ara",
      1,
      expect.objectContaining({
        workerPath: expect.stringContaining("worker.min.js"),
        langPath: expect.stringContaining("tessdata"),
        corePath: expect.stringContaining("tesseract.js-core"),
      }),
    );
    expect(recognize).toHaveBeenCalledTimes(2);

    await engine.dispose?.();
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("does not cache a rejected worker initialization", async () => {
    const createWorker = vi.fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValueOnce({
        recognize: vi.fn().mockResolvedValue({ data: { text: "", confidence: 0 } }),
        terminate: vi.fn(),
      });
    const engine = createArabicTesseractOcrEngine(async () => ({ createWorker }));

    await expect(engine.recognize(new Blob(["x"]))).rejects.toThrow("ocr_init_failed");
    await expect(engine.recognize(new Blob(["y"]))).resolves.toEqual({ text: "", confidence: 0 });
    expect(createWorker).toHaveBeenCalledTimes(2);
  });
});
