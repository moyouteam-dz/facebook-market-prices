import * as ort from "onnxruntime-web";
import {
  DEFAULT_ARABIC_OCR_MODELS,
  type OcrModelConfig,
} from "./types";

export interface PaddleOcrSessions {
  detector: ort.InferenceSession;
  recognizer: ort.InferenceSession;
}

export async function loadPaddleOcrSessions(
  config: OcrModelConfig = DEFAULT_ARABIC_OCR_MODELS,
): Promise<PaddleOcrSessions> {
  const sessionOptions: ort.InferenceSession.SessionOptions = {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  };

  const [detector, recognizer] = await Promise.all([
    ort.InferenceSession.create(config.detector, sessionOptions),
    ort.InferenceSession.create(config.recognizer, sessionOptions),
  ]);

  return { detector, recognizer };
}

/**
 * This module intentionally stops at the ONNX session boundary.
 * Detector preprocessing/postprocessing, crop generation, Arabic recognition
 * decoding and phone-specific model selection are benchmark-gated before the
 * production engine is enabled.
 */
