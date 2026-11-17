import type { ItineraryItem } from "@/lib/types";

/** Items for one day in display order. */
export function itemsForDay(items: ItineraryItem[], day: string | null) {
  return items.filter((i) => i.day === day).sort((a, b) => a.sort_order - b.sort_order);
}

/** sort_order that places an item with `time` chronologically among a day's timed items. */
export function orderForTime(dayItems: ItineraryItem[], time: string | null, excludeId?: string): number {
  const list = dayItems.filter((i) => i.id !== excludeId);
  if (!list.length) return 0;
  if (!time) return list[list.length - 1].sort_order + 1;
  const after = list.find((i) => i.start_time && i.start_time > time);
  if (!after) return list[list.length - 1].sort_order + 1;
  const idx = list.indexOf(after);
  const before = list[idx - 1];
  return before ? (before.sort_order + after.sort_order) / 2 : after.sort_order - 1;
}
