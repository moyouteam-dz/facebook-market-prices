import Dexie, { type Table } from "dexie";

export interface SecretSetting {
  key: string;
  value: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

export interface SourceRecord {
  id: string;
  name: string;
  market: string;
  facebook_url: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryRecord {
  id: string;
  product: string;
  normalized_product: string;
  price_min: number;
  price_max: number;
  currency: "DZD";
  market: string;
  source_id: string;
  source_page: string;
  post_id: string;
  post_url: string;
  source_type: "post_text" | "image_ocr";
  raw_text: string;
  image_url?: string;
  post_date: string;
  scraped_at: string;
  reviewed_at: string;
  confidence: "high" | "medium" | "low";
  fingerprint: string;
}

export interface ProductAliasRecord {
  id: string;
  observed_name: string;
  canonical_name: string;
  created_at: string;
  updated_at: string;
}

export interface RunRecord {
  id: string;
  started_at: string;
  finished_at?: string;
  selected_sources: string[];
  posts_received: number;
  images_processed: number;
  candidates_found: number;
  candidates_saved: number;
  candidates_rejected: number;
  errors: string[];
}

export class AppDatabase extends Dexie {
  secret_settings!: Table<SecretSetting, string>;
  settings!: Table<AppSetting, string>;
  sources!: Table<SourceRecord, string>;
  price_history!: Table<PriceHistoryRecord, string>;
  product_aliases!: Table<ProductAliasRecord, string>;
  runs!: Table<RunRecord, string>;

  constructor(name = "facebook-market-prices") {
    super(name);

    this.version(1).stores({
      secret_settings: "&key",
      settings: "&key",
      sources: "&id, enabled, market, updated_at",
      price_history:
        "&id, &fingerprint, normalized_product, source_id, market, post_date, reviewed_at",
      product_aliases: "&id, &observed_name, canonical_name, updated_at",
      runs: "&id, started_at, finished_at",
    });
  }
}

export function createAppDatabase(name?: string) {
  return new AppDatabase(name);
}

export const db = createAppDatabase();
