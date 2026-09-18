export interface GeminiEvidence {
  postText: string;
  ocrText: string;
  signal?: AbortSignal;
}

export interface GeminiPriceCandidate {
  product: string;
  normalized_product: string;
  price_min: number;
  price_max: number;
  currency: "DZD";
  confidence: "medium";
  raw_text: string;
}

type FetchLike = typeof fetch;
const MODEL = "gemini-2.5-flash";

function validateItem(value: unknown, rawText: string): GeminiPriceCandidate | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const product = typeof item.product === "string" ? item.product.trim() : "";
  const min = Number(item.price_min);
  const max = Number(item.price_max);
  if (!product || item.currency !== "DZD" || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) return null;
  return {
    product,
    normalized_product: product,
    price_min: Math.min(min, max),
    price_max: Math.max(min, max),
    currency: "DZD",
    confidence: "medium",
    raw_text: rawText,
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
  if (!rawText) return [];

  const response = await fetchImpl(
    "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
    {
      method: "POST",
      signal: evidence.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "استخرج فقط أسعار المنتجات بالدينار الجزائري من النص التالي. لا تخمن. أعد JSON فقط.\n" + rawText }] }],
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
              },
              required: ["product", "price_min", "price_max", "currency"],
            },
          },
        },
      }),
    },
  );
  if (!response.ok) throw new Error("gemini_request_failed");
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("gemini_invalid_json"); }
  if (!Array.isArray(parsed)) throw new Error("gemini_invalid_shape");
  return parsed.map((item) => validateItem(item, rawText)).filter((item): item is GeminiPriceCandidate => Boolean(item));
}
