import type { AppDatabase, ProductAliasRecord } from "../db/database";

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function aliasKey(value: string): string {
  return normalizeName(value)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase();
}

async function findAlias(
  db: AppDatabase,
  productName: string,
): Promise<ProductAliasRecord | undefined> {
  const key = aliasKey(productName);
  if (!key) return undefined;

  const aliases = await db.product_aliases.toArray();
  return aliases.find((alias) => aliasKey(alias.observed_name) === key);
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

  const existing = await findAlias(db, observed_name);
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
  const alias = await findAlias(db, observed);

  return alias?.canonical_name ?? observed;
}
