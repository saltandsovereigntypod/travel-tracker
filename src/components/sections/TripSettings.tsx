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

export function TripSettingsSection() {
  const { trip, canEdit, isOwner, updateTrip, tripId, rows, profiles } = useTrip();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    name: trip?.name ?? "",
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
      destination: form.destination.trim(),
      description: form.description,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      currency: form.currency,
      budget: Math.max(0, Number(form.budget) || 0),
    };
    if (form.destination.trim() && form.destination.trim() !== trip!.destination) {
      const r = await searchPlaces(form.destination).catch(() => []);
      if (r[0]) Object.assign(patch, { lat: r[0].lat, lng: r[0].lng });
    }
    const ok = await updateTrip(patch);
    setBusy(false);
    if (ok) toast.success("Trip saved");
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
          <h1>Trip settings</h1>
          <p>These details are shared with everyone on the trip.</p>
        </div>
      </div>
      <form className="card form-grid" onSubmit={save}>
        <fieldset disabled={!canEdit} style={{ display: "contents" }}>
          <Field label="Trip name" full><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} /></Field>
          <Field label="Destination" full hint="Used to center the map and bias place search."><input className="input" value={form.destination} onChange={(e) => set("destination", e.target.value)} /></Field>
          <Field label="Start date"><input className="input" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="End date"><input className="input" type="date" min={form.start_date || undefined} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
          <Field label="Currency">
            <select className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              {[...new Set([form.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Total budget"><input className="input" type="number" min="0" step="1" value={form.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
          <Field label="About this trip" full><textarea className="input textarea" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="The vibe, the goal, the inside jokes…" /></Field>
          <div className="field-full row">
            <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="spin" />} Save changes</button>
          </div>
        </fieldset>
      </form>

      {canEdit && (
        <div className="card stack">
          <h3>Shared cover photo</h3>
          <p className="muted small">Shows on everyone&apos;s trip list. You can also set a personal cover just for you in My view → Design.</p>
          <div className="trip-cover" style={{ borderRadius: 12, ...(trip.cover_image ? { backgroundImage: `url("${trip.cover_image}")` } : {}) }} />
          <label className="btn" style={{ alignSelf: "flex-start" }}>
            {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Upload cover
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
          </label>
        </div>
      )}

      <div className="card stack">
        <h3>Your data</h3>
        <p className="muted small">Download everything you can see on this trip as a file.</p>
        <button className="btn" style={{ alignSelf: "flex-start" }} onClick={exportJson}><Download size={16} /> Export trip</button>
      </div>

      {isOwner && (
        <div className="card stack" style={{ borderColor: "var(--danger)" }}>
          <h3 style={{ color: "var(--danger)" }}>Delete trip</h3>
          <p className="muted small">Deletes the trip and everything in it for everyone. This can&apos;t be undone.</p>
          <button
            className="btn btn-danger"
            style={{ alignSelf: "flex-start" }}
            onClick={async () => {
              const typed = prompt(`Type the trip name to delete it for everyone:\n${trip.name}`);
              if (typed !== trip.name) return;
              const paths = rows.photos.map((p) => p.storage_path);
              if (paths.length) await supabase().storage.from("trip-media").remove(paths);
              const { error } = await supabase().from("trips").delete().eq("id", tripId);
              if (error) toast.error(friendlyError(error));
              else router.replace("/trips");
            }}
          >
            <Trash2 size={16} /> Delete this trip
          </button>
        </div>
      )}
    </div>
  );
}
