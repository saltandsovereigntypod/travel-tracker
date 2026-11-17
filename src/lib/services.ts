// Free, key-less outside services: place search (Photon / OpenStreetMap) and
// exchange rates (Frankfurter / European Central Bank).

import type { Place } from "./types";

export interface PlaceResult extends Place {
  id: string;
  label: string;
}

export async function searchPlaces(query: string, near?: { lat: number; lng: number } | null): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: "6", lang: "en" });
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[];
  };
  return data.features.map((f, i) => {
    const p = f.properties;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const area = [p.city ?? p.town ?? p.village, p.state, p.country].filter(Boolean).join(", ");
    const name = p.name ?? street ?? area;
    const address = [street, area].filter(Boolean).join(", ");
    return {
      id: `${p.osm_type}${p.osm_id}-${i}`,
      name,
      address,
      label: [name, address].filter(Boolean).join(" · "),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    };
  });
}

const rateCache = new Map<string, { rate: number; at: number }>();

/** Rate to convert 1 unit of `from` into `to`. Cached for 6 hours. */
export async function exchangeRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  const key = `${from}>${to}`;
  const hit = rateCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.rate;
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { rates: Record<string, number> };
    const rate = data.rates?.[to];
    if (!rate) return null;
    rateCache.set(key, { rate, at: Date.now() });
    return rate;
  } catch {
    return null;
  }
}

export const CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "JPY", "MXN", "CHF", "SEK", "NOK", "DKK",
  "ISK", "CZK", "PLN", "HUF", "TRY", "ZAR", "BRL", "INR", "KRW", "SGD", "HKD", "THB",
];

export function mapsLink(place: Place | null | undefined, fallback?: string): string | null {
  if (place?.lat != null && place?.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  const q = place?.address || place?.name || fallback;
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
