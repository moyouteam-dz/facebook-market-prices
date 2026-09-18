import type { AppDatabase } from "./database";

const APIFY_TOKEN_KEY = "apify_token";

export async function getApifyToken(db: AppDatabase): Promise<string | null> {
  const record = await db.secret_settings.get(APIFY_TOKEN_KEY);
  return record?.value ?? null;
}

export async function replaceApifyToken(
  db: AppDatabase,
  token: string,
): Promise<void> {
  const value = token.trim();

  if (!value) {
    throw new Error("Apify token cannot be empty");
  }

  await db.secret_settings.put({
    key: APIFY_TOKEN_KEY,
    value,
  });
}

export async function deleteApifyToken(db: AppDatabase): Promise<void> {
  await db.secret_settings.delete(APIFY_TOKEN_KEY);
}
