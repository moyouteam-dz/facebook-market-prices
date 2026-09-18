import { safeExternalHttpUrl } from "../security/externalUrl";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useReviewSession } from "../review/ReviewSessionContext";
import { validateReviewCandidate } from "../review/validation";

const confidenceLabel = {
  high: "ثقة عالية",
  medium: "ثقة متوسطة",
  low: "ثقة منخفضة",
} as const;

export default function ReviewPage() {
  const { session, updateCandidate, save } = useReviewSession();
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState("");

  if (!session || session.candidates.length === 0) {
    return (
      <section className="stack">
        <h1>مراجعة النتائج</h1>
        <div className="panel stack">
          <p className="muted">لا توجد نتائج بانتظار المراجعة.</p>
          <Link className="secondary-action link-button" to="/update">
            بدء تحديث جديد
          </Link>
        </div>
      </section>
    );
  }

  async function handleSave() {
    const invalid = session.candidates.find(
      (candidate) => candidate.accepted && !validateReviewCandidate(candidate).valid,
    );
    if (invalid) {
      const validation = validateReviewCandidate(invalid);
      setSummary(
        validation.valid
          ? ""
          : validation.reason === "product_required"
            ? "اسم المنتج مطلوب قبل الحفظ."
            : validation.reason === "invalid_range"
              ? "يجب أن يكون أدنى سعر أقل من أو يساوي أعلى سعر."
              : "تحقق من قيم الأسعار قبل الحفظ.",
      );
      return;
    }

    setSaving(true);
    setSummary("");
    try {
      const result = await save();
      setSummary(
        "تم الحفظ: " +
          result.saved +
          " · المستبعد: " +
          result.rejected +
          " · المكرر: " +
          result.duplicates,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">راجع قبل الحفظ</p>
        <h1>مراجعة النتائج</h1>
        <p className="muted">
          صحح المنتج أو السعر واستبعد أي نتيجة غير صحيحة. لن يُحفظ شيء قبل ضغط «حفظ النتائج».
        </p>
      </div>

      <div className="review-list">
        {session.candidates.map((candidate, index) => (
          <article
            className={
              "panel review-card" + (candidate.accepted ? "" : " is-rejected")
            }
            key={candidate.id}
          >
            <div className="review-card-head">
              <strong>نتيجة {index + 1}</strong>
              <span className={"confidence " + candidate.confidence}>
                {confidenceLabel[candidate.confidence]}
              </span>
            </div>

            {!candidate.accepted && (
              <p className="status-badge rejected">مستبعد</p>
            )}

            <div className="form-grid">
              <label>
                <span>المنتج</span>
                <input
                  value={candidate.product}
                  onChange={(event) =>
                    updateCandidate(candidate.id, {
                      product: event.target.value,
                      normalized_product: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>أدنى سعر</span>
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  value={candidate.price_min}
                  onChange={(event) =>
                    updateCandidate(candidate.id, {
                      price_min: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label>
                <span>أعلى سعر</span>
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  value={candidate.price_max}
                  onChange={(event) =>
                    updateCandidate(candidate.id, {
                      price_max: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>

            <dl className="review-meta">
              <div>
                <dt>السوق</dt>
                <dd>{candidate.market || "—"}</dd>
              </div>
              <div>
                <dt>المصدر</dt>
                <dd>{candidate.source_page || "—"}</dd>
              </div>
              <div>
                <dt>نوع الدليل</dt>
                <dd>
                  {candidate.source_type === "post_text"
                    ? "نص المنشور"
                    : "صورة OCR"}
                </dd>
              </div>
              <div>
                <dt>التاريخ</dt>
                <dd>
                  {candidate.post_date
                    ? new Date(candidate.post_date).toLocaleDateString("ar-DZ")
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="evidence-box">
              <span>الدليل</span>
              <p>{candidate.raw_text}</p>
              {candidate.image_url && (
                <img
                  className="review-image"
                  src={candidate.image_url}
                  alt="صورة مصدر السعر"
                  loading="lazy"
                />
              )}
              {safeExternalHttpUrl(candidate.post_url) && (
                <a
                  href={safeExternalHttpUrl(candidate.post_url) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="source-link"
                >
                  فتح المنشور
                </a>
              )}
            </div>

            {candidate.original_product.trim() !== candidate.product.trim() && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={candidate.remember_correction}
                  onChange={(event) =>
                    updateCandidate(candidate.id, {
                      remember_correction: event.target.checked,
                    })
                  }
                />
                <span>تذكر هذا التصحيح</span>
              </label>
            )}

            <button
              className={
                candidate.accepted ? "danger-action" : "secondary-action"
              }
              type="button"
              onClick={() =>
                updateCandidate(candidate.id, {
                  accepted: !candidate.accepted,
                })
              }
            >
              {candidate.accepted ? "استبعاد" : "إعادة النتيجة"}
            </button>
          </article>
        ))}
      </div>

      <div className="sticky-save">
        <button
          className="primary-action button-reset"
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "جارٍ الحفظ…" : "حفظ النتائج"}
        </button>
      </div>

      {summary && <p className="form-message success">{summary}</p>}
    </section>
  );
}
