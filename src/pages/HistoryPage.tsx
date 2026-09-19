import { safeExternalHttpUrl } from "../security/externalUrl";
import { type FormEvent, useEffect, useState } from "react";
import { db, type PriceHistoryRecord } from "../db/database";
import {
  queryPriceHistory,
  type HistoryQuery,
} from "../history/historyExport";
import { groupPriceHistoryByDay } from "../history/dailyPosts";

export default function HistoryPage() {
  const [records, setRecords] = useState<PriceHistoryRecord[]>([]);
  const [filters, setFilters] = useState<HistoryQuery>({});
  const [loading, setLoading] = useState(true);

  async function reload(next = filters) {
    setLoading(true);
    try {
      setRecords(await queryPriceHistory(db, next));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload({});
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void reload(filters);
  }

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">السجل المحلي</p>
        <h1>سجل الأسعار</h1>
        <p className="muted">
          يعرض فقط النتائج التي راجعتها وحفظتها على هذا الجهاز.
        </p>
      </div>

      <form className="panel filter-grid" onSubmit={submit}>
        <label>
          <span>المنتج</span>
          <input
            value={filters.product ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                product: event.target.value,
              }))
            }
            placeholder="مثال: بطاطا"
          />
        </label>
        <label>
          <span>السوق</span>
          <input
            value={filters.market ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                market: event.target.value,
              }))
            }
            placeholder="مثال: الشلف"
          />
        </label>
        <label>
          <span>من</span>
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(event) =>
              setFilters((current) => ({ ...current, from: event.target.value }))
            }
          />
        </label>
        <label>
          <span>إلى</span>
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(event) =>
              setFilters((current) => ({ ...current, to: event.target.value }))
            }
          />
        </label>
        <button className="primary-action button-reset" type="submit">
          بحث
        </button>
      </form>

      {loading ? (
        <div className="panel">
          <p className="muted">جارٍ تحميل السجل…</p>
        </div>
      ) : records.length === 0 ? (
        <div className="panel">
          <p className="muted">لا توجد أسعار تطابق البحث.</p>
        </div>
      ) : (
        <div className="history-list">
          {groupPriceHistoryByDay(records).map((dailyPost) => (
            <article className="panel daily-price-post" key={dailyPost.date}>
              <div className="daily-price-post-head">
                <div>
                  <p className="eyebrow">منشور الأسعار اليومي</p>
                  <h2>{new Date(dailyPost.date + "T12:00:00").toLocaleDateString("ar-DZ", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}</h2>
                </div>
                <span className="daily-price-count">{dailyPost.records.length} سعر</span>
              </div>

              <div className="daily-price-list">
                {dailyPost.records.map((record) => (
                  <div className="daily-price-row" key={record.id}>
                    <div className="daily-price-product">
                      <strong>{record.product}</strong>
                      <span className="muted">{record.market}</span>
                    </div>
                    <div className="daily-price-value">
                      {record.price_min === record.price_max
                        ? record.price_min
                        : record.price_min + " – " + record.price_max}
                      <small> دج</small>
                    </div>
                    <div className="daily-price-source">
                      <span className="muted">{record.source_page}</span>
                      {safeExternalHttpUrl(record.post_url) ? (
                        <a
                          className="source-link"
                          href={safeExternalHttpUrl(record.post_url) ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                        >
                          المصدر
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
