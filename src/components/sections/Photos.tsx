"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Heart, Upload, Trash2, Loader2, Download } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { Modal } from "../ui/Modal";
import { EmptyState, Field } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { CommentThread } from "./Comments";
import { friendlyError, supabase } from "@/lib/supabase";
import { formatDay, todayString } from "@/lib/format";
import type { Photo } from "@/lib/types";

/** Shrink big phone photos before upload. Returns the original for formats canvas can't read (e.g. HEIC). */
export async function shrinkImage(file: File, maxSide = 2400): Promise<{ blob: Blob; ext: string; width?: number; height?: number }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { blob: file, ext };
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    if (scale === 1 && file.size < 1.5e6) return { blob: file, ext, width: w, height: h };
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return blob ? { blob, ext: "jpg", width: w, height: h } : { blob: file, ext };
  } catch {
    return { blob: file, ext };
  }
}

export function usePhotoUpload() {
  const { tripId, insert, me } = useTrip();
  const toast = useToast();
  const [busy, setBusy] = useState(0);
  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(list.length);
    for (const f of list) {
      try {
        const { blob, ext, width, height } = await shrinkImage(f);
        const path = `${tripId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase().storage.from("trip-media").upload(path, blob, { contentType: blob.type || f.type });
        if (up.error) throw up.error;
        await insert("photos", { storage_path: path, width: width ?? null, height: height ?? null, taken_on: todayString(), created_by: me });
      } catch (err) {
        toast.error(`${f.name}: ${friendlyError(err)}`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
  }
  return { upload, busy };
}

export function PhotosSection({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const { rows, canEdit, ensurePhotoUrls, photoUrl, tripId } = useTrip();
  const { upload, busy } = usePhotoUpload();
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState<Photo | null>(null);
  const [filter, setFilter] = useState<"all" | "fav">("all");
  const input = useRef<HTMLInputElement>(null);
  const photos = [...rows.photos]
    .filter((p) => filter === "all" || p.favorite)
    .sort((a, b) => (b.taken_on ?? b.created_at).localeCompare(a.taken_on ?? a.created_at));
  const shown = compact ? photos.slice(0, limit ?? 8) : photos;

  useEffect(() => {
    void ensurePhotoUrls(shown.map((p) => p.storage_path));
  }, [shown, ensurePhotoUrls]);

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <h1>Photos</h1>
            <p>Everyone&apos;s pictures in one place. Heart the best ones for the scrapbook.</p>
          </div>
          <div className="toolbar">
            <button className={clsx("btn btn-sm", filter === "fav" && "btn-primary")} onClick={() => setFilter((f) => (f === "fav" ? "all" : "fav"))}><Heart size={14} /> Favorites</button>
            {canEdit && <button className="btn btn-primary" onClick={() => input.current?.click()}><Upload size={16} /> Upload</button>}
          </div>
        </div>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />
      {canEdit && !compact && (
        <div
          className={clsx("dropzone", over && "over")}
          style={{ marginBottom: "1rem" }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files); }}
        >
          {busy > 0 ? <span className="row" style={{ justifyContent: "center" }}><Loader2 size={16} className="spin" /> Uploading {busy}…</span> : "Drop photos here, or use Upload."}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState icon={<Camera />} title="No photos yet" action={canEdit && <button className="btn btn-sm" onClick={() => input.current?.click()}><Upload size={14} /> Add photos</button>}>
          Inspiration shots before, real ones during.
        </EmptyState>
      ) : (
        <div className="photo-grid" style={compact ? { gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" } : undefined}>
          {shown.map((p) => (
            <button key={p.id} className="photo-tile" onClick={() => setOpen(p)} aria-label={p.caption || "Open photo"}>
              {photoUrl(p.storage_path) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(p.storage_path)} alt={p.caption} loading="lazy" />
              ) : (
                <Loader2 className="spin" style={{ margin: "auto" }} />
              )}
              {p.favorite && <Heart className="fav" size={18} fill="currentColor" />}
            </button>
          ))}
        </div>
      )}
      {compact && (
        <div className="row" style={{ marginTop: 8 }}>
          {canEdit && <button className="btn btn-sm" onClick={() => input.current?.click()}>{busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Add</button>}
          <Link className="btn btn-sm btn-ghost" href={`/trips/${tripId}/photos`}>All {rows.photos.length} photos →</Link>
        </div>
      )}
      <PhotoModal photo={open ? rows.photos.find((p) => p.id === open.id) ?? null : null} onClose={() => setOpen(null)} />
    </div>
  );
}

function PhotoModal({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  const { photoUrl, update, remove, canEdit, nameOf } = useTrip();
  const [caption, setCaption] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if ((photo?.id ?? null) !== loadedFor) {
    setLoadedFor(photo?.id ?? null);
    setCaption(photo?.caption ?? "");
  }
  if (!photo) return null;
  const url = photoUrl(photo.storage_path);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={photo.caption || `Photo by ${nameOf(photo.created_by)}`}
      footer={
        <>
          {canEdit && (
            <button className="btn btn-danger" onClick={async () => {
              if (!confirm("Delete this photo for everyone?")) return;
              await supabase().storage.from("trip-media").remove([photo.storage_path]);
              await remove("photos", photo.id);
              onClose();
            }}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          {url && <a className="btn" href={url} download target="_blank" rel="noopener noreferrer"><Download size={15} /> Original</a>}
          <span className="spacer" />
          {canEdit && (
            <button className={clsx("btn", photo.favorite && "btn-primary")} onClick={() => update("photos", photo.id, { favorite: !photo.favorite })}>
              <Heart size={15} fill={photo.favorite ? "currentColor" : "none"} /> {photo.favorite ? "Favorite" : "Mark favorite"}
            </button>
          )}
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: "1.2rem" }} className="idea-modal-grid">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={photo.caption} style={{ width: "100%", borderRadius: 12, maxHeight: "65dvh", objectFit: "contain", background: "var(--line)" }} /> : <Loader2 className="spin" />}
        <div className="stack">
          <Field label="Caption">
            <input className="input" value={caption} disabled={!canEdit} onChange={(e) => setCaption(e.target.value)} onBlur={() => caption !== photo.caption && update("photos", photo.id, { caption })} placeholder="Say something about it" />
          </Field>
          <Field label="Taken on">
            <input className="input" type="date" disabled={!canEdit} value={photo.taken_on ?? ""} onChange={(e) => update("photos", photo.id, { taken_on: e.target.value || null })} />
          </Field>
          <p className="tiny muted">Added by {nameOf(photo.created_by)}{photo.taken_on && ` · ${formatDay(photo.taken_on)}`}</p>
          <h3>Comments</h3>
          <CommentThread entity="photo" id={photo.id} />
        </div>
      </div>
    </Modal>
  );
}
