"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { RequireAuth, TopBar } from "@/components/AppChrome";
import { NewSpaceModal, type SavedTemplate } from "@/components/spaces/NewSpaceModal";
import { supabase } from "@/lib/supabase";
import { templateFor } from "@/lib/spaces";
import { templateSummary } from "@/lib/space-templates";
import { moduleDef } from "@/lib/spaces";

type Shared = SavedTemplate & { mine: boolean; is_public: boolean };

function TemplateInner({ code }: { code: string }) {
  const [tpl, setTpl] = useState<Shared | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    supabase()
      .rpc("get_template_by_code", { p_code: code })
      .then(({ data }) => setTpl((data as Shared) ?? null));
  }, [code]);

  if (tpl === undefined) return <div className="auth-wrap"><Loader2 className="spin" /></div>;
  if (!tpl) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: "center", padding: "2rem" }}>
          <h2>Template not found</h2>
          <p className="muted" style={{ margin: "0.6rem 0 1rem" }}>The link may be wrong, or its owner deleted it.</p>
          <Link className="btn btn-primary" href="/trips">Go to Driftbook</Link>
        </div>
      </div>
    );
  }
  const kind = templateFor(tpl.kind);
  const modules = (tpl.data.modules?.length ? tpl.data.modules : kind.modules).map((m) => m.label || kind.modules.find((x) => x.id === m.id)?.label || moduleDef(m.id)?.label).filter(Boolean);
  const topPages = tpl.data.pages.filter((p) => !p.parent_id);
  return (
    <main className="main main-narrow" style={{ maxWidth: 720 }}>
      <div className="card stack" style={{ padding: 0, overflow: "hidden", gap: 0 }}>
        <div className="template-hero" style={{ background: kind.gradient }}>
          <span aria-hidden>{tpl.icon}</span>
        </div>
        <div className="stack" style={{ padding: "1.2rem 1.4rem 1.4rem", gap: "0.9rem" }}>
          <div>
            <p className="tiny muted row" style={{ gap: 6 }}><Sparkles size={13} /> {kind.name} template · by {tpl.owner_name}{tpl.use_count ? ` · used ${tpl.use_count}×` : ""}</p>
            <h1 style={{ marginTop: 4 }}>{tpl.name}</h1>
            {tpl.description && <p className="muted" style={{ marginTop: 6 }}>{tpl.description}</p>}
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <strong className="small">What&apos;s inside ({templateSummary(tpl.data)})</strong>
            <div className="chip-row">{modules.map((m) => <span key={m} className="chip chip-muted">{m}</span>)}</div>
            {tpl.data.lists.length > 0 && (
              <div className="chip-row">
                {tpl.data.lists.map((l) => (
                  <span key={l.id} className="chip">
                    {l.icon} {l.name}
                    {tpl.data.items.length > 0 && <span className="muted"> · {tpl.data.items.filter((i) => i.list_id === l.id).length}</span>}
                  </span>
                ))}
              </div>
            )}
            {topPages.length > 0 && (
              <div className="chip-row">{topPages.map((p) => <span key={p.id} className="chip chip-2"><FileText size={12} /> {p.icon} {p.title || "Untitled"}</span>)}</div>
            )}
            <p className="tiny muted">You get your own copy to change however you like. It never includes the original people, payments or private notes.</p>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setOpen(true)}><Sparkles size={16} /> Use this template</button>
            {tpl.mine && <Link className="btn" href="/settings#templates">Manage</Link>}
          </div>
        </div>
      </div>
      <NewSpaceModal open={open} onClose={() => setOpen(false)} startWith={tpl} />
    </main>
  );
}

export default function TemplatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <RequireAuth>
      <TopBar />
      <TemplateInner code={code} />
    </RequireAuth>
  );
}
