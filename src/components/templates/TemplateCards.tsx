"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Globe, Loader2, Lock, Sparkles, Trash2 } from "lucide-react";
import { useTrip } from "../TripProvider";
import { useAuth } from "../AuthProvider";
import { useToast } from "../ui/Toast";
import { Field } from "../ui/Fields";
import { friendlyError, supabase } from "@/lib/supabase";
import { finalizeSnapshot, snapshotSpace, templateSummary, type SpaceTemplateRow } from "@/lib/space-templates";
import { timeAgo } from "@/lib/format";

export const templateLink = (code: string) => `${typeof location === "undefined" ? "" : location.origin}/templates/${code}`;

async function copy(text: string, toast: ReturnType<typeof useToast>, msg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  } catch {
    window.prompt("Copy this link:", text);
  }
}

/** In a space's settings: save its setup as a reusable, shareable template. */
export function SaveTemplateCard() {
  const { trip, rows, view, noun } = useTrip();
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [opts, setOpts] = useState({ items: true, pages: true, dates: false, design: true });
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SpaceTemplateRow | null>(null);
  if (!trip) return null;

  const counts = {
    lists: rows.lists.length,
    items: rows.list_items.length,
    pages: rows.pages.length,
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!trip || !user) return;
    setBusy(true);
    const data = finalizeSnapshot(
      snapshotSpace(trip, { lists: rows.lists, list_items: rows.list_items, pages: rows.pages }, opts, {
        theme: view.theme,
        page_layout: view.page_layout,
        board_layout: view.board_layout,
        mode: view.mode,
      }),
    );
    const { data: row, error } = await supabase()
      .from("space_templates")
      .insert({ owner_id: user.id, name: name.trim() || trip.name, description: description.trim(), icon: trip.icon || "✨", kind: trip.kind ?? "blank", data, is_public: isPublic })
      .select()
      .single();
    setBusy(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    setSaved(row as SpaceTemplateRow);
    toast.success("Template saved. It's in “Yours” when you start something new.");
  }

  const check = (k: keyof typeof opts, label: React.ReactNode, disabled = false) => (
    <label className="row small" style={{ gap: 8, opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={opts[k] && !disabled} disabled={disabled} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} />
      <span>{label}</span>
    </label>
  );

  return (
    <form className="card stack" onSubmit={save}>
      <div>
        <h3 className="row"><Sparkles size={18} /> Save as template</h3>
        <p className="muted small" style={{ marginTop: 4 }}>
          Reuse this {noun}&apos;s setup (features, lists and their fields, pages and your design) to start new ones in one tap, or share it.
          People, payments, comments and photos are never included.
        </p>
      </div>
      {saved ? (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small">
            <strong>{saved.name}</strong> is saved ({templateSummary(saved.data)}). Anyone with the link can start their own copy.
          </p>
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => void copy(templateLink(saved.share_code), toast, "Link copied")}><Copy size={15} /> Copy share link</button>
            <Link className="btn" href="/settings#templates">Manage templates</Link>
            <button type="button" className="btn btn-ghost" onClick={() => setSaved(null)}>Save another</button>
          </div>
        </div>
      ) : (
        <>
          <div className="form-grid">
            <Field label="Template name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={trip.name} maxLength={120} />
            </Field>
            <Field label="Short description (optional)">
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it's good for" maxLength={600} />
            </Field>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="small muted">Always included: features and their names, and {counts.lists} list{counts.lists === 1 ? "" : "s"} with their fields.</span>
            {check("items", <>The items in those lists ({counts.items})</>, counts.items === 0)}
            {check("pages", <>Pages ({counts.pages})</>, counts.pages === 0)}
            {check("dates", <>Keep dates on items and to-dos <span className="muted">(off: dates are cleared so they fit any calendar)</span></>, !opts.items && !opts.pages)}
            {check("design", <>My design for this {noun} (theme and layout)</>)}
          </div>
          <label className="row small" style={{ gap: 8 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <span>Publish to the community so anyone on Driftbook can use it</span>
          </label>
          <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} Save template
          </button>
        </>
      )}
    </form>
  );
}

/** In account settings: your templates, with sharing and publishing. */
export function MyTemplatesCard() {
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<SpaceTemplateRow[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase().from("space_templates").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false });
    setList((data as SpaceTemplateRow[]) ?? []);
  }, [user]);
  useEffect(() => {
    void load();
  }, [load]);

  async function patch(t: SpaceTemplateRow, p: Partial<SpaceTemplateRow>) {
    setList((l) => l?.map((x) => (x.id === t.id ? { ...x, ...p } : x)) ?? null);
    const { error } = await supabase().from("space_templates").update(p).eq("id", t.id);
    if (error) {
      toast.error(friendlyError(error));
      void load();
    }
  }
  async function del(t: SpaceTemplateRow) {
    if (!window.confirm(`Delete the template “${t.name}”? Spaces already made from it aren't affected.`)) return;
    const { error } = await supabase().from("space_templates").delete().eq("id", t.id);
    if (error) toast.error(friendlyError(error));
    else setList((l) => l?.filter((x) => x.id !== t.id) ?? null);
  }

  return (
    <div className="card stack" id="templates">
      <div>
        <h3 className="row"><Sparkles size={18} /> Your templates</h3>
        <p className="muted small" style={{ marginTop: 4 }}>
          Save any space as a template from its settings. Share a private link with anyone, or publish it so everyone can find it under
          Community when they start something new.
        </p>
      </div>
      {!list ? (
        <Loader2 className="spin" />
      ) : list.length === 0 ? (
        <p className="small muted">No templates yet.</p>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {list.map((t) => (
            <div key={t.id} className="template-row">
              <span className="template-row-icon" aria-hidden>{t.icon}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <input className="input input-quiet" defaultValue={t.name} maxLength={120} aria-label="Template name" onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && void patch(t, { name: e.target.value.trim() })} />
                <span className="tiny muted">
                  {templateSummary(t.data)} · saved {timeAgo(t.updated_at)}{t.use_count ? ` · used ${t.use_count}×` : ""}
                </span>
              </div>
              <div className="row wrap template-row-actions" style={{ gap: 6 }}>
                <button className="btn btn-sm" onClick={() => void patch(t, { is_public: !t.is_public })} aria-pressed={t.is_public} title={t.is_public ? "Anyone on Driftbook can find it" : "Only people with the link"}>
                  {t.is_public ? <><Globe size={14} /> Public</> : <><Lock size={14} /> Link only</>}
                </button>
                <button className="btn btn-sm" onClick={() => void copy(templateLink(t.share_code), toast, "Link copied")}><Copy size={14} /> Link</button>
                <button className="icon-btn" onClick={() => void del(t)} aria-label={`Delete ${t.name}`}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
