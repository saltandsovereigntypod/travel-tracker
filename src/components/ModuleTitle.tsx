"use client";

import { useTrip } from "./TripProvider";

/** Page heading that uses this space's name for a module ("Packing" vs "Chores & lists"). */
export function ModuleTitle({ id, fallback }: { id: string; fallback: string }) {
  const { moduleName } = useTrip();
  return <h1>{moduleName(id, fallback)}</h1>;
}
