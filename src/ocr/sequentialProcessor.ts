import type { OcrEngine, OcrResult } from "./types";

export class OcrCancelledError extends Error {
  constructor() {
    super("ocr_cancelled");
    this.name = "OcrCancelledError";
  }
}

export interface SequentialOcrOptions {
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export async function processImagesSequentially(
  images: Blob[],
  engine: OcrEngine,
  options: SequentialOcrOptions = {},
): Promise<OcrResult[]> {
  const total = images.length;
  const output: OcrResult[] = [];

  options.onProgress?.(0, total);

  for (const image of images) {
    if (options.signal?.aborted) {
      throw new OcrCancelledError();
    }

    const result = await engine.recognize(image);
    output.push(result);
    options.onProgress?.(output.length, total);

    if (options.signal?.aborted && output.length < total) {
      throw new OcrCancelledError();
    }
  }

  return output;
}
