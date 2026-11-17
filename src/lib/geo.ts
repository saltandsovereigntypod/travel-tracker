// Distances and travel-time estimates. Pure helpers, no network.
// Straight-line distance is exact; travel times are honest estimates (labelled "~")
// with a link to real directions. Real drive times can be fetched on demand (routes.ts).

export interface LatLng {
  lat: number;
  lng: number;
}

export const hasCoords = (p: Partial<LatLng> | null | undefined): p is LatLng =>
  !!p && typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Miles in the US, UK, Liberia and Myanmar; kilometres everywhere else. */
export function usesMiles(locale = typeof navigator === "undefined" ? "en-US" : navigator.language): boolean {
  const region = locale.split("-")[1]?.toUpperCase();
  return !region || ["US", "GB", "LR", "MM"].includes(region);
}

export function formatDistance(km: number, miles = usesMiles()): string {
  if (miles) {
    const mi = km * 0.621371;
    if (mi < 0.1) return `${Math.max(50, Math.round((mi * 5280) / 50) * 50)} ft`;
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export interface TravelEstimate {
  mode: "walk" | "drive";
  minutes: number;
}

/**
 * A rough door-to-door estimate from straight-line distance: roads wind, so distance
 * is stretched ~30%; walking ~4.8 km/h; driving slower in town than on highways.
 */
export function estimateTravel(km: number): TravelEstimate {
  const road = km * 1.3;
  if (km <= 1.5) return { mode: "walk", minutes: Math.max(1, Math.round((road / 4.8) * 60)) };
  const speed = road < 10 ? 28 : road < 40 ? 45 : 70;
  return { mode: "drive", minutes: Math.max(3, Math.round((road / speed) * 60 + 4)) };
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function travelLabel(km: number, miles?: boolean): string {
  const t = estimateTravel(km);
  return `${formatDistance(km, miles)} · ~${formatMinutes(t.minutes)} ${t.mode === "walk" ? "walk" : "drive"}`;
}

/** Directions in Google Maps (opens the app on phones). */
export function directionsLink(from: LatLng, to: LatLng, mode: "walking" | "driving" | "transit" = "driving"): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${mode}`;
}

/** Weighted center of a set of points (weights default to 1). */
export function centroid(points: (LatLng & { weight?: number })[]): LatLng | null {
  let w = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const wt = p.weight ?? 1;
    if (!(wt > 0)) continue;
    const la = (p.lat * Math.PI) / 180;
    const lo = (p.lng * Math.PI) / 180;
    x += Math.cos(la) * Math.cos(lo) * wt;
    y += Math.cos(la) * Math.sin(lo) * wt;
    z += Math.sin(la) * wt;
    w += wt;
  }
  if (!w) return null;
  x /= w;
  y /= w;
  z /= w;
  return { lat: (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI, lng: (Math.atan2(y, x) * 180) / Math.PI };
}

/** Radius (km) that holds `share` of the points around a center: the "sweet spot" for staying. */
export function spread(center: LatLng, points: LatLng[], share = 0.75): number {
  if (!points.length) return 0;
  const d = points.map((p) => distanceKm(center, p)).sort((a, b) => a - b);
  return d[Math.min(d.length - 1, Math.max(0, Math.ceil(d.length * share) - 1))];
}

// ---- Airports ------------------------------------------------------------

export interface Airport extends LatLng {
  code: string;
  name: string;
  city: string;
  country: string;
}

type AirportRow = [string, string, string, string, number, number];

let airportsPromise: Promise<Map<string, Airport>> | null = null;

/** Commercial airports from OurAirports (public domain), loaded once on demand. */
export function loadAirports(): Promise<Map<string, Airport>> {
  airportsPromise ??= fetch("/data/airports.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((rows: AirportRow[]) => new Map(rows.map(([code, name, city, country, lat, lng]) => [code, { code, name, city, country, lat, lng }])))
    .catch(() => {
      airportsPromise = null;
      return new Map();
    });
  return airportsPromise;
}

/** Search by code, city or name, codes first. */
export function searchAirports(all: Map<string, Airport>, q: string, limit = 8): Airport[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const exact = all.get(s.toUpperCase());
  const out: Airport[] = exact ? [exact] : [];
  for (const a of all.values()) {
    if (out.length >= limit) break;
    if (a === exact) continue;
    if (a.code.toLowerCase().startsWith(s) || a.city.toLowerCase().startsWith(s)) out.push(a);
  }
  for (const a of all.values()) {
    if (out.length >= limit) break;
    if (!out.includes(a) && (a.name.toLowerCase().includes(s) || a.city.toLowerCase().includes(s))) out.push(a);
  }
  return out;
}
