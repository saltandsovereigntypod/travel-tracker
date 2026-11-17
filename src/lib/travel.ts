// Travel logic: unbooked options you're comparing, where you're sleeping each night,
// which airport goes with which stay, and how well each place to stay fits your plans.

import { addDays } from "./format";
import { centroid, distanceKm, hasCoords, spread, type LatLng } from "./geo";
import type { Flight, Stay } from "./types";

// ---- Options you're comparing --------------------------------------------

const routeOf = (f: Pick<Flight, "from_code" | "from_name" | "to_code" | "to_name">) =>
  `${(f.from_code || f.from_name || "?").trim().toUpperCase()} → ${(f.to_code || f.to_name || "?").trim().toUpperCase()}`;

/** Flights compete when they share a group name, or else the same route. */
export function flightOptionKey(f: Pick<Flight, "option_group" | "from_code" | "from_name" | "to_code" | "to_name">): string {
  return f.option_group?.trim() || routeOf(f);
}

/** Stays compete when they share a group name, or else the same dates. */
export function stayOptionKey(s: Pick<Stay, "option_group" | "check_in" | "check_out">): string {
  return s.option_group?.trim() || (s.check_in && s.check_out ? `${s.check_in} → ${s.check_out}` : s.check_in || "Anytime");
}

export interface OptionGroup<T> {
  key: string;
  /** Not-yet-booked options, cheapest first (unpriced last). */
  options: T[];
  booked: T[];
  cheapest: T | null;
  cheapestTotal: number | null;
}

export function optionGroups<T extends { id: string; status: string }>(items: T[], keyOf: (t: T) => string, totalOf: (t: T) => number | null): OptionGroup<T>[] {
  const map = new Map<string, OptionGroup<T>>();
  for (const it of items) {
    if (it.status === "cancelled") continue;
    const key = keyOf(it);
    const g = map.get(key) ?? { key, options: [], booked: [], cheapest: null, cheapestTotal: null };
    (it.status === "booked" ? g.booked : g.options).push(it);
    map.set(key, g);
  }
  for (const g of map.values()) {
    g.options.sort((a, b) => (totalOf(a) ?? Infinity) - (totalOf(b) ?? Infinity));
    const first = g.options.find((o) => totalOf(o) != null) ?? null;
    g.cheapest = first;
    g.cheapestTotal = first ? totalOf(first) : null;
  }
  return [...map.values()];
}

/**
 * What's likely still to come: for every group with nothing booked yet, the cheapest
 * option. Alternatives to something already booked don't count, and nothing is double counted.
 */
export function estimatedFromOptions<T extends { id: string; status: string }>(groups: OptionGroup<T>[]): number {
  return groups.filter((g) => !g.booked.length).reduce((n, g) => n + (g.cheapestTotal ?? 0), 0);
}

// ---- Nights and airports ---------------------------------------------------

/** Where you're sleeping on the night of `day` (booked wins over options). */
export function stayForNight<S extends Pick<Stay, "status" | "check_in" | "check_out">>(stays: S[], day: string): S | null {
  const hits = stays.filter((s) => s.status !== "cancelled" && s.check_in && s.check_out && s.check_in <= day && day < s.check_out);
  return hits.find((s) => s.status === "booked") ?? hits[0] ?? null;
}

/** Same, but the morning after the last night still counts (checkout day plans start from there). */
export function stayForDay<S extends Pick<Stay, "status" | "check_in" | "check_out">>(stays: S[], day: string): S | null {
  return stayForNight(stays, day) ?? stayForNight(stays, addDays(day, -1));
}

const dayOf = (ts: string | null) => (ts ? ts.slice(0, 10) : null);

/** The airport you land at for a stay: flights arriving within two days before check-in, else your usual arrival airport. */
export function arrivalAirportFor(flights: Flight[], stay: Pick<Stay, "check_in">): string | null {
  const live = flights.filter((f) => f.status !== "cancelled" && (f.to_code || "").trim());
  if (stay.check_in) {
    const near = live
      .map((f) => ({ f, d: dayOf(f.arrive_local) ?? dayOf(f.depart_local) }))
      .filter((x) => x.d && x.d <= stay.check_in! && x.d >= addDays(stay.check_in!, -2))
      .sort((a, b) => (b.d! < a.d! ? -1 : 1));
    const booked = near.find((x) => x.f.status === "booked");
    const hit = booked ?? near[0];
    if (hit) return hit.f.to_code.trim().toUpperCase();
  }
  return mostCommon(live.map((f) => f.to_code.trim().toUpperCase()));
}

/** The airport you leave from: flights departing on or the day after check-out, else the one you arrived at. */
export function departureAirportFor(flights: Flight[], stay: Pick<Stay, "check_in" | "check_out">): string | null {
  const live = flights.filter((f) => f.status !== "cancelled" && (f.from_code || "").trim());
  if (stay.check_out) {
    const near = live.filter((f) => {
      const d = dayOf(f.depart_local);
      return d && d >= stay.check_out! && d <= addDays(stay.check_out!, 1);
    });
    const hit = near.find((f) => f.status === "booked") ?? near[0];
    if (hit) return hit.from_code.trim().toUpperCase();
  }
  return null;
}

function mostCommon(xs: string[]): string | null {
  const c = new Map<string, number>();
  for (const x of xs) if (x) c.set(x, (c.get(x) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of c) if (v > n) [best, n] = [k, v];
  return best;
}

// ---- Where to stay -----------------------------------------------------------

export interface PlanPoint extends LatLng {
  day: string | null;
  weight: number;
  title: string;
}

export interface SweetSpot {
  center: LatLng;
  radiusKm: number;
  /** Plans counted. */
  count: number;
  /** Far-off plans left out (a day trip shouldn't drag the center away). */
  outliers: number;
}

/** The sweet spot: the weighted center of what you plan to do, ignoring far-off day trips. */
export function sweetSpot(points: PlanPoint[]): SweetSpot | null {
  let pts = points.filter(hasCoords);
  if (!pts.length) return null;
  const all = pts.length;
  let center = centroid(pts)!;
  if (pts.length >= 3) {
    // Start from the most central plan (an outlier can't drag that), not the average.
    center = pts.reduce(
      (best, p) => {
        const sum = pts.reduce((n, q) => n + distanceKm(p, q), 0);
        return sum < best.sum ? { p, sum } : best;
      },
      { p: pts[0], sum: Infinity },
    ).p;
    // Drop points much farther out than the typical one, then re-center (twice is plenty).
    for (let pass = 0; pass < 2; pass++) {
      const d = pts.map((p) => distanceKm(center, p));
      const sorted = [...d].sort((x, y) => x - y);
      const median = sorted[Math.floor(sorted.length / 2)];
      const keep = pts.filter((_, i) => d[i] <= Math.max(3 * median, 3));
      if (keep.length === pts.length || keep.length < 2) break;
      pts = keep;
      center = centroid(pts)!;
    }
  }
  center = centroid(pts)!;
  return { center, radiusKm: Math.max(0.8, spread(center, pts)), count: pts.length, outliers: all - pts.length };
}

export interface StayPeriod {
  checkIn: string | null;
  checkOut: string | null;
  spot: SweetSpot;
}

/**
 * One sweet spot per stretch of the trip you're sleeping somewhere (from your stays' dates),
 * using only the plans on those days. Without dated stays, one for the whole trip.
 */
export function stayPeriods(stays: Pick<Stay, "status" | "check_in" | "check_out">[], points: PlanPoint[], trip: { start: string | null; end: string | null }): StayPeriod[] {
  const ranges = new Map<string, [string, string]>();
  for (const s of stays) if (s.status !== "cancelled" && s.check_in && s.check_out) ranges.set(`${s.check_in}|${s.check_out}`, [s.check_in, s.check_out]);
  const out: StayPeriod[] = [];
  for (const [ci, co] of [...ranges.values()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const spot = sweetSpot(points.filter((p) => p.day && p.day >= ci && p.day <= co));
    if (spot) out.push({ checkIn: ci, checkOut: co, spot });
  }
  if (!out.length) {
    const spot = sweetSpot(points);
    if (spot) out.push({ checkIn: trip.start, checkOut: trip.end, spot });
  }
  return out;
}

export interface StayFit<S> {
  stay: S;
  /** Average straight-line km to the plans during this stay (or all plans if undated). */
  avgKm: number | null;
  /** How many plans that average covers. */
  plans: number;
  perNight: number | null;
  /** Lower is better. */
  score: number | null;
  best: boolean;
}

/**
 * Rank places to stay by how close they are to your plans and how much they cost per night.
 * Distance counts a bit more than price (60/40), both relative to the best option.
 */
export function rankStays<S extends Pick<Stay, "id" | "status" | "check_in" | "check_out" | "location">>(
  stays: S[],
  points: PlanPoint[],
  perNightOf: (s: S) => number | null,
): StayFit<S>[] {
  const fits: StayFit<S>[] = stays
    .filter((s) => s.status !== "cancelled")
    .map((s) => {
      const loc = s.location as Partial<LatLng> | null;
      if (!hasCoords(loc)) return { stay: s, avgKm: null, plans: 0, perNight: perNightOf(s), score: null, best: false };
      const during = s.check_in && s.check_out ? points.filter((p) => p.day && p.day >= s.check_in! && p.day <= s.check_out!) : [];
      const use = during.length ? during : points;
      const totalW = use.reduce((n, p) => n + p.weight, 0);
      const avgKm = use.length ? use.reduce((n, p) => n + distanceKm(loc, p) * p.weight, 0) / totalW : null;
      return { stay: s, avgKm, plans: use.length, perNight: perNightOf(s), score: null, best: false };
    });
  const minKm = Math.min(...fits.map((f) => f.avgKm ?? Infinity));
  const minPrice = Math.min(...fits.map((f) => (f.perNight && f.perNight > 0 ? f.perNight : Infinity)));
  for (const f of fits) {
    if (f.avgKm == null && f.perNight == null) continue;
    // Within a few hundred metres everything is "close", so don't over-reward tiny differences.
    const d = f.avgKm == null || !Number.isFinite(minKm) ? 1.5 : Math.max(f.avgKm, 0.4) / Math.max(minKm, 0.4);
    const p = f.perNight == null || !Number.isFinite(minPrice) ? 1.5 : f.perNight / minPrice;
    f.score = 0.6 * d + 0.4 * p;
  }
  const scored = fits.filter((f) => f.score != null && f.stay.status !== "booked");
  if (scored.length > 1) scored.reduce((a, b) => (b.score! < a.score! ? b : a)).best = true;
  return fits.sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
}

// ---- Search links ----------------------------------------------------------------

export interface SearchArea {
  center: LatLng;
  radiusKm: number;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number;
}

function box(a: SearchArea) {
  const dLat = Math.max(a.radiusKm, 1) / 111;
  const dLng = dLat / Math.max(0.2, Math.cos((a.center.lat * Math.PI) / 180));
  return { ne_lat: a.center.lat + dLat, ne_lng: a.center.lng + dLng, sw_lat: a.center.lat - dLat, sw_lng: a.center.lng - dLng };
}

/** Search pages already centered on the sweet spot for your dates. */
export function staySearchLinks(a: SearchArea): { label: string; href: string }[] {
  const b = box(a);
  const f = (n: number) => n.toFixed(5);
  const air = new URLSearchParams({
    search_by_map: "true",
    ne_lat: f(b.ne_lat),
    ne_lng: f(b.ne_lng),
    sw_lat: f(b.sw_lat),
    sw_lng: f(b.sw_lng),
    ...(a.checkIn ? { checkin: a.checkIn } : {}),
    ...(a.checkOut ? { checkout: a.checkOut } : {}),
    ...(a.guests ? { adults: String(a.guests) } : {}),
  });
  const booking = new URLSearchParams({
    latitude: f(a.center.lat),
    longitude: f(a.center.lng),
    dest_type: "latlong",
    ...(a.checkIn ? { checkin: a.checkIn } : {}),
    ...(a.checkOut ? { checkout: a.checkOut } : {}),
    ...(a.guests ? { group_adults: String(a.guests) } : {}),
  });
  const zoom = a.radiusKm < 2 ? 15 : a.radiusKm < 6 ? 14 : a.radiusKm < 15 ? 12 : 11;
  return [
    { label: "Airbnb", href: `https://www.airbnb.com/s/homes?${air}` },
    { label: "Booking.com", href: `https://www.booking.com/searchresults.html?${booking}` },
    { label: "Google Hotels", href: `https://www.google.com/maps/search/hotels/@${f(a.center.lat)},${f(a.center.lng)},${zoom}z` },
  ];
}

// ---- Grouping flights --------------------------------------------------------------

export type FlightLeg = "out" | "return" | "during";

/**
 * Outbound, return or in between, worked out per person: each person's first flight
 * is their flight out, their last is their flight home, anything else is during the trip.
 * Flights with nobody on them use the whole group's order.
 */
export function flightLegs(flights: Pick<Flight, "id" | "status" | "depart_local" | "travelers">[]): Record<string, FlightLeg> {
  const live = flights.filter((f) => f.status !== "cancelled").sort((a, b) => (a.depart_local ?? "9999").localeCompare(b.depart_local ?? "9999"));
  const legFor = (seq: { id: string }[], id: string): FlightLeg => {
    const i = seq.findIndex((f) => f.id === id);
    if (i === 0) return "out";
    if (i === seq.length - 1 && seq.length > 1) return "return";
    return "during";
  };
  const out: Record<string, FlightLeg> = {};
  for (const f of flights) {
    const who = f.travelers?.[0];
    const seq = who ? live.filter((x) => x.travelers?.includes(who)) : live;
    out[f.id] = f.status === "cancelled" ? "during" : legFor(seq, f.id);
  }
  return out;
}

export interface FlightGroup<F> {
  key: string;
  title: string;
  flights: F[];
}

export function groupFlights<F extends Pick<Flight, "id" | "status" | "depart_local" | "travelers">>(
  flights: F[],
  by: string,
  nameOf: (id: string) => string,
): FlightGroup<F>[] {
  if (by === "direction") {
    const legs = flightLegs(flights);
    const order: [FlightLeg, string][] = [["out", "Flights out"], ["during", "During the trip"], ["return", "Flights home"]];
    return order.map(([k, title]) => ({ key: k, title, flights: flights.filter((f) => legs[f.id] === k) })).filter((g) => g.flights.length);
  }
  if (by === "person") {
    const people = [...new Set(flights.flatMap((f) => f.travelers))];
    const groups = people.map((p) => ({ key: p, title: nameOf(p), flights: flights.filter((f) => f.travelers.includes(p)) }));
    const nobody = flights.filter((f) => !f.travelers.length);
    if (nobody.length) groups.push({ key: "~", title: "Nobody added yet", flights: nobody });
    return groups.sort((a, b) => (a.key === "~" ? 1 : b.key === "~" ? -1 : a.title.localeCompare(b.title)));
  }
  return [{ key: "all", title: "", flights }];
}
