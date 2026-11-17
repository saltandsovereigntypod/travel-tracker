"use client";

import { useEffect, useMemo, useState } from "react";
import { useTrip } from "../TripProvider";
import { useMoney, stayNights } from "../sections/money";
import { costTotal, pickCost } from "@/lib/costs";
import { directionsLink, distanceKm, estimateTravel, hasCoords, loadAirports, travelLabel, type Airport, type LatLng } from "@/lib/geo";
import { arrivalAirportFor, departureAirportFor, estimatedFromOptions, flightOptionKey, optionGroups, rankStays, stayForDay, stayOptionKey, stayPeriods, sweetSpot, type PlanPoint } from "@/lib/travel";
import type { Flight, ItineraryItem, Stay } from "@/lib/types";

let cache: Map<string, Airport> | null = null;

/** Airports, loaded the first time anything needs them. */
export function useAirports(): Map<string, Airport> | null {
  const [all, setAll] = useState<Map<string, Airport> | null>(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    void loadAirports().then((m) => {
      if (m.size) cache = m;
      if (alive) setAll(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return all;
}

export interface Leg {
  from: LatLng;
  to: LatLng;
  km: number;
  label: string;
  href: string;
}

export function leg(from: LatLng, to: LatLng): Leg {
  const km = distanceKm(from, to);
  return { from, to, km, label: travelLabel(km), href: directionsLink(from, to, estimateTravel(km).mode === "walk" ? "walking" : "driving") };
}

const coordsOf = (p: unknown): LatLng | null => (hasCoords(p as Partial<LatLng>) ? { lat: (p as LatLng).lat, lng: (p as LatLng).lng } : null);

/** Everything travel: stays by night, airports for stays, distances, options and the best place to stay. */
export function useTravel() {
  const { rows, goingIds, householdOf, trip } = useTrip();
  const money = useMoney();
  const airports = useAirports();

  return useMemo(() => {
    const stays = rows.stays;
    const flights = rows.flights;
    const airport = (code: string | null | undefined) => (code && airports ? airports.get(code.trim().toUpperCase()) ?? null : null);

    const flightTotal = (f: Flight) => costTotal(f.cost, pickCost(f), { participants: f.travelers.length ? f.travelers : goingIds, householdOf });
    const stayTotal = (s: Stay) =>
      costTotal(s.cost, pickCost(s), { participants: s.guests.length ? s.guests : goingIds, householdOf, nights: stayNights(s) });
    const perNight = (s: Stay) => {
      const t = stayTotal(s);
      const n = stayNights(s);
      return t == null ? null : n ? t / n : t;
    };

    const flightGroups = optionGroups(flights, flightOptionKey, flightTotal);
    const stayGroups = optionGroups(stays, stayOptionKey, stayTotal);
    const estimated = estimatedFromOptions(flightGroups) + estimatedFromOptions(stayGroups);

    // Plans with a place: the itinerary (by day), plus ideas people like (no day, lighter weight).
    const points: PlanPoint[] = [
      ...rows.itinerary_items.flatMap((i) => {
        const c = coordsOf(i.location);
        return c ? [{ ...c, day: i.day, weight: 1, title: i.title }] : [];
      }),
      ...rows.ideas
        .filter((i) => i.status === "open" || i.status === "maybe")
        .flatMap((i) => {
          const c = coordsOf(i.location);
          return c ? [{ ...c, day: null, weight: 0.5, title: i.title }] : [];
        }),
    ];
    const spot = sweetSpot(points);
    const periods = stayPeriods(stays, points, { start: trip?.start_date ?? null, end: trip?.end_date ?? null });
    const ranked = rankStays(stays, points, perNight);

    const stayLegFromAirport = (s: Stay): (Leg & { airport: Airport }) | null => {
      const a = airport(arrivalAirportFor(flights, s));
      const c = coordsOf(s.location);
      return a && c ? { ...leg(a, c), airport: a } : null;
    };
    const stayLegToAirport = (s: Stay): (Leg & { airport: Airport }) | null => {
      const code = departureAirportFor(flights, s);
      const a = airport(code);
      const c = coordsOf(s.location);
      return a && c && code !== arrivalAirportFor(flights, s) ? { ...leg(c, a), airport: a } : null;
    };
    /** Distance from wherever you're staying that day to a plan. */
    const fromStay = (i: Pick<ItineraryItem, "day" | "location">): (Leg & { stay: Stay }) | null => {
      if (!i.day) return null;
      const s = stayForDay(stays, i.day);
      const a = s ? coordsOf(s.location) : null;
      const b = coordsOf(i.location);
      return s && a && b ? { ...leg(a, b), stay: s } : null;
    };
    /** Plans during a stay, nearest first. */
    const plansNear = (s: Stay) => {
      const c = coordsOf(s.location);
      if (!c) return [];
      return rows.itinerary_items
        .filter((i) => i.day && s.check_in && s.check_out && i.day >= s.check_in && i.day <= s.check_out && coordsOf(i.location))
        .map((i) => ({ item: i, ...leg(c, coordsOf(i.location)!) }))
        .sort((a, b) => (a.item.day! + (a.item.start_time ?? "")).localeCompare(b.item.day! + (b.item.start_time ?? "")));
    };

    return {
      airports,
      airport,
      flightTotal,
      stayTotal,
      perNight,
      flightGroups,
      stayGroups,
      estimated,
      points,
      spot,
      periods,
      ranked,
      fitOf: (id: string) => ranked.find((r) => r.stay.id === id) ?? null,
      stayLegFromAirport,
      stayLegToAirport,
      fromStay,
      plansNear,
      remainingIfBooked: money.budget ? money.remainingBudget - estimated : null,
    };
  }, [rows.stays, rows.flights, rows.itinerary_items, rows.ideas, airports, goingIds, householdOf, money.budget, money.remainingBudget, trip?.start_date, trip?.end_date]);
}
