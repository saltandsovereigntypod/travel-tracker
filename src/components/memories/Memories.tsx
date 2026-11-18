"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BookOpen, Lock, NotebookPen, Users, Globe2 } from "lucide-react";
import { useTrip } from "../TripProvider";
import { PersonPicker, Segmented } from "../ui/Fields";
import { canSee, LINK_ICONS, linkTitle, matchPlan, visibilityLabel, withHouseholds } from "@/lib/memories";
import { formatDay } from "@/lib/format";
import type { MemoryLink, Note, Visibility } from "@/lib/types";
import { modeOf, transportTitle } from "@/lib/transport";

/** Who can see this: everyone, only me, or people I pick (couples come as a pair). Only the owner can change it. */
export function VisibilityControl({
  value,
  people,
  owner,
  onChange,
}: {
  value: Visibility;
  people: string[];
  owner: string | null;
  onChange: (v: { visibility: Visibility; visible_to: string[] }) => void;
}) {
  const { me, rows, nameOf, colorOf, householdOf } = useTrip();
  const mine = !owner || owner === me;
  if (!mine) {
    return (
      <p className="small muted row" style={{ gap: 6 }}>
        {value === "everyone" ? <Globe2 size={14} /> : <Lock size={14} />} {visibilityLabel({ visibility: value, visible_to: people, created_by: owner }, (id) => nameOf(id), me)}
      </p>
    );
  }
  const everyone = rows.trip_members.map((m) => m.user_id);
  const others = everyone.filter((id) => id !== me);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Segmented<Visibility>
        size="sm"
        value={value}
        onChange={(v) => onChange({ visibility: v, visible_to: v === "people" ? people : [] })}
        options={[
          { value: "everyone", label: <><Globe2 size={13} /> Everyone</> },
          { value: "people", label: <><Users size={13} /> Choose people</> },
          { value: "private", label: <><Lock size={13} /> Only me</> },
        ]}
      />
      {value === "people" && (
        <>
          <PersonPicker
            people={others}
            value={people.filter((p) => p !== me)}
            onChange={(v) => onChange({ visibility: "people", visible_to: withHouseholds(v, householdOf, others).filter((p) => p !== me) })}
            nameOf={nameOf}
            colorOf={colorOf}
          />
          <span className="tiny muted">Picking someone in a couple or household includes their partner. Nobody else can see it, not even in the database.</span>
        </>
      )}
    </div>
  );
}

/** Attach a note or photo to a plan, stay, flight, idea or list item. */
export function AttachPicker({ type, id, onChange, disabled }: { type: MemoryLink | null | undefined; id: string | null | undefined; onChange: (t: MemoryLink | null, id: string | null) => void; disabled?: boolean }) {
  const { rows } = useTrip();
  const value = type && id ? `${type}:${id}` : "";
  const sortDay = <T extends { day?: string | null; title?: string }>(a: T, b: T) => (a.day ?? "9999").localeCompare(b.day ?? "9999");
  return (
    <select
      className="input"
      value={value}
      disabled={disabled}
      aria-label="Attached to"
      onChange={(e) => {
        const [t, i] = e.target.value.split(":");
        onChange(t ? (t as MemoryLink) : null, i ?? null);
      }}
    >
      <option value="">Not attached</option>
      {rows.itinerary_items.length > 0 && (
        <optgroup label="Plans">
          {[...rows.itinerary_items].sort(sortDay).map((i) => <option key={i.id} value={`itinerary:${i.id}`}>{i.day ? `${formatDay(i.day)} · ` : ""}{i.title}</option>)}
        </optgroup>
      )}
      {rows.stays.filter((s) => s.status !== "cancelled").length > 0 && (
        <optgroup label="Stays">
          {rows.stays.filter((s) => s.status !== "cancelled").map((s) => <option key={s.id} value={`stay:${s.id}`}>{s.name}</option>)}
        </optgroup>
      )}
      {rows.flights.filter((f) => f.status !== "cancelled").length > 0 && (
        <optgroup label="Flights">
          {rows.flights.filter((f) => f.status !== "cancelled").map((f) => <option key={f.id} value={`flight:${f.id}`}>{modeOf(f).emoji} {transportTitle(f)}{f.depart_local ? ` · ${formatDay(f.depart_local.slice(0, 10))}` : ""}</option>)}
        </optgroup>
      )}
      {rows.ideas.length > 0 && (
        <optgroup label="Ideas">
          {rows.ideas.map((i) => <option key={i.id} value={`idea:${i.id}`}>{i.title}</option>)}
        </optgroup>
      )}
      {rows.lists.map((l) => {
        const items = rows.list_items.filter((i) => i.list_id === l.id);
        return items.length ? (
          <optgroup key={l.id} label={`${l.icon} ${l.name}`}>
            {items.map((i) => <option key={i.id} value={`list_item:${i.id}`}>{i.title || "Untitled"}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

export function AttachedChip({ type, id }: { type: MemoryLink | null | undefined; id: string | null | undefined }) {
  const { rows } = useTrip();
  const title = linkTitle(type, id, rows);
  if (!type || !title) return null;
  return <span className="chip chip-2">{LINK_ICONS[type]} {title}</span>;
}

/** Photos and notes attached to something (and, for plans, photos taken there). */
export function useLinkedMemories(type: MemoryLink, id: string) {
  const { rows, me } = useTrip();
  const plan = type === "itinerary" ? rows.itinerary_items.find((i) => i.id === id) : undefined;
  const photos = rows.photos.filter(
    (p) => canSee(p, me) && ((p.linked_type === type && p.linked_id === id) || (!p.linked_type && plan && matchPlan(p, [plan])?.id === plan.id)),
  );
  const notes = rows.notes.filter((n) => canSee(n, me) && n.linked_type === type && n.linked_id === id);
  return { photos, notes };
}

export function LinkedMemories({ type, id }: { type: MemoryLink; id: string }) {
  const { tripId, photoUrl, ensurePhotoUrls } = useTrip();
  const { photos, notes } = useLinkedMemories(type, id);
  const paths = photos.slice(0, 9).map((p) => p.storage_path).join("|");
  useEffect(() => {
    if (paths) void ensurePhotoUrls(paths.split("|"));
  }, [paths, ensurePhotoUrls]);
  if (!photos.length && !notes.length) return null;
  return (
    <div className="detail-section">
      <h3>Photos &amp; notes</h3>
      {photos.length > 0 && (
        <div className="memory-strip">
          {photos.slice(0, 9).map((p) => (
            <Link key={p.id} href={`/trips/${tripId}/photos?photo=${p.id}`} className="memory-thumb" aria-label={p.caption || "Photo"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photoUrl(p.storage_path) && <img src={photoUrl(p.storage_path)} alt={p.caption} loading="lazy" />}
            </Link>
          ))}
          {photos.length > 9 && <Link href={`/trips/${tripId}/photos`} className="memory-thumb memory-more">+{photos.length - 9}</Link>}
        </div>
      )}
      {notes.map((n: Note) => (
        <Link key={n.id} href={`/trips/${tripId}/notes?note=${n.id}`} className="dist-row" style={{ marginTop: 6 }}>
          {n.kind === "journal" ? <BookOpen size={16} /> : <NotebookPen size={16} />}
          <span className="grow"><strong className="small">{n.title || (n.kind === "journal" ? `Journal · ${formatDay(n.entry_date)}` : "Untitled note")}</strong><span className="tiny muted truncate" style={{ display: "block" }}>{n.body || "Empty"}</span></span>
          {n.visibility !== "everyone" && <Lock size={13} />}
        </Link>
      ))}
    </div>
  );
}

