import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  normalizeApifyFacebookItem,
  runFacebookPostsActor,
  type NormalizedFacebookPost,
} from "../apify/apifyAdapter";
import { db as defaultDb, type AppDatabase } from "../db/database";
import { getApifyToken } from "../db/secrets";
import { createArabicPaddleOcrEngine } from "../ocr/paddleOcrEngine";
import type { OcrEngine } from "../ocr/types";
import {
  runManualRefresh,
  type RefreshProgressEvent,
  type RefreshSource,
} from "../refresh/manualRefresh";
import { useReviewSession, type ReviewSession } from "../review/ReviewSessionContext";
import { listSources } from "../sources/sourceRepository";

type Collector = (
  token: string,
  sources: RefreshSource[],
  signal?: AbortSignal,
) => Promise<NormalizedFacebookPost[]>;

interface UpdatePageProps {
  database?: AppDatabase;
  collectPosts?: Collector;
  createOcrEngine?: () => OcrEngine;
  setReviewSession?: (session: ReviewSession) => void;
  navigate?: (path: string) => void;
}

const defaultCollector: Collector = async (token, sources, signal) => {
  const raw = await runFacebookPostsActor({
    token,
    pageUrls: sources.map((source) => source.facebook_url),
    resultsLimit: 5,
    onlyPostsNewerThan: "7 days",
    signal,
  });

  return raw.map((item) => {
    const inputUrl =
      typeof item === "object" && item !== null && "inputUrl" in item
        ? String((item as { inputUrl?: unknown }).inputUrl ?? "")
        : "";
    const source =
      sources.find((candidate) => candidate.facebook_url === inputUrl) ??
      sources[0];

    return normalizeApifyFacebookItem(item, {
      sourceId: source?.id ?? "unknown",
      market: source?.market ?? "",
    });
  });
};

async function fetchImage(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("image_download_failed");
  return response.blob();
}

function progressLabel(progress: RefreshProgressEvent | null) {
  if (!progress) return "";
  const count =
    progress.total === undefined
      ? ""
      : ` (${progress.completed ?? 0}/${progress.total})`;
  if (progress.stage === "collecting") return "جارٍ جلب المنشورات…";
  if (progress.stage === "parsing") return "جارٍ تحليل النصوص…" + count;
  if (progress.stage === "ocr") return "جارٍ قراءة الصور محليًا…" + count;
  return "النتائج جاهزة للمراجعة.";
}

export default function UpdatePage({
  database = defaultDb,
  collectPosts = defaultCollector,
  createOcrEngine = createArabicPaddleOcrEngine,
  setReviewSession,
  navigate,
}: UpdatePageProps) {
  const routerNavigate = useNavigate();
  const review = useReviewSession();
  const [sources, setSources] = useState<RefreshSource[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<RefreshProgressEvent | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    listSources(database)
      .then((records) => {
        if (!alive) return;
        const enabled = records.filter((source) => source.enabled);
        setSources(enabled);
        setSelected(new Set(enabled.map((source) => source.id)));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [database]);

  const selectedSources = useMemo(
    () => sources.filter((source) => selected.has(source.id)),
    [selected, sources],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function start() {
    setMessage("");
    if (selectedSources.length === 0) {
      setMessage("اختر صفحة واحدة على الأقل.");
      return;
    }

    const token = await getApifyToken(database);
    if (!token) {
      setMessage("أدخل مفتاح Apify أولًا من الإعدادات.");
      return;
    }

    const abortController = new AbortController();
    const ocrEngine = createOcrEngine();
    setController(abortController);
    setRunning(true);
    try {
      const result = await runManualRefresh({
        db: database,
        token,
        sources: selectedSources,
        collectPosts,
        fetchImage,
        ocrEngine,
        signal: abortController.signal,
        onProgress: setProgress,
      });

      const candidates = result.candidates.map((candidate) => ({
        ...candidate,
        original_product: candidate.product,
        accepted: true,
        remember_correction: false,
      }));
      const session = { runId: result.runId, candidates };
      (setReviewSession ?? review.setSession)(session);
      setMessage(`تم العثور على ${candidates.length} نتيجة. سيتم فتح المراجعة.`);
      (navigate ?? routerNavigate)("/review");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("تم إلغاء التحديث.");
      } else {
        setMessage("تعذر إكمال التحديث. تحقق من الاتصال وإعدادات Apify ثم أعد المحاولة.");
      }
    } finally {
      await ocrEngine.dispose?.();
      setRunning(false);
      setController(null);
    }
  }

  return (
    <section className="stack">
      <div>
        <p className="eyebrow">تحديث يدوي فقط</p>
        <h1>تحديث الأسعار</h1>
        <p className="muted">
          اختر الصفحات ثم ابدأ. الصور تُقرأ محليًا على جهازك قبل إرسال النتائج للمراجعة.
        </p>
      </div>

      <div className="panel stack">
        <h2>الصفحات المفعلة</h2>
        {loading ? (
          <p className="muted">جارٍ تحميل الصفحات…</p>
        ) : sources.length === 0 ? (
          <p className="muted">لا توجد صفحات مفعلة. أضفها من الإعدادات أولًا.</p>
        ) : (
          sources.map((source) => (
            <label className="check-row" key={source.id}>
              <input
                type="checkbox"
                checked={selected.has(source.id)}
                onChange={() => toggle(source.id)}
                aria-label={source.name}
              />
              <span>
                <strong>{source.name}</strong>
                <small className="muted"> · {source.market}</small>
              </span>
            </label>
          ))
        )}
      </div>

      {progress && <p className="form-message">{progressLabel(progress)}</p>}
      {message && <p className="form-message">{message}</p>}

      <button
        className="primary-action button-reset"
        type="button"
        disabled={running || loading}
        onClick={() => void start()}
      >
        {running ? "جارٍ التحديث…" : "بدء التحديث"}
      </button>

      {running && (
        <button
          className="secondary-action button-reset"
          type="button"
          onClick={() => controller?.abort()}
        >
          إلغاء
        </button>
      )}
    </section>
  );
}
