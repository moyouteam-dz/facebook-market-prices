export interface OcrResult {
  text: string;
  confidence: number;
}

export interface OcrEngine {
  recognize(image: Blob): Promise<OcrResult>;
  dispose?(): Promise<void> | void;
}

export interface OcrModelConfig {
  detector: string;
  recognizer: string;
  language: "ar";
}

export const DEFAULT_ARABIC_OCR_MODELS: OcrModelConfig = {
  detector: "/models/ocr/arabic-detector.onnx",
  recognizer: "/models/ocr/arabic-recognizer.onnx",
  language: "ar",
};

export type OcrWorkerRequest =
  | { type: "recognize"; requestId: string; image: Blob }
  | { type: "cancel"; requestId: string };

export type OcrWorkerResponse =
  | {
      type: "progress";
      requestId: string;
      stage: "loading" | "detecting" | "recognizing";
    }
  | { type: "result"; requestId: string; result: OcrResult }
  | { type: "cancelled"; requestId: string }
  | { type: "error"; requestId: string; message: string };
