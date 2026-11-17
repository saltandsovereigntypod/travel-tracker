import Link from "next/link";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="landing" style={{ maxWidth: 760 }}>
      <nav className="landing-nav">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="brand-mark" />
          Driftbook
        </Link>
      </nav>
      <article className="card legal" style={{ marginTop: "2rem", padding: "2rem" }}>
        <h1>{title}</h1>
        <p className="muted small" style={{ margin: "0.4rem 0 1.4rem" }}>Last updated {updated}</p>
        {children}
      </article>
      <p className="tiny muted" style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
      </p>
    </div>
  );
}
