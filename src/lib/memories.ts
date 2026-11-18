// Photos, notes and journal entries: who can see them, what they're attached to,
// and how photos group (by day, by plan or stay, by person, by album). Pure helpers.

import { distanceKm, hasCoords } from "./geo";
import type { Flight, Idea, ItineraryItem, MemoryLink, Photo, Stay, Visibility } from "./types";
import type { ListItem } from "./fields";
import { transportTitle } from "./transport";

export interface Visible {
  visibility?: Visibility;
  visible_to?: string[];
  created_by: string | null;
}

/** Mirrors the database rule (the server is what actually enforces it). */
export function canSee(x: Visible, me: string): boolean {
  const v = x.visibility ?? "everyone";
  return v === "everyone" || x.created_by === me || (v === "people" && (x.visible_to ?? []).includes(me));
}

export function visibilityLabel(x: Visible, nameOf: (id: string) => string, me: string): string {
  const v = x.visibility ?? "everyone";
  if (v === "everyone") return "Everyone in this space";
  if (v === "private") return x.created_by === me ? "Only you" : "Only the author";
  const names = (x.visible_to ?? []).filter((id) => id !== x.created_by).map((id) => (id === me ? "you" : nameOf(id).split(" ")[0]));
  return names.length ? `${x.created_by === me ? "You" : nameOf(x.created_by ?? "").split(" ")[0]} and ${names.join(", ")}` : "Only the author";
}

/** Picking someone in a couple or household picks their partner too. */
export function withHouseholds(ids: string[], householdOf: (id: string) => string | null, everyone: string[]): string[] {
  const out = new Set(ids);
  for (const id of ids) {
    const h = householdOf(id);
    if (!h) continue;
    for (const other of everyone) if (householdOf(other) === h) out.add(other);
  }
  return [...out];
}

// ---- Links ----------------------------------------------------------------------

export interface LinkRows {
  itinerary_items: ItineraryItem[];
  flights: Flight[];
  stays: Stay[];
  ideas: Idea[];
  list_items: ListItem[];
}

export function linkTitle(type: MemoryLink | null | undefined, id: string | null | undefined, rows: LinkRows): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "itinerary":
      return rows.itinerary_items.find((i) => i.id === id)?.title ?? null;
    case "stay":
      return rows.stays.find((s) => s.id === id)?.name ?? null;
    case "idea":
      return rows.ideas.find((i) => i.id === id)?.title ?? null;
    case "list_item":
      return rows.list_items.find((i) => i.id === id)?.title || null;
    case "flight": {
      const f = rows.flights.find((x) => x.id === id);
      return f ? transportTitle(f) : null;
    }
  }
}

export const LINK_ICONS: Record<MemoryLink, string> = { itinerary: "📅", stay: "🏨", flight: "✈️", idea: "💡", list_item: "📋" };

// ---- Photo matching and grouping ---------------------------------------------------

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const localMinutes = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const toMinutes = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

/** The day a photo belongs to: when it was taken if the camera knows, else when it was added. */
export function photoDay(p: Pick<Photo, "taken_at" | "taken_on" | "created_at">): string {
  if (p.taken_at) return localDay(p.taken_at);
  return p.taken_on ?? localDay(p.created_at);
}

/**
 * Which plan a photo was most likely taken at: same day, and either taken close by
 * (within 400 m) or during the plan's time (with an hour of slack either side).
 */
export function matchPlan(p: Pick<Photo, "taken_at" | "lat" | "lng">, plans: ItineraryItem[]): ItineraryItem | null {
  if (!p.taken_at) return null;
  const day = localDay(p.taken_at);
  const min = localMinutes(p.taken_at);
  const sameDay = plans.filter((i) => i.day === day);
  const here = hasCoords({ lat: p.lat ?? undefined, lng: p.lng ?? undefined }) ? { lat: p.lat!, lng: p.lng! } : null;
  let best: { item: ItineraryItem; score: number } | null = null;
  for (const i of sameDay) {
    const start = toMinutes(i.start_time);
    const end = toMinutes(i.end_time) ?? (start != null ? start + 120 : null);
    const inTime = start != null && end != null && min >= start - 60 && min <= end + 60;
    const loc = i.location as { lat?: number; lng?: number } | null;
    const km = here && hasCoords(loc) ? distanceKm(here, loc) : null;
    const near = km != null && km <= 0.4;
    if (!inTime && !near) continue;
    const score = (near ? 2 : 0) + (inTime ? 1 : 0) - (km ?? 0);
    if (!best || score > best.score) best = { item: i, score };
  }
  return best?.item ?? null;
}

export type PhotoGrouping = "day" | "plan" | "person" | "album";

export interface PhotoGroup {
  key: string;
  title: string;
  sub?: string;
  photos: Photo[];
}

export function groupPhotos(
  photos: Photo[],
  by: PhotoGrouping,
  ctx: { rows: LinkRows; nameOf: (id: string) => string; stayForDay: (day: string) => Stay | null },
): PhotoGroup[] {
  const groups = new Map<string, PhotoGroup>();
  const add = (key: string, title: string, sub: string | undefined, p: Photo) => {
    const g = groups.get(key) ?? { key, title, sub, photos: [] };
    g.photos.push(p);
    groups.set(key, g);
  };
  const byTime = (a: Photo, b: Photo) => (a.taken_at ?? a.created_at).localeCompare(b.taken_at ?? b.created_at);
  for (const p of [...photos].sort(byTime)) {
    if (by === "day") {
      add(photoDay(p), photoDay(p), undefined, p);
    } else if (by === "person") {
      add(p.created_by ?? "?", ctx.nameOf(p.created_by ?? ""), undefined, p);
    } else if (by === "album") {
      const a = p.album?.trim() || "";
      add(a ? `a:${a}` : "~", a || "Not in an album", undefined, p);
    } else {
      // By plan or stay: an explicit link wins, then the plan it was taken at, then where you stayed that day.
      const linked = p.linked_type && p.linked_id ? linkTitle(p.linked_type, p.linked_id, ctx.rows) : null;
      if (linked) {
        add(`${p.linked_type}:${p.linked_id}`, linked, p.linked_type === "itinerary" ? "Plan" : p.linked_type === "stay" ? "Stay" : undefined, p);
        continue;
      }
      const plan = matchPlan(p, ctx.rows.itinerary_items);
      if (plan) {
        add(`itinerary:${plan.id}`, plan.title, "Plan", p);
        continue;
      }
      const stay = ctx.stayForDay(photoDay(p));
      if (stay) add(`stay:${stay.id}`, stay.name, "Around your stay", p);
      else add("~", "Everything else", undefined, p);
    }
  }
  const out = [...groups.values()];
  // "Everything else" / "Not in an album" last; days and plans in time order.
  return out.sort((a, b) => (a.key === "~" ? 1 : b.key === "~" ? -1 : by === "day" ? a.key.localeCompare(b.key) : byTime(a.photos[0], b.photos[0])));
}
