"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { Modal } from "../ui/Modal";
import { EmptyState, Field, Segmented } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { supabase } from "@/lib/supabase";
import { CURRENCIES } from "@/lib/services";
import { TEMPLATES, templateFor, type SpaceTemplate } from "@/lib/spaces";
import { LIST_TEMPLATES, SPACE_LISTS } from "@/lib/list-templates";
import { templateSummary, type SpaceTemplateRow } from "@/lib/space-templates";
import { createSpace } from "@/lib/start-space";

/** A saved template as the picker needs it (from your own, the community, or a share link). */
export type SavedTemplate = Pick<SpaceTemplateRow, "id" | "name" | "description" | "icon" | "kind" | "data" | "use_count"> & { owner_name?: string };

const PLACEHOLDERS: Record<string, string> = {
  trip: "Salem Halloween 2027",
  wedding: "Our wedding",
  podcast: "Salt & Sovereignty · Season 3",
  household: "Our home",
  event: "Mom's 60th",
  blank: "Name it anything",
};

type Tab = "starters" | "mine" | "community";

export function NewSpaceModal({ open, onClose, startWith }: { open: boolean; onClose: () => void; startWith?: SavedTemplate }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("starters");
  const [tpl, setTpl] = useState<SpaceTemplate | null>(startWith ? templateFor(startWith.kind) : null);
  const [saved, setSaved] = useState<SavedTemplate | null>(startWith ?? null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(startWith?.icon ?? "");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState(startWith?.data.currency ?? "USD");
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState<SpaceTemplateRow[] | null>(null);

  useEffect(() => {
    if (!open || startWith || library) return;
    let alive = true;
    supabase()
      .from("space_templates")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200)
      .then(({ data }) => alive && setLibrary((data as SpaceTemplateRow[]) ?? []));
    return () => {
      alive = false;
    };
  }, [open, startWith, library]);

  const mine = (library ?? []).filter((t) => t.owner_id === user?.id);
  const community = (library ?? []).filter((t) => t.is_public && t.owner_id !== user?.id).sort((a, b) => b.use_count - a.use_count);

  function pick(t: SpaceTemplate) {
    setTpl(t);
    setSaved(null);
    setIcon(t.icon);
  }
  function pickSaved(t: SavedTemplate) {
    setTpl(templateFor(t.kind));
    setSaved(t);
    setIcon(t.icon);
    if (t.data.currency) setCurrency(t.data.currency);
  }
  function back() {
    setTpl(null);
    setSaved(null);
  }
  function close() {
    if (!startWith) back();
    setName("");
    setDestination("");
    setStart("");
    setEnd("");
    onClose();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!tpl || !user) return;
    const endDate = tpl.dates.single ? start : end;
    if (endDate && start && endDate < start) {
      toast.error("The end date is before the start date.");
      return;
    }
    setBusy(true);
    const res = await createSpace(
      { name, kind: saved?.kind ?? tpl.kind, icon, destination, start: start || null, end: endDate || null, currency },
      user.id,
      saved ? { id: saved.id, data: saved.data } : undefined,
    );
    if (!res.id) {
      setBusy(false);
      toast.error(res.error ?? "Couldn't create it.");
      return;
    }
    if (res.warning) toast.error(res.warning);
    router.push(`/trips/${res.id}`);
  }

  const card = (t: SavedTemplate, by?: string) => (
    <button key={t.id} className="template-card" onClick={() => pickSaved(t)}>
      <span className="template-art" style={{ background: templateFor(t.kind).gradient }}>{t.icon}</span>
      <strong>{t.name}</strong>
      <span className="small muted">{t.description || templateSummary(t.data)}</span>
      <span className="tiny muted">{[by, templateSummary(t.data), t.use_count ? `used ${t.use_count}×` : ""].filter(Boolean).join(" · ")}</span>
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        tpl ? (
          <span className="row">
            {!startWith && <button className="icon-btn" onClick={back} aria-label="Back to templates"><ArrowLeft size={18} /></button>}
            {saved ? `Start from “${saved.name}”` : `New ${tpl.name.toLowerCase()}`}
          </span>
        ) : (
          "What are you planning?"
        )
      }
      size={tpl ? "md" : "lg"}
      footer={
        tpl && (
          <>
            <button className="btn" onClick={close} type="button">Cancel</button>
            <button className="btn btn-primary" form="new-space" disabled={busy || !name.trim()}>
              {busy && <Loader2 size={16} className="spin" />} Create
            </button>
          </>
        )
      }
    >
      {!tpl ? (
        <div className="stack" style={{ gap: "0.9rem" }}>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "starters", label: "Starters" },
              { value: "mine", label: `Yours${mine.length ? ` (${mine.length})` : ""}` },
              { value: "community", label: "Community" },
            ]}
          />
          {tab === "starters" ? (
            <div className="template-grid">
              {TEMPLATES.map((t) => (
                <button key={t.kind} className="template-card" onClick={() => pick(t)}>
                  <span className="template-art" style={{ background: t.gradient }}>{t.icon}</span>
                  <strong>{t.name}</strong>
                  <span className="small muted">{t.description}</span>
                </button>
              ))}
            </div>
          ) : !library ? (
            <div className="row" style={{ justifyContent: "center", padding: "2rem" }}><Loader2 className="spin" /></div>
          ) : tab === "mine" ? (
            mine.length ? (
              <div className="template-grid">{mine.map((t) => card(t))}</div>
            ) : (
              <EmptyState title="No templates yet">
                Set up a space the way you like it, then open its settings and choose <strong>Save as template</strong>. You can reuse it, share a
                link, or publish it here for everyone.
              </EmptyState>
            )
          ) : community.length ? (
            <div className="template-grid">{community.map((t) => card(t, "Shared"))}</div>
          ) : (
            <EmptyState icon={<Users />} title="Nothing published yet">
              Templates people choose to share with everyone show up here. Yours can be the first: publish one from Settings.
            </EmptyState>
          )}
        </div>
      ) : (
        <form id="new-space" className="form-grid" onSubmit={create}>
          <Field label="Name" full>
            <div className="row">
              <input className="input" style={{ width: 64, textAlign: "center", fontSize: "1.3rem" }} value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 4))} aria-label="Icon (emoji)" />
              <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={saved ? saved.name : PLACEHOLDERS[tpl.kind] ?? "Name"} required maxLength={120} autoFocus />
            </div>
          </Field>
          {tpl.location && (
            <Field label={tpl.location} full>
              <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={tpl.kind === "trip" ? "Salem, Massachusetts" : ""} />
            </Field>
          )}
          {tpl.dates.single ? (
            <Field label={`${tpl.dates.label} (optional)`}>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label={`${tpl.dates.label}: start (optional)`}>
                <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="End (optional)">
                <input className="input" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Currency" hint="Budget totals use this currency.">
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          {saved ? (
            <div className="field-full small muted stack" style={{ gap: 4 }}>
              {saved.description && <span>{saved.description}</span>}
              <span>
                Comes with: {templateSummary(saved.data)}
                {saved.data.lists.length > 0 && <> ({saved.data.lists.map((l) => `${l.icon} ${l.name}`).join(", ")})</>}
                {saved.data.pages.length > 0 && <>; pages: {saved.data.pages.filter((p) => !p.parent_id).map((p) => p.title || "Untitled").join(", ")}</>}
                . People, payments and private notes are never copied.
              </span>
            </div>
          ) : (
            <p className="field-full small muted">
              Comes with: {tpl.modules.map((m) => m.label ?? m.id).map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(" · ")}
              {(SPACE_LISTS[tpl.kind] ?? []).length > 0 && <>, plus lists for {(SPACE_LISTS[tpl.kind] ?? []).map((k) => LIST_TEMPLATES.find((t) => t.key === k)?.name).join(", ")}</>}
              . Switch features on or off, rename them, and add more lists anytime.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
