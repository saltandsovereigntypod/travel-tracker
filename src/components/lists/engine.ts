"use client";

import { useMemo } from "react";
import { useTrip } from "../TripProvider";
import type { EngineContext, ListDef, ListItem, MoneyContext } from "@/lib/fields";

/** The space's lists and items, plus the money context, for the linked engine. */
export function useEngine(): { ctx: EngineContext; money: MoneyContext; listById: (id: string) => ListDef | undefined; itemById: (id: string) => ListItem | undefined } {
  const { rows, goingIds, householdOf } = useTrip();
  return useMemo(() => {
    const ctx = { lists: rows.lists, items: rows.list_items };
    return {
      ctx,
      money: { going: goingIds, householdOf },
      listById: (id: string) => rows.lists.find((l) => l.id === id),
      itemById: (id: string) => rows.list_items.find((i) => i.id === id),
    };
  }, [rows.lists, rows.list_items, goingIds, householdOf]);
}

export const listHref = (tripId: string, listId: string, itemId?: string) =>
  `/trips/${tripId}/lists/${listId}${itemId ? `?item=${itemId}` : ""}`;
