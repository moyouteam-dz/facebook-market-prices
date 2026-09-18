import type { OcrEngine, OcrResult } from "./types";

interface PaddleItem {
  text?: string;
  score?: number;
}

interface PaddleResult {
  items?: PaddleItem[];
}

interface PaddleInstance {
  predict(image: Blob): Promise<PaddleResult[]>;
  dispose(): Promise<void> | void;
}

interface PaddleModule {
  PaddleOCR: {
    create(options: {
      lang: string;
      ocrVersion: "PP-OCRv5";
      worker: boolean;
      textRecognitionModelName: string;
      textDetectionBatchSize: number;
      textRecognitionBatchSize: number;
      ortOptions: {
        backend: "wasm";
        wasmPaths: string;
        numThreads: number;
        simd: boolean;
      };
    }): Promise<PaddleInstance>;
  };
}

type PaddleImporter = () => Promise<PaddleModule>;

const defaultImporter: PaddleImporter = async () =>
  (await import("@paddleocr/paddleocr-js")) as unknown as PaddleModule;

function toResult(results: PaddleResult[]): OcrResult {
  const items = results.flatMap((result) => result.items ?? []);
  const text = items
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
  const scores = items
    .map((item) => item.score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  return {
    text,
    confidence:
      scores.length === 0
        ? 0
        : scores.reduce((sum, score) => sum + score, 0) / scores.length,
  };
}

export function createArabicPaddleOcrEngine(
  importer: PaddleImporter = defaultImporter,
): OcrEngine {
  let pipelinePromise: Promise<PaddleInstance> | null = null;

  function getPipeline() {
    if (!pipelinePromise) {
      pipelinePromise = importer().then(({ PaddleOCR }) =>
        PaddleOCR.create({
        lang: "ar",
        ocrVersion: "PP-OCRv5",
        worker: true,
        textRecognitionModelName: "arabic_PP-OCRv5_mobile_rec",
        textDetectionBatchSize: 1,
        textRecognitionBatchSize: 1,
        ortOptions: {
          backend: "wasm",
          wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/",
          numThreads: 1,
          simd: true,
        },
        }),
      ).catch(() => {
        pipelinePromise = null;
        throw new Error("ocr_init_failed");
      });
    }
    return pipelinePromise;
  }

  return {
    async recognize(image: Blob): Promise<OcrResult> {
      const pipeline = await getPipeline();
      try {
        return toResult(await pipeline.predict(image));
      } catch {
        throw new Error("ocr_predict_failed");
      }
    },
    async dispose() {
      if (!pipelinePromise) return;
      const pipeline = await pipelinePromise;
      pipelinePromise = null;
      await pipeline.dispose();
    },
  };
}
