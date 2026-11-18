"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Heart, Upload, Trash2, Loader2, Download, MapPin, Lock, Users } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Modal } from "../ui/Modal";
import { EmptyState, Field, Segmented } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { CommentThread } from "./Comments";
import { AttachPicker, AttachedChip, VisibilityControl } from "../memories/Memories";
import { CardOptions, useCardChoice, useCardParts, useSetCardPref } from "../ui/CardOptions";
import { friendlyError, supabase } from "@/lib/supabase";
import { formatDay, formatDayLong, todayString } from "@/lib/format";
import { canSee, groupPhotos, matchPlan, photoDay, type PhotoGrouping } from "@/lib/memories";
import { stayForDay } from "@/lib/travel";
import type { Photo } from "@/lib/types";

/** Date, time and place from the camera, when the file still has them. */
async function readCameraInfo(file: File): Promise<{ taken_at: string | null; lat: number | null; lng: number | null }> {
  try {
    const exifr = (await import("exifr")).default;
    const d = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "GPSLatitude", "GPSLatitudeRef", "GPSLongitude", "GPSLongitudeRef"] });
    const when: Date | undefined = d?.DateTimeOriginal ?? d?.CreateDate;
    return {
      taken_at: when instanceof Date && !Number.isNaN(when.getTime()) ? when.toISOString() : null,
      lat: typeof d?.latitude === "number" ? d.latitude : null,
      lng: typeof d?.longitude === "number" ? d.longitude : null,
    };
  } catch {
    return { taken_at: null, lat: null, lng: null };
  }
}

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
  const { tripId, insert, me, rows } = useTrip();
  const toast = useToast();
  const [busy, setBusy] = useState(0);
  async function upload(files: FileList | File[], extra: Partial<Photo> = {}) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) return;
    setBusy(list.length);
    let matched = 0;
    for (const f of list) {
      try {
        const cam = await readCameraInfo(f);
        const { blob, ext, width, height } = await shrinkImage(f);
        const path = `${tripId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase().storage.from("trip-media").upload(path, blob, { contentType: blob.type || f.type });
        if (up.error) throw up.error;
        // Taken at a plan (same day, nearby or during it)? Attach it there.
        const plan = !extra.linked_type ? matchPlan(cam, rows.itinerary_items) : null;
        if (plan) matched++;
        await insert("photos", {
          storage_path: path,
          width: width ?? null,
          height: height ?? null,
          taken_at: cam.taken_at,
          taken_on: cam.taken_at ? photoDay({ taken_at: cam.taken_at, taken_on: null, created_at: "" }) : todayString(),
          lat: cam.lat,
          lng: cam.lng,
          created_by: me,
          ...(plan ? { linked_type: "itinerary" as const, linked_id: plan.id } : {}),
          ...extra,
        });
      } catch (err) {
        toast.error(`${f.name}: ${friendlyError(err)}`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (matched) toast.success(`${matched} photo${matched === 1 ? " was" : "s were"} matched to the plan${matched === 1 ? "" : "s"} you were at.`);
  }
  return { upload, busy };
}

type View = "all" | PhotoGrouping;

export function PhotosSection({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const { rows, canEdit, ensurePhotoUrls, photoUrl, tripId, me, nameOf, voice } = useTrip();
  const { upload, busy } = usePhotoUpload();
  const [over, setOver] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const choice = useCardChoice("photos");
  const setPref = useSetCardPref("photos");
  const showPart = useCardParts("photos");
  const fav = choice("show") === "fav";
  const grouping = choice("group");
  const view: View = grouping === "none" ? "all" : (grouping as View);
  const setView = (v: View) => setPref("group", v === "all" ? "none" : v);
  const setFav = (f: (x: boolean) => boolean) => setPref("show", f(fav) ? "fav" : "all");
  const input = useRef<HTMLInputElement>(null);

  // Opened from a plan or stay ("Photos & notes").
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("photo");
    if (id) queueMicrotask(() => setOpenId(id));
  }, []);

  const photos = useMemo(
    () =>
      rows.photos
        .filter((p) => canSee(p, me) && (!fav || p.favorite))
        .sort((a, b) => (b.taken_at ?? b.taken_on ?? b.created_at).localeCompare(a.taken_at ?? a.taken_on ?? a.created_at)),
    [rows.photos, me, fav],
  );
  const shown = compact ? photos.slice(0, limit ?? 8) : photos;
  const groups = useMemo(
    () => (view === "all" ? null : groupPhotos(shown, view, { rows, nameOf: (id) => nameOf(id), stayForDay: (d) => stayForDay(rows.stays, d) })),
    [view, shown, rows, nameOf],
  );

  useEffect(() => {
    void ensurePhotoUrls(shown.map((p) => p.storage_path));
  }, [shown, ensurePhotoUrls]);

  const grid = (list: Photo[]) => (
    <div className="photo-grid" style={compact ? { gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" } : undefined}>
      {list.map((p) => (
        <button key={p.id} className="photo-tile" onClick={() => setOpenId(p.id)} aria-label={p.caption || "Open photo"}>
          {photoUrl(p.storage_path) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl(p.storage_path)} alt={p.caption} loading="lazy" />
          ) : (
            <Loader2 className="spin" style={{ margin: "auto" }} />
          )}
          {p.favorite && <Heart className="fav" size={18} fill="currentColor" />}
          {showPart("captions") && p.caption && <span className="photo-caption">{p.caption}</span>}
          {p.visibility && p.visibility !== "everyone" && <span className="photo-lock" title="Not everyone can see this">{p.visibility === "private" ? <Lock size={12} /> : <Users size={12} />}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <ModuleTitle id="photos" fallback="Photos" />
            <p>{voice.photos.hint}</p>
          </div>
          <div className="toolbar">
            {canEdit && <button className="btn btn-primary" onClick={() => input.current?.click()}><Upload size={16} /> Upload</button>}
          </div>
        </div>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />
      {!compact && (
        <div className="toolbar" style={{ marginBottom: "1rem" }}>
          <Segmented<View>
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All" },
              { value: "day", label: "By day" },
              { value: "plan", label: voice.photos.byLinked },
              { value: "person", label: "By person" },
              { value: "album", label: "Albums" },
            ]}
          />
          <button className={clsx("btn btn-sm", fav && "btn-primary")} onClick={() => setFav((f) => !f)}><Heart size={14} /> Favorites</button>
          <CardOptions kind="photos" title="Photo options" />
        </div>
      )}
      {canEdit && !compact && (
        <div
          className={clsx("dropzone", over && "over")}
          style={{ marginBottom: "1rem" }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files); }}
        >
          {busy > 0 ? <span className="row" style={{ justifyContent: "center" }}><Loader2 size={16} className="spin" /> Uploading {busy}…</span> : "Drop photos here, or use Upload. They're sorted by when and where they were taken."}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState icon={<Camera />} title={fav ? "No favorites yet" : "No photos yet"} action={canEdit && !fav && <button className="btn btn-sm" onClick={() => input.current?.click()}><Upload size={14} /> Add photos</button>}>
          {fav ? "Open a photo and tap the heart." : voice.photos.empty}
        </EmptyState>
      ) : groups ? (
        <div className="stack" style={{ gap: "1.4rem" }}>
          {groups.map((g) => (
            <section key={g.key}>
              <div className="photo-group-head">
                <h3>{view === "day" && g.key !== "~" ? formatDayLong(g.key) : g.title}</h3>
                <span className="tiny muted">{g.sub ? `${g.sub} · ` : ""}{g.photos.length} photo{g.photos.length === 1 ? "" : "s"}</span>
              </div>
              {grid(g.photos)}
            </section>
          ))}
        </div>
      ) : (
        grid(shown)
      )}
      {compact && (
        <div className="row" style={{ marginTop: 8 }}>
          {canEdit && <button className="btn btn-sm" onClick={() => input.current?.click()}>{busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Add</button>}
          <Link className="btn btn-sm btn-ghost" href={`/trips/${tripId}/photos`}>All {photos.length} photos →</Link>
        </div>
      )}
      <PhotoPanel photo={openId ? rows.photos.find((p) => p.id === openId) ?? null : null} onClose={() => setOpenId(null)} />
    </div>
  );
}

function PhotoPanel({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  const { photoUrl, ensurePhotoUrls, update, remove, canEdit, nameOf, me, rows, voice } = useTrip();
  const [caption, setCaption] = useState("");
  const [album, setAlbum] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if ((photo?.id ?? null) !== loadedFor) {
    setLoadedFor(photo?.id ?? null);
    setCaption(photo?.caption ?? "");
    setAlbum(photo?.album ?? "");
  }
  useEffect(() => {
    if (photo) void ensurePhotoUrls([photo.storage_path]);
  }, [photo, ensurePhotoUrls]);
  if (!photo) return null;
  const url = photoUrl(photo.storage_path);
  const mine = photo.created_by === me;
  const albums = [...new Set(rows.photos.map((p) => p.album?.trim()).filter(Boolean))] as string[];
  const taken = photo.taken_at ? new Date(photo.taken_at) : null;
  return (
    <Modal
      open
      onClose={onClose}
      variant="panel"
      title={photo.caption || `Photo by ${nameOf(photo.created_by)}`}
      actions={
        canEdit ? (
          <button className={clsx("btn btn-sm", photo.favorite && "btn-primary")} onClick={() => update("photos", photo.id, { favorite: !photo.favorite })} aria-pressed={photo.favorite}>
            <Heart size={14} fill={photo.favorite ? "currentColor" : "none"} /> {photo.favorite ? "Favorite" : "Favorite?"}
          </button>
        ) : undefined
      }
      footer={
        <>
          {canEdit && (mine || photo.visibility === "everyone") && (
            <button className="btn btn-danger" onClick={async () => {
              if (!confirm("Delete this photo for everyone?")) return;
              await supabase().storage.from("trip-media").remove([photo.storage_path]);
              await remove("photos", photo.id);
              onClose();
            }}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <span className="spacer" />
          {url && <a className="btn" href={url} download target="_blank" rel="noopener noreferrer"><Download size={15} /> Original</a>}
        </>
      }
    >
      <div className="detail">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt={photo.caption} className="photo-full" /> : <div className="photo-full row" style={{ justifyContent: "center" }}><Loader2 className="spin" /></div>}
        <div className="row wrap" style={{ gap: 6 }}>
          <AttachedChip type={photo.linked_type} id={photo.linked_id} />
          {photo.album && <span className="chip chip-muted">📚 {photo.album}</span>}
          {photo.lat != null && photo.lng != null && (
            <a className="chip chip-2" href={`https://www.google.com/maps/search/?api=1&query=${photo.lat},${photo.lng}`} target="_blank" rel="noopener noreferrer"><MapPin size={12} /> Where it was taken</a>
          )}
        </div>
        <div className="detail-grid">
          <div><small>Taken</small>{taken ? `${formatDay(photoDay(photo))} · ${taken.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : photo.taken_on ? formatDay(photo.taken_on) : "—"}</div>
          <div><small>Added by</small>{nameOf(photo.created_by)}</div>
        </div>
        {canEdit && (
          <div className="form-grid">
            <Field label="Caption" full>
              <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} onBlur={() => caption !== photo.caption && update("photos", photo.id, { caption })} placeholder="Say something about it" />
            </Field>
            <Field label="Attached to" hint={voice.attachHint}>
              <AttachPicker type={photo.linked_type} id={photo.linked_id} onChange={(t, id) => update("photos", photo.id, { linked_type: t, linked_id: id })} />
            </Field>
            <Field label="Album">
              <input className="input" list="photo-albums" value={album} onChange={(e) => setAlbum(e.target.value)} onBlur={() => album !== (photo.album ?? "") && update("photos", photo.id, { album: album.trim() })} placeholder="e.g. Costumes, Food" maxLength={80} />
              <datalist id="photo-albums">{albums.map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
            <Field label="Day" hint="If the camera didn't record it.">
              <input className="input" type="date" value={photo.taken_on ?? ""} onChange={(e) => update("photos", photo.id, { taken_on: e.target.value || null })} />
            </Field>
          </div>
        )}
        <div className="detail-section">
          <h3>Who can see it</h3>
          <VisibilityControl
            value={photo.visibility ?? "everyone"}
            people={photo.visible_to ?? []}
            owner={photo.created_by}
            onChange={(v) => update("photos", photo.id, v)}
          />
        </div>
        <div className="detail-section">
          <h3>Comments</h3>
          <CommentThread entity="photo" id={photo.id} />
        </div>
      </div>
    </Modal>
  );
}
