// The tentative itinerary: plans pencilled in, voted on and moved around until they're locked in.

import { distanceKm, hasCoords, type LatLng } from "./geo";
import type { DayVersion, DayVersionVote, ItineraryItem, PlanVote } from "./types";

export interface PlanTally {
  up: number;
  down: number;
  mine: 1 | -1 | 0;
  /** People going who liked it (they're the ones who count toward locking in). */
  upFromGoing: number;
  likers: string[];
}

export function tallyPlan(votes: PlanVote[], itemId: string, me: string, going: string[]): PlanTally {
  const mineVotes = votes.filter((v) => v.item_id === itemId);
  const up = mineVotes.filter((v) => v.value === 1);
  return {
    up: up.length,
    down: mineVotes.filter((v) => v.value === -1).length,
    mine: (mineVotes.find((v) => v.user_id === me)?.value ?? 0) as 1 | -1 | 0,
    upFromGoing: up.filter((v) => going.includes(v.user_id)).length,
    likers: up.map((v) => v.user_id),
  };
}

/** Most people going like it (needs at least two people going, matching the database rule). */
export function hasMajority(upFromGoing: number, goingCount: number): boolean {
  return goingCount >= 2 && upFromGoing * 2 > goingCount;
}

/** How many more 👍 a plan needs to lock itself in. */
export function likesToLock(upFromGoing: number, goingCount: number): number | null {
  if (goingCount < 2) return null;
  return Math.max(0, Math.floor(goingCount / 2) + 1 - upFromGoing);
}

export interface DaySummary {
  plans: number;
  drafts: number;
  /** Minutes of plans with start and end times. */
  minutes: number;
  cost: number;
  /** Straight-line hops between plans with places, in order. */
  km: number;
  /** Plans overlapping in time. */
  clashes: number;
}

const toMin = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

/** A quick read of how full a day is. `costOf` gives each plan's total (or null). */
export function summarizeDay(items: ItineraryItem[], costOf: (i: ItineraryItem) => number | null = () => null): DaySummary {
  let minutes = 0;
  let cost = 0;
  let km = 0;
  let prev: LatLng | null = null;
  const timed: [number, number][] = [];
  for (const i of items) {
    const a = toMin(i.start_time);
    const b = toMin(i.end_time);
    if (a != null && b != null && b > a) {
      minutes += b - a;
      timed.push([a, b]);
    }
    cost += costOf(i) ?? 0;
    const here = hasCoords(i.location) ? { lat: i.location.lat!, lng: i.location.lng! } : null;
    if (here && prev) km += distanceKm(prev, here);
    if (here) prev = here;
  }
  timed.sort((x, y) => x[0] - y[0]);
  let clashes = 0;
  for (let k = 1; k < timed.length; k++) if (timed[k][0] < timed[k - 1][1]) clashes++;
  return { plans: items.length, drafts: items.filter((i) => i.draft).length, minutes, cost, km, clashes };
}

/** Plans to lock in on a day (or everywhere when day is undefined). */
export function draftsOn(items: ItineraryItem[], day?: string | null): ItineraryItem[] {
  return items.filter((i) => i.draft && (day === undefined || i.day === day));
}

/** Plans that are set: what Today, reminders and the share page use. */
export const finalOnly = <T extends { draft?: boolean }>(items: T[]): T[] => items.filter((i) => !i.draft);

// ---- Versions of a day ---------------------------------------------------------

/** A day's versions in order; the first one holds the day's pencilled-in plans that aren't in any version. */
export function versionsOn(versions: DayVersion[], day: string | null): DayVersion[] {
  if (!day) return [];
  return versions.filter((v) => v.day === day).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

/** "A", "B", … "Z", then "27". */
export const versionLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String(i + 1));

/**
 * What a day looks like in one version: everything locked in (shared by all versions), plus that
 * version's pencilled-in plans. The first version also has drafts that aren't in any version.
 */
export function itemsInVersion(items: ItineraryItem[], versions: DayVersion[], versionId: string): ItineraryItem[] {
  if (!versions.length) return items;
  const ids = new Set(versions.map((v) => v.id));
  const first = versions[0].id;
  return items.filter((i) => {
    if (!i.draft) return true;
    const own = i.version_id && ids.has(i.version_id) ? i.version_id : first;
    return own === versionId;
  });
}

export interface VersionTally {
  counts: Record<string, number>;
  mine: string | null;
  /** The version most people going picked, if any has a majority. */
  winner: string | null;
}

export function tallyVersions(votes: DayVersionVote[], day: string, me: string, going: string[]): VersionTally {
  const today = votes.filter((v) => v.day === day);
  const counts: Record<string, number> = {};
  for (const v of today) if (going.includes(v.user_id)) counts[v.version_id] = (counts[v.version_id] ?? 0) + 1;
  const winner = Object.entries(counts).find(([, n]) => hasMajority(n, going.length))?.[0] ?? null;
  return { counts, mine: today.find((v) => v.user_id === me)?.version_id ?? null, winner };
}
