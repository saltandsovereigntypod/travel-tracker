// Saving a space as a template and starting new spaces from one.
// A template is a snapshot of a space's setup: features, lists and their fields,
// optionally the items in them, pages, and the saver's own design. People, payments
// and anything private are never included.

import { asIds, type FieldDef, type ListDef, type ListItem } from "./fields";
import type { DocBlock, Page } from "./pages";
import type { ModuleSetting } from "./spaces";

export interface TemplateData {
  version: 1;
  modules: ModuleSetting[];
  currency?: string;
  lists: Pick<ListDef, "id" | "name" | "icon" | "description" | "fields" | "settings" | "sort_order">[];
  items: Pick<ListItem, "list_id" | "title" | "values" | "sort_order">[];
  pages: Pick<Page, "id" | "parent_id" | "title" | "icon" | "cover" | "blocks" | "sort_order">[];
  design?: { theme?: unknown; page_layout?: unknown; board_layout?: unknown; mode?: string };
}

export interface SpaceTemplateRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  icon: string;
  kind: string;
  data: TemplateData;
  is_public: boolean;
  share_code: string;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface SnapshotOptions {
  items: boolean;
  pages: boolean;
  dates: boolean;
  design: boolean;
}

const PERSONAL: FieldDef["type"][] = ["person", "people"];
const DATED: FieldDef["type"][] = ["date", "datetime"];

function cleanValues(values: Record<string, unknown>, list: ListDef, opts: SnapshotOptions, keptItems: Set<string>) {
  const out: Record<string, unknown> = {};
  for (const f of list.fields) {
    const v = values[f.id];
    if (v == null || v === "") continue;
    if (PERSONAL.includes(f.type) || f.type === "rollup") continue;
    if (!opts.dates && DATED.includes(f.type)) continue;
    // Ticked boxes and "paid" states belong to the old space; start fresh.
    if (f.type === "checkbox") continue;
    if (f.type === "status") {
      const first = f.options?.find((o) => o.kind === "todo") ?? f.options?.[0];
      if (first) out[f.id] = first.id;
      continue;
    }
    if (f.type === "relation") {
      const ids = asIds(v).filter((id) => keptItems.has(id));
      if (ids.length) out[f.id] = ids;
      continue;
    }
    out[f.id] = v;
  }
  return out;
}

function cleanBlocks(blocks: DocBlock[], opts: SnapshotOptions, keptItems: Set<string>, keptPages: Set<string>): DocBlock[] {
  return (blocks ?? [])
    .filter((b) => (b.type !== "item" || (b.itemId && keptItems.has(b.itemId))) && (b.type !== "page" || (b.pageId && keptPages.has(b.pageId))))
    .map((b) => {
      const c: DocBlock = { ...b };
      if (c.type === "todo") {
        c.checked = false;
        delete c.who;
        if (!opts.dates) delete c.due;
      }
      return c;
    });
}

/** Snapshot a space for a template. Item ids are kept so links inside the template still line up. */
export function snapshotSpace(
  space: { modules?: unknown; currency?: string | null },
  rows: { lists: ListDef[]; list_items: ListItem[]; pages: Page[] },
  opts: SnapshotOptions,
  design?: TemplateData["design"],
): TemplateData & { itemIds: string[] } {
  const items = opts.items ? rows.list_items : [];
  const keptItems = new Set(items.map((i) => i.id));
  const pages = opts.pages ? rows.pages : [];
  const keptPages = new Set(pages.map((p) => p.id));
  const listById = new Map(rows.lists.map((l) => [l.id, l]));
  return {
    version: 1,
    modules: Array.isArray(space.modules) ? (space.modules as ModuleSetting[]) : [],
    currency: space.currency ?? undefined,
    lists: rows.lists.map((l) => ({ id: l.id, name: l.name, icon: l.icon, description: l.description, fields: l.fields, settings: l.settings, sort_order: l.sort_order })),
    items: items.map((i) => ({ list_id: i.list_id, title: i.title, values: { ...cleanValues(i.values, listById.get(i.list_id)!, opts, keptItems), __id: i.id }, sort_order: i.sort_order })),
    itemIds: items.map((i) => i.id),
    pages: pages.map((p) => ({ id: p.id, parent_id: p.parent_id && keptPages.has(p.parent_id) ? p.parent_id : null, title: p.title, icon: p.icon, cover: p.cover, blocks: cleanBlocks(p.blocks, opts, keptItems, keptPages), sort_order: p.sort_order })),
    design: opts.design ? design : undefined,
  };
}

/** Strip the helper key before saving. */
export function finalizeSnapshot(s: TemplateData & { itemIds?: string[] }): TemplateData {
  const { itemIds: _ignored, ...rest } = s;
  void _ignored;
  return rest;
}

export interface Instantiated {
  lists: Omit<ListDef, "created_at" | "updated_at" | "created_by">[];
  items: Omit<ListItem, "created_at" | "updated_at" | "created_by">[];
  /** Grouped by depth: insert each group after the one before so parents exist first. */
  pageLevels: Omit<Page, "created_at" | "updated_at" | "created_by" | "updated_by">[][];
}

/** Give everything fresh ids for a new space and rewire every link to match. */
export function instantiate(data: TemplateData, tripId: string, newId: () => string = () => crypto.randomUUID()): Instantiated {
  const map = new Map<string, string>();
  const id = (old: string | null | undefined) => {
    if (!old) return old ?? null;
    if (!map.has(old)) map.set(old, newId());
    return map.get(old)!;
  };
  const listIds = new Set(data.lists.map((l) => l.id));
  for (const l of data.lists) id(l.id);
  for (const it of data.items) if (typeof it.values.__id === "string") id(it.values.__id);
  for (const p of data.pages) id(p.id);

  const lists = data.lists.map((l) => ({
    ...l,
    id: id(l.id)!,
    trip_id: tripId,
    fields: l.fields
      .filter((f) => f.type !== "relation" || (f.listId && listIds.has(f.listId)))
      .map((f) => {
        const c: FieldDef = { ...f };
        if (c.listId) c.listId = id(c.listId)!;
        if (c.rollup?.via?.startsWith("back:")) {
          const [, lid, fid] = c.rollup.via.split(":");
          c.rollup = { ...c.rollup, via: `back:${id(lid)}:${fid}` };
        }
        return c;
      }),
  }));
  const relFields = new Set(data.lists.flatMap((l) => l.fields.filter((f) => f.type === "relation").map((f) => f.id)));

  const items = data.items
    .filter((it) => listIds.has(it.list_id))
    .map((it) => {
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(it.values)) {
        if (k === "__id") continue;
        values[k] = relFields.has(k) ? asIds(v).filter((x) => map.has(x)).map((x) => map.get(x)!) : v;
      }
      const oldId = typeof it.values.__id === "string" ? it.values.__id : null;
      return { id: oldId ? id(oldId)! : newId(), trip_id: tripId, list_id: id(it.list_id)!, title: it.title, values, sort_order: it.sort_order };
    });

  const pageIds = new Set(data.pages.map((p) => p.id));
  const fixBlock = (b: DocBlock): DocBlock | null => {
    const c = { ...b, id: newId().slice(0, 12) };
    if (c.listId) {
      if (!listIds.has(c.listId)) return null;
      c.listId = id(c.listId)!;
    }
    if (c.itemId) {
      if (!map.has(c.itemId)) return null;
      c.itemId = map.get(c.itemId)!;
    }
    if (c.pageId) {
      if (!pageIds.has(c.pageId)) return null;
      c.pageId = id(c.pageId)!;
    }
    return c;
  };
  const pages = data.pages.map((p) => ({
    id: id(p.id)!,
    trip_id: tripId,
    parent_id: p.parent_id && pageIds.has(p.parent_id) ? id(p.parent_id) : null,
    title: p.title,
    icon: p.icon,
    cover: p.cover,
    blocks: (p.blocks ?? []).map(fixBlock).filter((b): b is DocBlock => !!b),
    sort_order: p.sort_order,
  }));
  // Depth-order the pages.
  const levels: (typeof pages)[] = [];
  const placed = new Set<string>();
  let rest = pages;
  while (rest.length) {
    const ready = rest.filter((p) => !p.parent_id || placed.has(p.parent_id));
    if (!ready.length) {
      // Broken parent chain: put the rest at the top level.
      levels.push(rest.map((p) => ({ ...p, parent_id: null })));
      break;
    }
    levels.push(ready);
    ready.forEach((p) => placed.add(p.id));
    rest = rest.filter((p) => !placed.has(p.id));
  }
  return { lists, items, pageLevels: levels };
}

/** One-line summary of what's in a template. */
export function templateSummary(data: TemplateData): string {
  const bits: string[] = [];
  if (data.lists.length) bits.push(`${data.lists.length} list${data.lists.length === 1 ? "" : "s"}`);
  if (data.items.length) bits.push(`${data.items.length} item${data.items.length === 1 ? "" : "s"}`);
  if (data.pages.length) bits.push(`${data.pages.length} page${data.pages.length === 1 ? "" : "s"}`);
  if (data.design) bits.push("a design");
  return bits.join(" · ") || "Features only";
}
