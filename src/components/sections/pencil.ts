"use client";

// "Pencil in" mode: when it's on, new plans start as drafts everyone can vote on.
// It's a per-person, per-space convenience kept in the browser; viewers always pencil in.

import { useCallback, useSyncExternalStore } from "react";
import { useTrip } from "../TripProvider";
import { todayString } from "@/lib/format";

const listeners = new Set<() => void>();
const key = (tripId: string) => `driftbook:pencil:${tripId}`;

function read(tripId: string): "on" | "off" | null {
  try {
    const v = localStorage.getItem(key(tripId));
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}

export function usePencil(): [boolean, (on: boolean) => void, boolean] {
  const { tripId, trip, canEdit } = useTrip();
  const stored = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(tripId),
    () => null,
  );
  // Before the trip starts it's planning time, so pencilling in is the default.
  const planning = !trip?.start_date || trip.start_date > todayString();
  const on = !canEdit || (stored ? stored === "on" : planning);
  const set = useCallback(
    (v: boolean) => {
      try {
        localStorage.setItem(key(tripId), v ? "on" : "off");
      } catch {
        /* private mode: just this session */
      }
      listeners.forEach((l) => l());
    },
    [tripId],
  );
  return [on, set, canEdit];
}
