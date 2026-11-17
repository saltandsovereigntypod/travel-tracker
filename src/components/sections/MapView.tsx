"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Segmented } from "../ui/Fields";
import { categoryOf, stayKindOf } from "@/lib/categories";
import { formatDay, formatTime, tripDays } from "@/lib/format";
import { itemsForDay } from "./Itinerary";
import { mapEntries } from "@/lib/fields";
import { useTravel } from "../travel/useTravel";
import { stayForDay } from "@/lib/travel";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

interface Pin {
  id: string;
  lat: number;
  lng: number;
  emoji: string;
  color: string;
  title: string;
  sub: string;
  layer: "plan" | "idea" | "stay" | "list" | "airport";
}

/** A circle as a polygon (for the "where to stay" sweet spot). */
function circle(lat: number, lng: number, km: number, steps = 64): [number, number][] {
  const out: [number, number][] = [];
  const dLat = km / 111;
  const dLng = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    out.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return out;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function MapSection({ compact = false, height }: { compact?: boolean; height?: number }) {
  const { rows, trip } = useTrip();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState<string>("all");
  const [layers, setLayers] = useState({ plan: true, idea: true, stay: true, list: true, spot: false });
  const travel = useTravel();
  // Opened from "See it on the map" on the Stays page.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("spot")) queueMicrotask(() => setLayers((l) => ({ ...l, spot: true })));
  }, []);
  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null);

  const tripLat = trip?.lat;
  const tripLng = trip?.lng;
  const pins = useMemo<Pin[]>(() => {
    const out: Pin[] = [];
    const items = day === "all" ? rows.itinerary_items : itemsForDay(rows.itinerary_items, day);
    if (layers.plan) {
      for (const i of items) {
        if (i.location?.lat == null || i.location?.lng == null) continue;
        const from = travel.fromStay(i);
        out.push({ id: `p${i.id}`, lat: i.location.lat, lng: i.location.lng, emoji: categoryOf(i.category).emoji, color: "var(--accent)", title: i.title, sub: [i.day ? formatDay(i.day) : "Unscheduled", formatTime(i.start_time), from && `${from.label} from ${from.stay.name}`].filter(Boolean).join(" · "), layer: "plan" });
      }
    }
    if (layers.idea && day === "all") {
      for (const i of rows.ideas) {
        if (i.status === "planned" || i.status === "passed" || i.location?.lat == null || i.location?.lng == null) continue;
        out.push({ id: `i${i.id}`, lat: i.location.lat, lng: i.location.lng, emoji: "💡", color: "var(--accent2)", title: i.title, sub: "Idea", layer: "idea" });
      }
    }
    if (layers.stay) {
      for (const s of rows.stays) {
        if (s.status === "cancelled" || s.location?.lat == null || s.location?.lng == null) continue;
        if (day !== "all" && !(s.check_in && s.check_out && day >= s.check_in && day <= s.check_out)) continue;
        out.push({ id: `s${s.id}`, lat: s.location.lat, lng: s.location.lng, emoji: stayKindOf(s.kind).emoji, color: "#2F4A3A", title: s.name, sub: `${formatDay(s.check_in)} – ${formatDay(s.check_out)}`, layer: "stay" });
      }
    }
    if (layers.stay) {
      // Airports you fly into or out of.
      const codes = new Set(rows.flights.filter((f) => f.status !== "cancelled").flatMap((f) => [f.from_code, f.to_code]).map((c) => c?.trim().toUpperCase()).filter(Boolean));
      for (const c of codes) {
        const a = travel.airport(c);
        if (!a) continue;
        if (tripLat != null && tripLng != null && Math.abs(a.lat - tripLat) + Math.abs(a.lng - tripLng) > 6) continue; // skip home airports far away
        out.push({ id: `a${c}`, lat: a.lat, lng: a.lng, emoji: "✈️", color: "#3D5A80", title: `${a.code} · ${a.city}`, sub: a.name, layer: "airport" });
      }
    }
    if (layers.list) {
      // Places from any custom list (restaurants, venues, vendors…).
      for (const e of mapEntries({ lists: rows.lists, items: rows.list_items })) {
        out.push({ id: `l${e.item.id}${e.field.id}`, lat: e.place.lat!, lng: e.place.lng!, emoji: e.list.icon, color: "#6D597A", title: e.item.title || "Untitled", sub: `${e.list.name} · ${e.field.name}`, layer: "list" });
      }
    }
    return out;
  }, [rows.itinerary_items, rows.ideas, rows.stays, rows.lists, rows.list_items, rows.flights, day, layers, travel, tripLat, tripLng]);

  // Lines from where you're staying to that day's plans.
  const spokes = useMemo(() => {
    if (day === "all" || !layers.stay) return null;
    const s = stayForDay(rows.stays, day);
    if (s?.location?.lat == null || s.location.lng == null) return null;
    const lines = itemsForDay(rows.itinerary_items, day)
      .filter((i) => i.location?.lat != null && i.location?.lng != null)
      .map((i) => [[s.location.lng!, s.location.lat!], [i.location.lng!, i.location.lat!]]);
    return lines.length ? lines : null;
  }, [rows.stays, rows.itinerary_items, day, layers.stay]);
  const spots = layers.spot ? travel.periods.map((p) => p.spot) : null;

  // Route line for a single day, in itinerary order.
  const route = useMemo(() => {
    if (day === "all") return null;
    const pts = itemsForDay(rows.itinerary_items, day)
      .filter((i) => i.location?.lat != null && i.location?.lng != null)
      .map((i) => [i.location.lng!, i.location.lat!]);
    return pts.length > 1 ? pts : null;
  }, [rows.itinerary_items, day]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      if (cancelled || !box.current || map.current) return;
      const center: [number, number] = trip?.lng != null && trip?.lat != null ? [trip.lng, trip.lat] : [-98.5, 39.8];
      const m = new maplibre.Map({ container: box.current, style: STYLE, center, zoom: trip?.lat != null ? 12 : 3, attributionControl: { compact: true } });
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => !cancelled && setReady(true));
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [trip?.lat, trip?.lng]);

  useEffect(() => {
    if (!ready || !map.current) return;
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !map.current) return;
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      const accent = getComputedStyle(box.current!).getPropertyValue("--accent").trim() || "#E07A5F";
      for (const p of pins) {
        const el = document.createElement("div");
        el.className = "map-pin";
        el.style.background = p.color.startsWith("var(") ? getComputedStyle(box.current!).getPropertyValue(p.color.slice(4, -1)).trim() : p.color;
        el.innerHTML = `<span>${p.emoji}</span>`;
        const popup = new maplibre.Popup({ offset: 22, closeButton: false }).setHTML(`<strong>${esc(p.title)}</strong><br/><span style="color:#666;font-size:12px">${esc(p.sub)}</span>`);
        markers.current.push(new maplibre.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map.current));
      }
      const m = map.current;
      if (m.getLayer("route")) m.removeLayer("route");
      if (m.getSource("route")) m.removeSource("route");
      for (const id of ["spokes", "spot-fill", "spot-line"]) if (m.getLayer(id)) m.removeLayer(id);
      for (const id of ["spokes", "spot"]) if (m.getSource(id)) m.removeSource(id);
      if (spokes) {
        m.addSource("spokes", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: spokes } } });
        m.addLayer({ id: "spokes", type: "line", source: "spokes", paint: { "line-color": "#2F4A3A", "line-width": 2, "line-opacity": 0.55, "line-dasharray": [0.6, 1.4] } });
      }
      if (spots?.length) {
        m.addSource("spot", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: spots.map((sp) => [circle(sp.center.lat, sp.center.lng, sp.radiusKm)]) } } });
        m.addLayer({ id: "spot-fill", type: "fill", source: "spot", paint: { "fill-color": "#81B29A", "fill-opacity": 0.22 } });
        m.addLayer({ id: "spot-line", type: "line", source: "spot", paint: { "line-color": "#2E7D5B", "line-width": 2 } });
      }
      if (route) {
        m.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } } });
        m.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": accent, "line-width": 4, "line-dasharray": [1.5, 1.5] } });
      }
      if (pins.length) {
        const b = new maplibre.LngLatBounds();
        pins.forEach((p) => b.extend([p.lng, p.lat]));
        m.fitBounds(b, { padding: 60, maxZoom: 15, duration: 600 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pins, route, spokes, spots, ready]);

  return (
    <div className="stack" style={{ height: compact ? "100%" : undefined }}>
      {!compact && (
        <div className="section-head" style={{ marginBottom: 0 }}>
          <div>
            <ModuleTitle id="map" fallback="Map" />
            <p>Plans, ideas and stays with a location. Pick a day to see its route.</p>
          </div>
        </div>
      )}
      <div className="toolbar">
        <select className="input" style={{ width: "auto" }} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
          <option value="all">Everything</option>
          {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {formatDay(d)}</option>)}
        </select>
        {!compact && (
          <Segmented<string>
            size="sm"
            value=""
            onChange={(k) => setLayers((l) => ({ ...l, [k]: !l[k as keyof typeof l] }))}
            options={[
              { value: "plan", label: `${layers.plan ? "✓" : "○"} Plans` },
              { value: "idea", label: `${layers.idea ? "✓" : "○"} Ideas` },
              { value: "stay", label: `${layers.stay ? "✓" : "○"} Stays` },
              { value: "list", label: `${layers.list ? "✓" : "○"} Lists` },
              ...(travel.periods.length ? [{ value: "spot", label: `${layers.spot ? "✓" : "○"} Where to stay` }] : []),
            ]}
          />
        )}
        <span className="tiny muted">{pins.length} pinned</span>
      </div>
      <div ref={box} className="map-box" style={{ height: height ?? (compact ? 320 : "calc(100dvh - 260px)") }} />
      {spots && spots.length > 0 && <p className="tiny muted">Green circles are the sweet spots for staying: where most of your plans are{spots.length > 1 ? ", for each part of the trip" : ""}.</p>}
      {pins.length === 0 && <p className="tiny muted">Tip: add a location (&quot;Where&quot;) to ideas, plans and stays to see them here.</p>}
    </div>
  );
}
