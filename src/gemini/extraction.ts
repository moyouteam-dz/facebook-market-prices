import { listGeminiGenerateContentModels } from "./modelSelection";
export interface GeminiEvidence {
  postText: string;
  ocrText: string;
  signal?: AbortSignal;
  images?: Array<{ mimeType: string; base64: string }>;
}

export interface GeminiPriceCandidate {
  product: string;
  normalized_product: string;
  price_min: number;
  price_max: number;
  currency: "DZD";
  confidence: "medium";
  raw_text: string;
  image_index?: number;
}

type FetchLike = typeof fetch;

function validateItem(value: unknown, rawText: string, imageCount: number): GeminiPriceCandidate | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const product = typeof item.product === "string" ? item.product.trim() : "";
  const min = Number(item.price_min);
  const max = Number(item.price_max);
  if (!product || item.currency !== "DZD" || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) return null;
  const validImageIndex = typeof item.image_index === "number" && Number.isInteger(item.image_index) && item.image_index >= 0 && item.image_index < imageCount
    ? item.image_index
    : undefined;
  return {
    product,
    normalized_product: product,
    price_min: Math.min(min, max),
    price_max: Math.max(min, max),
    currency: "DZD",
    confidence: "medium",
    raw_text: rawText,
    ...(validImageIndex !== undefined ? { image_index: validImageIndex } : {}),
  };
}

export async function extractPricesWithGemini(
  apiKey: string,
  evidence: GeminiEvidence,
  fetchImpl: FetchLike = fetch,
): Promise<GeminiPriceCandidate[]> {
  const key = apiKey.trim();
  if (!key) throw new Error("missing_gemini_key");
  const rawText = [evidence.postText.trim(), evidence.ocrText.trim()].filter(Boolean).join("\n");
  const images = evidence.images ?? [];
  if (!rawText && images.length === 0) return [];

  const models = await listGeminiGenerateContentModels(key, fetchImpl);
  if (!models.length) throw new Error("gemini_no_generate_model");

  let response: Response | null = null;
  for (const model of models) {
    response = await fetchImpl(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
      {
        method: "POST",
        signal: evidence.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: "حلل النص والصور المرفقة. استخرج فقط أسعار المنتجات الظاهرة فعليًا بالدينار الجزائري. إذا كانت الصورة لا تحتوي أسعارًا واضحة فلا تستخرج منها شيئًا. لا تخمن ولا تستنتج سعرًا غير ظاهر. إذا استخرجت سعرًا من صورة مرفقة فأعد image_index برقم الصورة ابتداءً من 0 حسب ترتيب الصور المرفقة. أعد JSON فقط.\n" + rawText },
            ...images.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.base64 } })),
          ] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  product: { type: "STRING" },
                  price_min: { type: "NUMBER" },
                  price_max: { type: "NUMBER" },
                  currency: { type: "STRING", enum: ["DZD"] },
                  ...(images.length > 0 ? { image_index: { type: "INTEGER", minimum: 0, maximum: images.length - 1 } } : {}),
                },
                required: ["product", "price_min", "price_max", "currency"],
              },
            },
          },
        }),
      },
    );
    if (response.ok) break;
    if (response.status !== 429) throw new Error("gemini_http_" + response.status);
  }
  if (!response?.ok) throw new Error("gemini_http_" + (response?.status ?? 429));
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("gemini_invalid_json"); }
  if (!Array.isArray(parsed)) throw new Error("gemini_invalid_shape");
  return parsed.map((item) => validateItem(item, rawText, images.length)).filter((item): item is GeminiPriceCandidate => Boolean(item));
}
