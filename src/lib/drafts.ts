// The tentative itinerary: plans pencilled in, voted on and moved around until they're locked in.

import { distanceKm, hasCoords, type LatLng } from "./geo";
import type { ItineraryItem, PlanVote } from "./types";

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
