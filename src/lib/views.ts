// Sorting, grouping and filtering for list views. Pure functions.

import { asDate, asIds, asMoney, isDone, itemPeople, statusField, type FieldDef, type ListDef, type ListItem } from "./fields";
import type { ListPrefs } from "./types";

/** Comparable value for sorting. */
function sortKey(item: ListItem, field: FieldDef | undefined): string | number | null {
  if (!field) return item.title.toLowerCase();
  const v = item.values[field.id];
  switch (field.type) {
    case "number":
    case "rating":
      return v == null || v === "" ? null : Number(v);
    case "money":
      return asMoney(v)?.price ?? null;
    case "date":
    case "datetime": {
      const d = asDate(field, v);
      return d?.date ? `${d.date}T${d.time ?? "00:00"}` : null;
    }
    case "checkbox":
      return v ? 1 : 0;
    case "status":
    case "select": {
      const i = field.options?.findIndex((o) => o.id === v) ?? -1;
      return i < 0 ? null : i;
    }
    default:
      return v == null ? null : String(v).toLowerCase();
  }
}

export function sortItems(items: ListItem[], list: ListDef, sort?: ListPrefs["sort"]): ListItem[] {
  if (!sort?.field) return [...items].sort((a, b) => a.sort_order - b.sort_order);
  const field = sort.field === "title" ? undefined : list.fields.find((f) => f.id === sort.field);
  const dir = sort.dir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const ka = sortKey(a, field);
    const kb = sortKey(b, field);
    // Empty values always go last.
    if (ka == null && kb == null) return a.sort_order - b.sort_order;
    if (ka == null) return 1;
    if (kb == null) return -1;
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir;
  });
}

export function filterItems(items: ListItem[], list: ListDef, prefs: ListPrefs, me: string, q = ""): ListItem[] {
  const needle = q.trim().toLowerCase();
  return items.filter((i) => {
    if (prefs.mine && !itemPeople(i, list).includes(me)) return false;
    if (prefs.hideDone && isDone(i, list)) return false;
    if (needle && !i.title.toLowerCase().includes(needle) && !JSON.stringify(i.values).toLowerCase().includes(needle)) return false;
    return true;
  });
}

/** Fields that can make board columns. */
export function groupableFields(list: ListDef): FieldDef[] {
  return list.fields.filter((f) => f.type === "status" || f.type === "select" || f.type === "person" || f.type === "checkbox");
}

export function defaultGroupField(list: ListDef): FieldDef | undefined {
  return statusField(list) ?? groupableFields(list)[0];
}

export interface BoardColumn {
  key: string;
  label: string;
  color: string;
  /** Value to store when a card is dropped here. */
  value: unknown;
  items: ListItem[];
}

export function boardColumns(items: ListItem[], field: FieldDef, people: { id: string; name: string; color: string }[]): BoardColumn[] {
  const cols: BoardColumn[] = [];
  if (field.type === "status" || field.type === "select") {
    for (const o of field.options ?? []) cols.push({ key: o.id, label: o.label, color: o.color, value: o.id, items: [] });
  } else if (field.type === "person") {
    for (const p of people) cols.push({ key: p.id, label: p.name, color: p.color, value: p.id, items: [] });
  } else if (field.type === "checkbox") {
    cols.push({ key: "no", label: `Not ${field.name.toLowerCase()}`, color: "#A3A3A3", value: false, items: [] });
    cols.push({ key: "yes", label: field.name, color: "#81B29A", value: true, items: [] });
  }
  const none: BoardColumn = { key: "__none", label: "No " + field.name.toLowerCase(), color: "#C9C9C9", value: null, items: [] };
  for (const item of items) {
    const v = item.values[field.id];
    const key = field.type === "checkbox" ? (v ? "yes" : "no") : field.type === "person" ? asIds(v)[0] : typeof v === "string" ? v : undefined;
    const col = cols.find((c) => c.key === key);
    (col ?? none).items.push(item);
  }
  return field.type === "checkbox" ? cols : [...cols, none];
}

/** Calendar month grid: 6 weeks of days starting on Sunday. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

export function dateFields(list: ListDef): FieldDef[] {
  return list.fields.filter((f) => f.type === "date" || f.type === "datetime");
}

export function placeFields(list: ListDef): FieldDef[] {
  return list.fields.filter((f) => f.type === "place");
}

export function itemsByDay(items: ListItem[], field: FieldDef): Record<string, ListItem[]> {
  const out: Record<string, ListItem[]> = {};
  for (const i of items) {
    const d = asDate(field, i.values[field.id]);
    if (d?.date) (out[d.date] ??= []).push(i);
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => (asDate(field, a.values[field.id])?.time ?? "99").localeCompare(asDate(field, b.values[field.id])?.time ?? "99"));
  }
  return out;
}
