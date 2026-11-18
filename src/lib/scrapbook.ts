// The scrapbook: chapters (by day or by stay) built from plans, journal entries,
// notes and photos, plus each person's design choices. Pure, so it can be tested.

import { daysBetween, tripDays } from "./format";
import type { LatLng } from "./geo";
import { photoDay } from "./memories";
import { journeyKm } from "./transport";
import type { Flight, ItineraryItem, Note, Photo, Stay } from "./types";

export type ScrapStyle = "keepsake" | "modern" | "vintage" | "spooky" | "botanical";
export type PageSize = "letter" | "a4" | "square";

export interface ScrapbookPrefs {
  style?: ScrapStyle;
  chapters?: "day" | "stay";
  pageSize?: PageSize;
  photosPerChapter?: 4 | 8 | 0; // 0 = all
  favoritesOnly?: boolean;
  include?: { plans?: boolean; journal?: boolean; notes?: boolean; photos?: boolean; numbers?: boolean; favorites?: boolean; people?: boolean; privateToo?: boolean };
  cover?: { title?: string; subtitle?: string; photoId?: string | null };
  hidden?: string[];
}

export interface StyleDef {
  id: ScrapStyle;
  name: string;
  blurb: string;
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  heading: string;
  body: string;
  hand: string;
  frame: "polaroid" | "clean" | "taped" | "deckled";
  stickers: string[];
}

export const STYLES: StyleDef[] = [
  {
    id: "keepsake", name: "Keepsake", blurb: "Cream paper, polaroids and handwriting",
    paper: "#FBF6EC", ink: "#3B2F2A", muted: "#8A7A6E", accent: "#C0634A",
    heading: "Cormorant Garamond", body: "Lora", hand: "Caveat", frame: "polaroid", stickers: ["tape", "heart", "star"],
  },
  {
    id: "modern", name: "Modern", blurb: "Clean white pages, big photos",
    paper: "#FFFFFF", ink: "#16181D", muted: "#6B7280", accent: "#2F5BEA",
    heading: "Space Grotesk", body: "Inter", hand: "Inter", frame: "clean", stickers: [],
  },
  {
    id: "vintage", name: "Vintage travel", blurb: "Kraft paper, stamps and a typewriter",
    paper: "#E9DCC3", ink: "#3A2E22", muted: "#7A6A55", accent: "#8E3B2E",
    heading: "IM Fell English", body: "Special Elite", hand: "Special Elite", frame: "taped", stickers: ["passport-stamp", "ticket", "compass", "plane"],
  },
  {
    id: "spooky", name: "Spooky season", blurb: "Midnight pages, candlelight orange",
    paper: "#17131F", ink: "#F3E9DC", muted: "#B8A9C9", accent: "#FF7A1A",
    heading: "Cinzel", body: "Lora", hand: "Shadows Into Light", frame: "deckled", stickers: ["pumpkin", "moon", "witch-hat", "star"],
  },
  {
    id: "botanical", name: "Botanical", blurb: "Soft greens and pressed leaves",
    paper: "#F3F5EE", ink: "#2C3A2E", muted: "#6E7F6C", accent: "#5B8C51",
    heading: "Playfair Display", body: "Lora", hand: "Patrick Hand", frame: "polaroid", stickers: ["leaf", "heart"],
  },
];

export const styleOf = (id: ScrapStyle | undefined, kind?: string): StyleDef =>
  STYLES.find((s) => s.id === id) ?? (kind === "trip" ? STYLES[0] : STYLES[0]);

export const PAGE_SIZES: Record<PageSize, { label: string; css: string; ratio: number }> = {
  letter: { label: "Letter (8.5 × 11 in)", css: "8.5in 11in", ratio: 8.5 / 11 },
  a4: { label: "A4", css: "210mm 297mm", ratio: 210 / 297 },
  square: { label: "Square photo book (8 × 8 in)", css: "8in 8in", ratio: 1 },
};

export function withDefaults(p: ScrapbookPrefs | undefined): Required<Omit<ScrapbookPrefs, "cover" | "include" | "hidden">> & { cover: NonNullable<ScrapbookPrefs["cover"]>; include: Required<NonNullable<ScrapbookPrefs["include"]>>; hidden: string[] } {
  return {
    style: p?.style ?? "keepsake",
    chapters: p?.chapters ?? "day",
    pageSize: p?.pageSize ?? "letter",
    photosPerChapter: p?.photosPerChapter ?? 8,
    favoritesOnly: p?.favoritesOnly ?? false,
    include: { plans: true, journal: true, notes: true, photos: true, numbers: true, favorites: true, people: true, privateToo: false, ...(p?.include ?? {}) },
    cover: p?.cover ?? {},
    hidden: p?.hidden ?? [],
  };
}

export interface Chapter {
  key: string;
  kicker: string;
  title: string;
  sub?: string;
  plans: ItineraryItem[];
  journal: Note[];
  notes: Note[];
  photos: Photo[];
}

export interface ScrapSource {
  start: string | null;
  end: string | null;
  plans: ItineraryItem[];
  stays: Stay[];
  notes: Note[];
  photos: Photo[];
}

const isShared = (x: { visibility?: string; is_private?: boolean }) => (x.visibility ?? (x.is_private ? "private" : "everyone")) === "everyone";

/** Photos for a chapter: favorites first, then in time order, capped. */
function pickPhotos(photos: Photo[], cap: number): Photo[] {
  const sorted = [...photos].sort((a, b) => Number(b.favorite) - Number(a.favorite) || (a.taken_at ?? a.created_at).localeCompare(b.taken_at ?? b.created_at));
  const picked = cap ? sorted.slice(0, cap) : sorted;
  // Back into time order so the page reads like the day did.
  return picked.sort((a, b) => (a.taken_at ?? a.created_at).localeCompare(b.taken_at ?? b.created_at));
}

export function buildChapters(src: ScrapSource, prefsIn: ScrapbookPrefs | undefined): Chapter[] {
  const prefs = withDefaults(prefsIn);
  const hidden = new Set(prefs.hidden);
  const ok = <T extends { id: string; visibility?: string; is_private?: boolean }>(x: T) => !hidden.has(x.id) && (prefs.include.privateToo || isShared(x));
  const photos = src.photos.filter((p) => ok(p) && (!prefs.favoritesOnly || p.favorite));
  const journal = src.notes.filter((n) => n.kind === "journal" && ok(n) && (n.body.trim() || n.title.trim()));
  const notes = src.notes.filter((n) => n.kind === "note" && ok(n) && n.linked_type && n.linked_id && (n.body.trim() || n.title.trim()));
  const plans = src.plans.filter((p) => p.day);

  const sortPlans = (l: ItineraryItem[]) => [...l].sort((a, b) => (a.day! + (a.start_time ?? "99")).localeCompare(b.day! + (b.start_time ?? "99")));
  const notesFor = (ids: Set<string>, stayIds: Set<string>) =>
    notes.filter((n) => (n.linked_type === "itinerary" && ids.has(n.linked_id!)) || (n.linked_type === "stay" && stayIds.has(n.linked_id!)));

  // Every day that has something, inside the trip dates or not.
  const contentDays = new Set<string>([
    ...plans.map((p) => p.day!),
    ...journal.map((j) => j.entry_date).filter((d): d is string => !!d),
    ...photos.map((p) => photoDay(p)),
  ]);
  const tripDayList = tripDays(src.start, src.end);
  const allDays = [...new Set([...tripDayList, ...contentDays])].sort();

  const chapters: Chapter[] = [];
  if (prefs.chapters === "stay" && src.stays.some((s) => s.status === "booked" && s.check_in && s.check_out)) {
    const stays = src.stays.filter((s) => s.status === "booked" && s.check_in && s.check_out).sort((a, b) => a.check_in!.localeCompare(b.check_in!));
    const covered = new Set<string>();
    stays.forEach((s, i) => {
      const days = allDays.filter((d) => d >= s.check_in! && d < s.check_out!);
      days.forEach((d) => covered.add(d));
      const ps = sortPlans(plans.filter((p) => days.includes(p.day!)));
      const nights = daysBetween(s.check_in!, s.check_out!);
      chapters.push({
        key: `stay:${s.id}`,
        kicker: `Chapter ${i + 1}`,
        title: s.name,
        sub: `${nights} night${nights === 1 ? "" : "s"}`,
        plans: ps,
        journal: journal.filter((j) => j.entry_date && days.includes(j.entry_date)),
        notes: notesFor(new Set(ps.map((p) => p.id)), new Set([s.id])),
        photos: pickPhotos(photos.filter((p) => days.includes(photoDay(p)) || (p.linked_type === "stay" && p.linked_id === s.id)), prefs.photosPerChapter),
      });
    });
    const rest = allDays.filter((d) => !covered.has(d) && contentDays.has(d));
    if (rest.length) {
      const ps = sortPlans(plans.filter((p) => rest.includes(p.day!)));
      chapters.push({
        key: "rest",
        kicker: "And also",
        title: "Along the way",
        plans: ps,
        journal: journal.filter((j) => j.entry_date && rest.includes(j.entry_date)),
        notes: notesFor(new Set(ps.map((p) => p.id)), new Set()),
        photos: pickPhotos(photos.filter((p) => rest.includes(photoDay(p))), prefs.photosPerChapter),
      });
    }
  } else {
    for (const d of allDays) {
      if (!contentDays.has(d)) continue;
      const ps = sortPlans(plans.filter((p) => p.day === d));
      const idx = tripDayList.indexOf(d);
      const stay = src.stays.find((s) => s.status === "booked" && s.check_in && s.check_out && s.check_in <= d && d < s.check_out);
      chapters.push({
        key: d,
        kicker: idx >= 0 ? `Day ${idx + 1}` : "",
        title: d,
        sub: stay?.name,
        plans: ps,
        journal: journal.filter((j) => j.entry_date === d),
        notes: notesFor(new Set(ps.map((p) => p.id)), new Set(stay ? [stay.id] : [])),
        photos: pickPhotos(photos.filter((p) => photoDay(p) === d), prefs.photosPerChapter),
      });
    }
  }
  // Journal entries with no date get their own page at the end.
  const undated = journal.filter((j) => !j.entry_date);
  if (undated.length) chapters.push({ key: "undated", kicker: "Journal", title: "More memories", plans: [], journal: undated, notes: [], photos: [] });
  return chapters.filter((c) => c.plans.length || c.journal.length || c.notes.length || c.photos.length);
}

/** How a chapter's photos are laid out. */
export function collage(n: number): "none" | "hero" | "duo" | "trio" | "quad" | "mosaic" {
  if (n <= 0) return "none";
  if (n === 1) return "hero";
  if (n === 2) return "duo";
  if (n === 3) return "trio";
  if (n === 4) return "quad";
  return "mosaic";
}

export interface Numbers {
  days: number;
  nights: number;
  plans: number;
  photos: number;
  entries: number;
  milesFlown: number | null;
  /** Trains, buses, ferries, cars and rides. */
  milesOverland: number | null;
  places: number;
}

export function tripNumbers(
  src: ScrapSource & { flights: Flight[] },
  airport: (code: string) => LatLng | null,
): Numbers {
  const days = src.start && src.end ? daysBetween(src.start, src.end) + 1 : new Set(src.plans.map((p) => p.day).filter(Boolean)).size;
  const nights = src.stays.filter((s) => s.status === "booked" && s.check_in && s.check_out).reduce((n, s) => n + daysBetween(s.check_in!, s.check_out!), 0);
  let km = 0;
  let any = false;
  let ground = 0;
  for (const f of src.flights) {
    if (f.status !== "booked") continue;
    // Through every layover or stop on the way.
    const d = journeyKm(f, airport);
    if (d == null) continue;
    if ((f.mode ?? "flight") === "flight") {
      km += d;
      any = true;
    } else {
      ground += d;
    }
  }
  const places = new Set(
    src.plans
      .map((p) => p.location as { lat?: number; lng?: number; name?: string } | null)
      .filter((l) => l && (l.name || l.lat != null))
      .map((l) => l!.name || `${l!.lat?.toFixed(3)},${l!.lng?.toFixed(3)}`),
  ).size;
  return {
    days,
    nights,
    plans: src.plans.filter((p) => p.day).length,
    photos: src.photos.length,
    entries: src.notes.filter((n) => n.kind === "journal").length,
    milesFlown: any ? Math.round(km * 0.621371) : null,
    milesOverland: ground >= 1 ? Math.round(ground * 0.621371) : null,
    places,
  };
}
