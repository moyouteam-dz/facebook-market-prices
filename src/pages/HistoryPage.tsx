import { type FormEvent, useEffect, useState } from "react";
import { db, type PriceHistoryRecord } from "../db/database";
import {
  queryPriceHistory,
  type HistoryQuery,
} from "../history/historyExport";
import { formatDailyPricePostForPublishing, groupPriceHistoryByDay } from "../history/dailyPosts";
import { safeExternalHttpUrl } from "../security/externalUrl";

export default function HistoryPage() {
  const [records, setRecords] = useState<PriceHistoryRecord[]>([]);
  const [filters, setFilters] = useState<HistoryQuery>({});
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set());
  const [copiedDate, setCopiedDate] = useState<string | null>(null);

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
                <span className="daily-price-count">{dailyPost.products.length} منتج</span>
              </div>

              <div className="daily-price-list">
                {dailyPost.markets.map((market) => (
                  <section className="daily-market-section" key={market.market}>
                    <h3>سوق {market.market}</h3>
                    {market.products.map((product) => (
                      <div
                        className="daily-price-row"
                        key={market.market + "|" + product.normalized_product}
                      >
                        <div className="daily-price-product">
                          <strong>{product.product}</strong>
                        </div>
                        <div className="daily-price-value">
                          {product.price_min === product.price_max
                            ? product.price_min
                            : product.price_min + " – " + product.price_max}
                          <small> دج</small>
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>

              <div className="daily-price-actions">
                <button
                  type="button"
                  className="daily-price-copy button-reset"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      formatDailyPricePostForPublishing(dailyPost),
                    );
                    setCopiedDate(dailyPost.date);
                  }}
                >
                  {copiedDate === dailyPost.date ? "تم النسخ" : "نسخ المنشور"}
                </button>

              <button
                type="button"
                className="daily-price-details-toggle button-reset"
                aria-expanded={expandedDates.has(dailyPost.date)}
                onClick={() =>
                  setExpandedDates((current) => {
                    const next = new Set(current);
                    if (next.has(dailyPost.date)) {
                      next.delete(dailyPost.date);
                    } else {
                      next.add(dailyPost.date);
                    }
                    return next;
                  })
                }
              >
                {expandedDates.has(dailyPost.date)
                  ? "إخفاء التفاصيل"
                  : "عرض التفاصيل والمصادر"}
              </button>

              </div>

              {expandedDates.has(dailyPost.date) ? (
                <div className="daily-price-details">
                  {dailyPost.markets.map((market) => (
                    <section className="daily-market-details" key={market.market}>
                      <h3>سوق {market.market}</h3>
                      {market.products.map((product) => (
                        <section
                          className="daily-product-details"
                          key={market.market + "|" + product.normalized_product}
                        >
                          <div className="daily-product-details-head">
                            <strong>{product.product}</strong>
                            <span className="muted">
                              {product.source_count === 1
                                ? "مصدر واحد"
                                : product.source_count === 2
                                  ? "مصدران"
                                  : product.source_count + " مصادر"}
                              {product.excluded_outlier_count > 0
                                ? " · استُبعدت " + product.excluded_outlier_count + " قيمة شاذة من النطاق"
                                : ""}
                            </span>
                          </div>
                          <div className="daily-source-list">
                            {product.records.map((record) => {
                              const sourceUrl = safeExternalHttpUrl(record.post_url);
                              return (
                                <div className="daily-source-item" key={record.id}>
                                  <span>{record.source_page}</span>
                                  {sourceUrl ? (
                                    <a
                                      className="source-link"
                                      href={sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      المصدر
                                    </a>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </section>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
