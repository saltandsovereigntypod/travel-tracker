"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Upload, Download } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Field } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { friendlyError, supabase } from "@/lib/supabase";
import { CURRENCIES, searchPlaces } from "@/lib/services";
import { shrinkImage } from "./Photos";
import { MODULES, moduleDef } from "@/lib/spaces";
import { MODULE_ICONS } from "../TripShell";
import { ChevronUp, ChevronDown } from "lucide-react";

export function TripSettingsSection() {
  const { trip, canEdit, isOwner, updateTrip, tripId, rows, profiles, template, noun } = useTrip();
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    name: trip?.name ?? "",
    icon: trip?.icon || template.icon,
    destination: trip?.destination ?? "",
    description: trip?.description ?? "",
    start_date: trip?.start_date ?? "",
    end_date: trip?.end_date ?? "",
    currency: trip?.currency ?? "USD",
    budget: String(trip?.budget ?? 0),
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));
  if (!trip) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      toast.error("End date is before the start date.");
      return;
    }
    setBusy(true);
    const patch: Record<string, unknown> = {
      name: form.name.trim(),
      icon: form.icon.trim(),
      destination: form.destination.trim(),
      description: form.description,
      start_date: form.start_date || null,
      end_date: (template.dates.single ? form.start_date : form.end_date) || null,
      currency: form.currency,
      budget: Math.max(0, Number(form.budget) || 0),
    };
    if (form.destination.trim() && form.destination.trim() !== trip!.destination) {
      const r = await searchPlaces(form.destination).catch(() => []);
      if (r[0]) Object.assign(patch, { lat: r[0].lat, lng: r[0].lng });
    }
    const ok = await updateTrip(patch);
    setBusy(false);
    if (ok) toast.success("Saved");
  }

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const { blob, ext } = await shrinkImage(file, 2000);
      const path = `${tripId}/cover-${crypto.randomUUID()}.${ext}`;
      const up = await supabase().storage.from("trip-media").upload(path, blob, { contentType: blob.type || file.type });
      if (up.error) throw up.error;
      // Long-lived signed URL so the cover shows on the trips list.
      const { data } = await supabase().storage.from("trip-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (data?.signedUrl) await updateTrip({ cover_image: data.signedUrl });
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setUploading(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ trip, ...rows, profiles, exported_at: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${trip!.name.replace(/[^\w-]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="stack" style={{ maxWidth: 760, gap: "1.4rem" }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>{Noun} settings</h1>
          <p>These details are shared with everyone in this {noun}.</p>
        </div>
      </div>
      <form className="card form-grid" onSubmit={save}>
        <fieldset disabled={!canEdit} style={{ display: "contents" }}>
          <Field label="Name" full>
            <div className="row">
              <input className="input" style={{ width: 64, textAlign: "center", fontSize: "1.3rem" }} value={form.icon} onChange={(e) => set("icon", e.target.value.slice(0, 4))} aria-label="Icon (emoji)" />
              <input className="input grow" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
            </div>
          </Field>
          <Field label={template.location ? template.location.replace(" (optional)", "") : "Location (optional)"} full hint="Used to center the map and bias place search."><input className="input" value={form.destination} onChange={(e) => set("destination", e.target.value)} /></Field>
          {template.dates.single ? (
            <Field label={template.dates.label}><input className="input" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          ) : (
            <>
              <Field label="Start date"><input className="input" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
              <Field label="End date"><input className="input" type="date" min={form.start_date || undefined} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
            </>
          )}
          <Field label="Currency">
            <select className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              {[...new Set([form.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Total budget"><input className="input" type="number" min="0" step="1" value={form.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
          <Field label={`About this ${noun}`} full><textarea className="input textarea" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="The vibe, the goal, the inside jokes…" /></Field>
          <div className="field-full row">
            <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="spin" />} Save changes</button>
          </div>
        </fieldset>
      </form>

      <ModulesCard />

      {canEdit && (
        <div className="card stack">
          <h3>Shared cover photo</h3>
          <p className="muted small">Shows on everyone&apos;s home page. You can also set a personal cover just for you in My view → Design.</p>
          <div className="trip-cover" style={{ borderRadius: 12, ...(trip.cover_image ? { backgroundImage: `url("${trip.cover_image}")` } : { background: template.gradient }) }} />
          <label className="btn" style={{ alignSelf: "flex-start" }}>
            {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Upload cover
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
          </label>
        </div>
      )}

      <div className="card stack">
        <h3>Your data</h3>
        <p className="muted small">Download everything you can see here as a file.</p>
        <button className="btn" style={{ alignSelf: "flex-start" }} onClick={exportJson}><Download size={16} /> Export</button>
      </div>

      {isOwner && (
        <div className="card stack" style={{ borderColor: "var(--danger)" }}>
          <h3 style={{ color: "var(--danger)" }}>Delete {noun}</h3>
          <p className="muted small">Deletes it and everything in it for everyone. This can&apos;t be undone.</p>
          <button
            className="btn btn-danger"
            style={{ alignSelf: "flex-start" }}
            onClick={async () => {
              const typed = prompt(`Type the name to delete it for everyone:\n${trip.name}`);
              if (typed !== trip.name) return;
              const paths = rows.photos.map((p) => p.storage_path);
              if (paths.length) await supabase().storage.from("trip-media").remove(paths);
              const { error } = await supabase().from("trips").delete().eq("id", tripId);
              if (error) toast.error(friendlyError(error));
              else router.replace("/trips");
            }}
          >
            <Trash2 size={16} /> Delete this {noun}
          </button>
        </div>
      )}
    </div>
  );
}

/** Switch features on/off, rename them and change their order, per space. */
function ModulesCard() {
  const { trip, canEdit, updateTrip, template } = useTrip();
  if (!trip) return null;
  const saved = Array.isArray(trip.modules) && trip.modules.length ? trip.modules : template.modules;
  const enabled = saved.filter((m) => moduleDef(m.id));
  const off = MODULES.filter((m) => !enabled.some((e) => e.id === m.id));
  const nameFor = (id: string, label?: string) => label?.trim() || template.modules.find((m) => m.id === id)?.label || moduleDef(id)!.label;

  const save = (next: { id: string; label?: string }[]) => updateTrip({ modules: next });
  const move = (i: number, d: number) => {
    const next = enabled.slice();
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void save(next);
  };

  return (
    <div className="card stack">
      <div>
        <h3>Features</h3>
        <p className="muted small">Switch features on or off, rename them for this space, and put them in the order you like. Nothing is deleted when you switch something off.</p>
      </div>
      <div className="stack" style={{ gap: 2 }}>
        {enabled.map((m, i) => {
          const def = moduleDef(m.id)!;
          const Icon = MODULE_ICONS[m.id];
          return (
            <div key={m.id} className="module-row">
              {Icon && <Icon size={18} />}
              <input
                className="input grow"
                defaultValue={nameFor(m.id, m.label)}
                disabled={!canEdit}
                aria-label={`Name for ${def.label}`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== nameFor(m.id, m.label)) void save(enabled.map((x) => (x.id === m.id ? { ...x, label: v || undefined } : x)));
                }}
              />
              {canEdit && (
                <>
                  <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={16} /></button>
                  <button className="icon-btn" aria-label="Move down" disabled={i === enabled.length - 1} onClick={() => move(i, 1)}><ChevronDown size={16} /></button>
                  <button className="btn btn-sm" onClick={() => save(enabled.filter((x) => x.id !== m.id))}>Turn off</button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {off.length > 0 && (
        <>
          <h4 className="field-label" style={{ marginTop: 6 }}>Available</h4>
          <div className="stack" style={{ gap: 2 }}>
            {off.map((m) => {
              const Icon = MODULE_ICONS[m.id];
              return (
                <div key={m.id} className="module-row off">
                  {Icon && <Icon size={18} />}
                  <div className="grow">
                    <strong className="small">{nameFor(m.id)}</strong>
                    <div className="tiny muted">{m.description}</div>
                  </div>
                  {canEdit && <button className="btn btn-sm" onClick={() => save([...enabled, { id: m.id }])}>Turn on</button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
