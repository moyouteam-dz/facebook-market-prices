import { type FormEvent, useEffect, useState } from "react";
import { db, type SourceRecord } from "../db/database";
import {
  createSource,
  deleteSource,
  listSources,
  setSourceEnabled,
} from "../sources/sourceRepository";

const validationMessages: Record<string, string> = {
  invalid_url: "رابط Facebook غير صالح.",
  unsupported_host: "يجب أن يكون الرابط من facebook.com.",
  groups_not_supported: "مجموعات Facebook ليست مدعومة في النسخة الأولى.",
  missing_page: "أدخل رابط صفحة Facebook عامة.",
  name_required: "اسم المصدر مطلوب.",
  market_required: "اسم السوق مطلوب.",
};

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return validationMessages[error.message] ?? "تعذر حفظ المصدر.";
  }
  return "تعذر حفظ المصدر.";
}

export default function SettingsPage() {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [name, setName] = useState("");
  const [market, setMarket] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [message, setMessage] = useState("");

  async function reloadSources() {
    setSources(await listSources(db));
  }

  useEffect(() => {
    void reloadSources();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      await createSource(db, {
        name,
        market,
        facebook_url: facebookUrl,
      });
      setName("");
      setMarket("");
      setFacebookUrl("");
      setMessage("تمت إضافة الصفحة.");
      await reloadSources();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function handleToggle(source: SourceRecord) {
    await setSourceEnabled(db, source.id, !source.enabled);
    await reloadSources();
  }

  async function handleDelete(source: SourceRecord) {
    if (!window.confirm(`حذف المصدر «${source.name}»؟`)) {
      return;
    }

    await deleteSource(db, source.id);
    await reloadSources();
  }

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">الإعدادات المحلية</p>
        <h1>الإعدادات</h1>
      </div>

      <div className="panel stack">
        <div>
          <h2>صفحات Facebook</h2>
          <p className="muted">
            أضف الصفحات العامة التي تريد جلب أسعارها. المجموعات مؤجلة لنسخة لاحقة.
          </p>
        </div>

        <form className="stack source-form" onSubmit={handleSubmit}>
          <label>
            <span>اسم المصدر</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: سوق الجملة"
              required
            />
          </label>

          <label>
            <span>السوق</span>
            <input
              value={market}
              onChange={(event) => setMarket(event.target.value)}
              placeholder="مثال: الجزائر"
              required
            />
          </label>

          <label>
            <span>رابط صفحة Facebook</span>
            <input
              dir="ltr"
              inputMode="url"
              value={facebookUrl}
              onChange={(event) => setFacebookUrl(event.target.value)}
              placeholder="https://www.facebook.com/..."
              required
            />
          </label>

          <button className="primary-action button-reset" type="submit">
            إضافة الصفحة
          </button>
        </form>

        {message && <p className="form-message">{message}</p>}
      </div>

      <div className="panel stack">
        <h2>المصادر المحفوظة</h2>
        {sources.length === 0 ? (
          <p className="muted">لم تضف أي صفحة بعد.</p>
        ) : (
          <div className="source-list">
            {sources.map((source) => (
              <article className="source-card" key={source.id}>
                <div>
                  <strong>{source.name}</strong>
                  <p className="muted source-meta">{source.market}</p>
                  <a
                    className="source-link"
                    href={source.facebook_url}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                  >
                    {source.facebook_url}
                  </a>
                </div>
                <div className="source-actions">
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => void handleToggle(source)}
                  >
                    {source.enabled ? "تعطيل" : "تفعيل"}
                  </button>
                  <button
                    className="danger-action"
                    type="button"
                    onClick={() => void handleDelete(source)}
                  >
                    حذف
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
