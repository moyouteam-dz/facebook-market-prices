import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ARABIC_OCR_MODELS,
  type OcrEngine,
} from "../../src/ocr/types";
import {
  OcrCancelledError,
  processImagesSequentially,
} from "../../src/ocr/sequentialProcessor";

describe("mobile OCR abstraction", () => {
  it("configures both detection and Arabic recognition models", () => {
    expect(DEFAULT_ARABIC_OCR_MODELS.detector).toMatch(/\.onnx$/);
    expect(DEFAULT_ARABIC_OCR_MODELS.recognizer).toMatch(/\.onnx$/);
    expect(DEFAULT_ARABIC_OCR_MODELS.language).toBe("ar");
  });

  it("processes images strictly one at a time and reports progress", async () => {
    let active = 0;
    let maxActive = 0;
    const first = new Blob(["first"], { type: "text/plain" });
    const second = new Blob(["second"], { type: "text/plain" });
    const labels = new Map<Blob, string>([
      [first, "first"],
      [second, "second"],
    ]);

    const recognize = vi.fn(async (image: Blob) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return {
        text: labels.get(image) ?? "",
        confidence: 0.9,
      };
    });

    const engine: OcrEngine = { recognize };
    const progress: Array<[number, number]> = [];

    const results = await processImagesSequentially([first, second], engine, {
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(maxActive).toBe(1);
    expect(results.map((result) => result.text)).toEqual(["first", "second"]);
    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it("stops before the next image when cancellation is requested", async () => {
    const controller = new AbortController();
    const recognize = vi.fn(async () => {
      controller.abort();
      return { text: "first", confidence: 1 };
    });

    await expect(
      processImagesSequentially(
        [new Blob(["1"]), new Blob(["2"])],
        { recognize },
        { signal: controller.signal },
      ),
    ).rejects.toBeInstanceOf(OcrCancelledError);

    expect(recognize).toHaveBeenCalledTimes(1);
  });
});
