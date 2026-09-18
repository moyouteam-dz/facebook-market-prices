import type { AppDatabase } from "./database";

const APIFY_TOKEN_KEY = "apify_token";
const GEMINI_API_KEY = "gemini_api_key";

async function getSecret(db: AppDatabase, key: string): Promise<string | null> {
  const record = await db.secret_settings.get(key);
  return record?.value ?? null;
}

async function replaceSecret(db: AppDatabase, key: string, value: string, label: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(label + " cannot be empty");
  await db.secret_settings.put({ key, value: trimmed });
}

export async function getApifyToken(db: AppDatabase): Promise<string | null> {
  return getSecret(db, APIFY_TOKEN_KEY);
}
export async function replaceApifyToken(db: AppDatabase, token: string): Promise<void> {
  return replaceSecret(db, APIFY_TOKEN_KEY, token, "Apify token");
}
export async function deleteApifyToken(db: AppDatabase): Promise<void> {
  await db.secret_settings.delete(APIFY_TOKEN_KEY);
}
export async function getGeminiApiKey(db: AppDatabase): Promise<string | null> {
  return getSecret(db, GEMINI_API_KEY);
}
export async function replaceGeminiApiKey(db: AppDatabase, apiKey: string): Promise<void> {
  return replaceSecret(db, GEMINI_API_KEY, apiKey, "Gemini API key");
}
export async function deleteGeminiApiKey(db: AppDatabase): Promise<void> {
  await db.secret_settings.delete(GEMINI_API_KEY);
}
