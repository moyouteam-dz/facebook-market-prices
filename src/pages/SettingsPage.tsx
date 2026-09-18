import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { testApifyToken } from "../apify/tokenValidation";
import {
  buildBackup,
  parseBackupJson,
  resetAllLocalData,
  restoreBackup,
  serializeBackup,
} from "../backup/backupService";
import { db, type SourceRecord } from "../db/database";
import {
  deleteApifyToken,
  getApifyToken,
  replaceApifyToken,
} from "../db/secrets";
import { buildCsvExport } from "../history/historyExport";
import {
  createSource,
  deleteSource,
  listSources,
  setSourceEnabled,
  updateSource,
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
    return validationMessages[error.message] ?? error.message;
  }
  return "حدث خطأ غير متوقع.";
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [name, setName] = useState("");
  const [market, setMarket] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [sourceMessage, setSourceMessage] = useState("");

  const [tokenInput, setTokenInput] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [tokenMessage, setTokenMessage] = useState("");
  const [testingToken, setTestingToken] = useState(false);

  const [dataMessage, setDataMessage] = useState("");

  async function reloadSources() {
    setSources(await listSources(db));
  }

  async function reloadTokenState() {
    setHasToken(Boolean(await getApifyToken(db)));
  }

  useEffect(() => {
    void reloadSources();
    void reloadTokenState();
  }, []);

  function resetSourceForm() {
    setEditingSourceId(null);
    setName("");
    setMarket("");
    setFacebookUrl("");
  }

  async function handleSourceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSourceMessage("");

    try {
      if (editingSourceId) {
        await updateSource(db, editingSourceId, {
          name,
          market,
          facebook_url: facebookUrl,
        });
        setSourceMessage("تم تعديل الصفحة.");
      } else {
        await createSource(db, {
          name,
          market,
          facebook_url: facebookUrl,
        });
        setSourceMessage("تمت إضافة الصفحة.");
      }

      resetSourceForm();
      await reloadSources();
    } catch (error) {
      setSourceMessage(errorMessage(error));
    }
  }

  function beginEdit(source: SourceRecord) {
    setEditingSourceId(source.id);
    setName(source.name);
    setMarket(source.market);
    setFacebookUrl(source.facebook_url);
    setSourceMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleToggle(source: SourceRecord) {
    await setSourceEnabled(db, source.id, !source.enabled);
    await reloadSources();
  }

  async function handleDelete(source: SourceRecord) {
    if (!window.confirm("حذف المصدر «" + source.name + "»؟")) {
      return;
    }

    await deleteSource(db, source.id);
    if (editingSourceId === source.id) {
      resetSourceForm();
    }
    await reloadSources();
  }

  async function handleTokenSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token) {
      setTokenMessage("أدخل مفتاح Apify أولًا.");
      return;
    }

    setTestingToken(true);
    setTokenMessage("جارٍ اختبار المفتاح…");

    try {
      const valid = await testApifyToken(token);
      if (!valid) {
        setTokenMessage("تعذر التحقق من المفتاح. لم يتم حفظه.");
        return;
      }

      await replaceApifyToken(db, token);
      setTokenInput("");
      setHasToken(true);
      setTokenMessage("تم التحقق من المفتاح وحفظه محليًا على هذا الجهاز.");
    } finally {
      setTestingToken(false);
    }
  }

  async function handleTokenDelete() {
    if (!window.confirm("حذف مفتاح Apify المحفوظ من هذا الجهاز؟")) {
      return;
    }
    await deleteApifyToken(db);
    setTokenInput("");
    setHasToken(false);
    setTokenMessage("تم حذف المفتاح.");
  }

  async function handleBackup() {
    const backup = await buildBackup(db);
    downloadText(
      "facebook-market-prices-backup-" +
        new Date().toISOString().slice(0, 10) +
        ".json",
      serializeBackup(backup),
      "application/json;charset=utf-8",
    );
    setDataMessage("تم إنشاء النسخة الاحتياطية بدون مفتاح Apify.");
  }

  async function handleCsv() {
    const csv = await buildCsvExport(db);
    downloadText(
      "market-prices-" + new Date().toISOString().slice(0, 10) + ".csv",
      "\ufeff" + csv,
      "text/csv;charset=utf-8",
    );
    setDataMessage("تم تصدير سجل الأسعار إلى CSV.");
  }

  async function handleRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setDataMessage("جارٍ فحص النسخة الاحتياطية…");

    try {
      const backup = parseBackupJson(await file.text());
      const result = await restoreBackup(db, backup);
      await reloadSources();
      setDataMessage(
        "تم الاسترجاع: " +
          result.restored_history +
          " سعر جديد، " +
          result.duplicate_history +
          " مكرر تم تجاهله.",
      );
    } catch (error) {
      setDataMessage("تعذر الاسترجاع: " + errorMessage(error));
    }
  }

  async function handleReset() {
    if (
      !window.confirm(
        "سيتم حذف الأسعار والمصادر والتصحيحات ومفتاح Apify من هذا الجهاز. هل تريد المتابعة؟",
      )
    ) {
      return;
    }

    await resetAllLocalData(db);
    resetSourceForm();
    setSources([]);
    setHasToken(false);
    setTokenInput("");
    setDataMessage("تم حذف كل البيانات المحلية.");
  }

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">الإعدادات المحلية</p>
        <h1>الإعدادات</h1>
        <p className="muted">
          بياناتك تبقى على هذا الجهاز. لا تضع مفتاح Apify في GitHub أو داخل رابط.
        </p>
      </div>

      <div className="panel stack">
        <div>
          <h2>مفتاح Apify</h2>
          <p className="muted">
            {hasToken
              ? "يوجد مفتاح محفوظ محليًا. لا نعرض قيمته مرة أخرى."
              : "لا يوجد مفتاح محفوظ على هذا الجهاز."}
          </p>
        </div>

        <form className="stack source-form" onSubmit={handleTokenSave}>
          <label>
            <span>{hasToken ? "استبدال المفتاح" : "المفتاح"}</span>
            <input
              dir="ltr"
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="apify_api_..."
            />
          </label>
          <button
            className="primary-action button-reset"
            type="submit"
            disabled={testingToken}
          >
            {testingToken ? "جارٍ الاختبار…" : "اختبار وحفظ المفتاح"}
          </button>
        </form>

        {hasToken && (
          <button
            className="danger-action"
            type="button"
            onClick={() => void handleTokenDelete()}
          >
            حذف المفتاح
          </button>
        )}
        {tokenMessage && <p className="form-message">{tokenMessage}</p>}
      </div>

      <div className="panel stack">
        <div>
          <h2>صفحات Facebook</h2>
          <p className="muted">
            أضف الصفحات العامة التي تريد جلب أسعارها. المجموعات مؤجلة لنسخة لاحقة.
          </p>
        </div>

        <form className="stack source-form" onSubmit={handleSourceSubmit}>
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

          <div className="source-actions">
            <button className="primary-action button-reset" type="submit">
              {editingSourceId ? "حفظ التعديل" : "إضافة الصفحة"}
            </button>
            {editingSourceId && (
              <button
                className="secondary-action"
                type="button"
                onClick={resetSourceForm}
              >
                إلغاء
              </button>
            )}
          </div>
        </form>

        {sourceMessage && <p className="form-message">{sourceMessage}</p>}
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
                  <div className="source-title-line">
                    <strong>{source.name}</strong>
                    <span
                      className={
                        "status-badge " + (source.enabled ? "enabled" : "disabled")
                      }
                    >
                      {source.enabled ? "مفعّل" : "متوقف"}
                    </span>
                  </div>
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
                    onClick={() => beginEdit(source)}
                  >
                    تعديل
                  </button>
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

      <div className="panel stack">
        <div>
          <h2>البيانات والنسخ الاحتياطي</h2>
          <p className="muted">
            النسخة الاحتياطية تشمل التاريخ والمصادر والتصحيحات، ولا تشمل مفتاح Apify.
          </p>
        </div>

        <div className="data-actions">
          <button
            className="secondary-action"
            type="button"
            onClick={() => void handleBackup()}
          >
            إنشاء نسخة احتياطية
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={() => void handleCsv()}
          >
            تصدير CSV
          </button>
          <label className="secondary-action file-action">
            استرجاع نسخة
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleRestore(event)}
            />
          </label>
        </div>

        {dataMessage && <p className="form-message">{dataMessage}</p>}

        <div className="danger-zone">
          <strong>منطقة الحذف</strong>
          <p className="muted">
            هذا يحذف كل بيانات التطبيق المحلية من الجهاز، بما فيها مفتاح Apify.
          </p>
          <button
            className="danger-action"
            type="button"
            onClick={() => void handleReset()}
          >
            حذف كل البيانات المحلية
          </button>
        </div>
      </div>
    </section>
  );
}
