import type { AppDatabase } from "../db/database";
const KEY = "gemini_fallback_enabled";
export async function getGeminiFallbackEnabled(db: AppDatabase): Promise<boolean> {
  return (await db.settings.get(KEY))?.value === true;
}
export async function setGeminiFallbackEnabled(db: AppDatabase, enabled: boolean): Promise<void> {
  await db.settings.put({ key: KEY, value: enabled });
}
