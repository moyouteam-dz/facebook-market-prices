import type { AppDatabase } from "../db/database";

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export async function rememberProductAlias(
  db: AppDatabase,
  observedName: string,
  canonicalName: string,
): Promise<void> {
  const observed_name = normalizeName(observedName);
  const canonical_name = normalizeName(canonicalName);

  if (!observed_name || !canonical_name) {
    throw new Error("alias_name_required");
  }

  const existing = await db.product_aliases
    .where("observed_name")
    .equals(observed_name)
    .first();
  const now = new Date().toISOString();

  await db.product_aliases.put({
    id: existing?.id ?? crypto.randomUUID(),
    observed_name,
    canonical_name,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });
}

export async function applyProductAlias(
  db: AppDatabase,
  productName: string,
): Promise<string> {
  const observed = normalizeName(productName);
  const alias = await db.product_aliases
    .where("observed_name")
    .equals(observed)
    .first();

  return alias?.canonical_name ?? observed;
}
