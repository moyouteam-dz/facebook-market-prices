import type { OcrEngine, OcrResult } from "./types";

interface TesseractWorker {
  recognize(image: Blob): Promise<{ data?: { text?: string; confidence?: number } }>;
  terminate(): Promise<void> | void;
}

interface TesseractModule {
  createWorker(
    langs: string,
    oem: number,
    options: {
      workerPath: string;
      langPath: string;
      corePath: string;
    },
  ): Promise<TesseractWorker>;
}

type TesseractImporter = () => Promise<TesseractModule>;

const defaultImporter: TesseractImporter = async () =>
  (await import("tesseract.js")) as unknown as TesseractModule;

const WORKER_PATH =
  "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js";
const CORE_PATH =
  "https://cdn.jsdelivr.net/npm/tesseract.js-core@7";
const LANG_PATH =
  "https://tessdata.projectnaptha.com/4.0.0";

function normalizeResult(result: {
  data?: { text?: string; confidence?: number };
}): OcrResult {
  const text = result.data?.text?.trim() ?? "";
  const rawConfidence = result.data?.confidence;
  const confidence =
    typeof rawConfidence === "number" && Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(1, rawConfidence / 100))
      : 0;

  return { text, confidence };
}

export function createArabicTesseractOcrEngine(
  importer: TesseractImporter = defaultImporter,
): OcrEngine {
  let workerPromise: Promise<TesseractWorker> | null = null;

  function getWorker() {
    if (!workerPromise) {
      workerPromise = importer()
        .then(({ createWorker }) =>
          createWorker("ara", 1, {
            workerPath: WORKER_PATH,
            langPath: LANG_PATH,
            corePath: CORE_PATH,
          }),
        )
        .catch(() => {
          workerPromise = null;
          throw new Error("ocr_init_failed");
        });
    }
    return workerPromise;
  }

  return {
    async recognize(image: Blob): Promise<OcrResult> {
      const worker = await getWorker();
      try {
        return normalizeResult(await worker.recognize(image));
      } catch {
        throw new Error("ocr_predict_failed");
      }
    },

    async dispose() {
      if (!workerPromise) return;
      const worker = await workerPromise;
      workerPromise = null;
      await worker.terminate();
    },
  };
}
