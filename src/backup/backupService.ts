import {
  type AppDatabase,
  type AppSetting,
  type PriceHistoryRecord,
  type ProductAliasRecord,
  type RunRecord,
  type SourceRecord,
} from "../db/database";
import {
  buildExportSnapshot,
  EXPORT_SCHEMA_VERSION,
} from "../db/exportSnapshot";

export interface BackupDocument {
  schema_version: number;
  exported_at: string;
  settings: AppSetting[];
  sources: SourceRecord[];
  price_history: PriceHistoryRecord[];
  product_aliases: ProductAliasRecord[];
  runs: RunRecord[];
}

export interface RestoreSummary {
  restored_settings: number;
  restored_sources: number;
  restored_history: number;
  duplicate_history: number;
  restored_aliases: number;
  restored_runs: number;
}

export class BackupValidationError extends Error {
  constructor(message = "invalid_backup") {
    super(message);
    this.name = "BackupValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateBackup(value: unknown): asserts value is BackupDocument {
  if (!isRecord(value) || value.schema_version !== EXPORT_SCHEMA_VERSION) {
    throw new BackupValidationError("unsupported_backup_schema");
  }

  for (const key of [
    "settings",
    "sources",
    "price_history",
    "product_aliases",
    "runs",
  ] as const) {
    if (!Array.isArray(value[key])) {
      throw new BackupValidationError("invalid_backup_shape");
    }
  }
}

export async function buildBackup(db: AppDatabase): Promise<BackupDocument> {
  return buildExportSnapshot(db) as Promise<BackupDocument>;
}

export async function restoreBackup(
  db: AppDatabase,
  rawBackup: unknown,
): Promise<RestoreSummary> {
  validateBackup(rawBackup);
  const backup = rawBackup;

  let restoredHistory = 0;
  let duplicateHistory = 0;

  await db.transaction(
    "rw",
    db.settings,
    db.sources,
    db.price_history,
    db.product_aliases,
    db.runs,
    async () => {
      if (backup.settings.length) {
        await db.settings.bulkPut(backup.settings);
      }
      if (backup.sources.length) {
        await db.sources.bulkPut(backup.sources);
      }
      if (backup.product_aliases.length) {
        await db.product_aliases.bulkPut(backup.product_aliases);
      }
      if (backup.runs.length) {
        await db.runs.bulkPut(backup.runs);
      }

      for (const record of backup.price_history) {
        const exists = await db.price_history
          .where("fingerprint")
          .equals(record.fingerprint)
          .first();

        if (exists) {
          duplicateHistory += 1;
          continue;
        }

        await db.price_history.put(record);
        restoredHistory += 1;
      }
    },
  );

  return {
    restored_settings: backup.settings.length,
    restored_sources: backup.sources.length,
    restored_history: restoredHistory,
    duplicate_history: duplicateHistory,
    restored_aliases: backup.product_aliases.length,
    restored_runs: backup.runs.length,
  };
}

export function serializeBackup(backup: BackupDocument): string {
  validateBackup(backup);
  return JSON.stringify(backup, null, 2);
}

export function parseBackupJson(json: string): BackupDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupValidationError("invalid_backup_json");
  }
  validateBackup(parsed);
  return parsed;
}


export async function resetAllLocalData(db: AppDatabase): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.secret_settings,
      db.settings,
      db.sources,
      db.price_history,
      db.product_aliases,
      db.runs,
    ],
    async () => {
      await Promise.all([
        db.secret_settings.clear(),
        db.settings.clear(),
        db.sources.clear(),
        db.price_history.clear(),
        db.product_aliases.clear(),
        db.runs.clear(),
      ]);
    },
  );
}
