import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <section className="stack">
      <div className="hero-card">
        <p className="eyebrow">متابعة الأسعار من هاتفك</p>
        <h1>أسعار الأسواق</h1>
        <p className="muted">
          اجلب منشورات الصفحات العامة، راجع الأسعار المستخرجة، ثم احفظ ما تؤكده فقط.
        </p>
        <Link className="primary-action" to="/update">
          تحديث الأسعار الآن
        </Link>
      </div>
      <div className="panel">
        <h2>آخر الأسعار</h2>
        <p className="muted">لا توجد أسعار محفوظة بعد.</p>
      </div>
    </section>
  );
}
