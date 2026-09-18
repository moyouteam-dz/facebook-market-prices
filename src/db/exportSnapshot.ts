import type { AppDatabase } from "./database";

export const EXPORT_SCHEMA_VERSION = 1;

export async function buildExportSnapshot(db: AppDatabase) {
  const [settings, sources, priceHistory, productAliases, runs] =
    await Promise.all([
      db.settings.toArray(),
      db.sources.toArray(),
      db.price_history.toArray(),
      db.product_aliases.toArray(),
      db.runs.toArray(),
    ]);

  return {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    settings,
    sources,
    price_history: priceHistory,
    product_aliases: productAliases,
    runs,
  };
}
