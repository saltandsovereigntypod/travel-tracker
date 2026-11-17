"use client";

import { useState } from "react";
import Link from "next/link";
import { FilePlus2, FileText, Loader2 } from "lucide-react";
import { useTrip } from "../TripProvider";
import { EmptyState } from "../ui/Fields";
import { Modal } from "../ui/Modal";
import { useCreatePage } from "./usePageDoc";
import { childPages, pageText } from "@/lib/pages";
import { PAGE_TEMPLATES } from "@/lib/page-templates";
import { timeAgo } from "@/lib/format";

/** Pick a page template (meeting notes, run of show…) or a blank page. */
export function NewPageModal({ open, onClose, parentId = null }: { open: boolean; onClose: () => void; parentId?: string | null }) {
  const createPage = useCreatePage();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <Modal open={open} onClose={onClose} title="New page" size="lg">
      <p className="muted small" style={{ marginBottom: "0.9rem" }}>
        Pages are shared docs for anything: notes, plans, outlines, guides. Drop in live lists, items and to-dos with dates and
        people, and they show up on everyone&apos;s Today and calendar.
      </p>
      <div className="template-grid">
        {PAGE_TEMPLATES.map((t) => (
          <button
            key={t.key}
            className="template-card"
            disabled={!!busy}
            onClick={async () => {
              setBusy(t.key);
              await createPage(parentId, { icon: t.icon, title: t.key === "blank" ? "" : t.name, blocks: t.blocks() });
              setBusy(null);
              onClose();
            }}
          >
            <span className="template-art" style={{ background: "var(--soft2)", height: 64 }}>{busy === t.key ? <Loader2 className="spin" /> : t.icon}</span>
            <strong>{t.name}</strong>
            <span className="small muted">{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function PagesIndex() {
  const { rows, canEdit, tripId, loading, nameOf } = useTrip();
  const [newOpen, setNewOpen] = useState(false);
  const top = childPages(rows.pages, null);
  if (loading) return null;
  return (
    <div>
      <div className="section-head">
        <div>
          <h1 className="row" style={{ gap: "0.6rem" }}><FileText /> Pages</h1>
          <p>Shared docs for notes, plans and anything else. Everyone in this space can read them{canEdit ? " and edit them" : ""}.</p>
        </div>
        {canEdit && (
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setNewOpen(true)}><FilePlus2 size={16} /> New page</button>
          </div>
        )}
      </div>
      {top.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileText />} title="No pages yet">
            {canEdit ? "Start one for meeting notes, a run of show, an episode outline, a house guide… anything." : "Nobody has written a page here yet."}
          </EmptyState>
        </div>
      ) : (
        <div className="page-cards">
          {top.map((p) => {
            const kids = childPages(rows.pages, p.id).length;
            return (
              <Link key={p.id} href={`/trips/${tripId}/pages/${p.id}`} className="card page-card">
                <div className="page-card-top" style={p.cover.startsWith("linear-gradient") ? { background: p.cover } : undefined}>
                  <span className="page-card-icon" aria-hidden>{p.icon}</span>
                </div>
                <strong className="truncate">{p.title || "Untitled"}</strong>
                <span className="small muted page-card-text">{pageText(p) || "Empty page"}</span>
                <span className="tiny muted">
                  {timeAgo(p.updated_at)}{p.updated_by && ` · ${nameOf(p.updated_by)}`}{kids > 0 && ` · ${kids} inside`}
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <NewPageModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
