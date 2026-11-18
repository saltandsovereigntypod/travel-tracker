// The linked engine: custom lists whose fields know what they mean.
// Money flows to the budget, dates to the calendar, places to the map, people to
// assignments and splits. Links between lists work in both directions, and
// rollups (counts, sums, dates) compute themselves. Pure functions, no React.

import { costTotal, type HouseholdOf } from "./costs";
import type { CostFields, Place } from "./types";

export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "person"
  | "people"
  | "select"
  | "multiselect"
  | "status"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "place"
  | "rating"
  | "relation"
  | "rollup"
  | "repeat"
  | "checklist"
  | "page";

export type OptionKind = "todo" | "doing" | "done" | "cancelled";

export interface FieldOption {
  id: string;
  label: string;
  color: string;
  kind?: OptionKind;
}

export type RollupOp = "count" | "sum" | "min" | "max" | "avg" | "checked" | "earliest" | "latest";

export interface FieldDef {
  id: string;
  name: string;
  type: FieldType;
  options?: FieldOption[];
  /** relation: the list it links to. */
  listId?: string;
  /** rollup: which link to follow (a relation field id, or a backlink key) and what to compute. */
  rollup?: { via: string; target?: string; op: RollupOp };
  /** Turn individual flows off. Everything feeds by default. */
  feeds?: { budget?: boolean; calendar?: boolean; map?: boolean };
  /** money: cost (spending, the default) or income (money coming in, e.g. sponsor deals). */
  moneyKind?: "cost" | "income";
  /** checklist: the steps every item gets, optionally grouped into stages. */
  steps?: ChecklistStep[];
  /** checklist: finishing a stage's steps moves the item's status to that stage. */
  autoAdvance?: boolean;
  /** date: how often one is expected (a weekly release), so gaps can be flagged. */
  cadence?: Cadence;
  /** page: which page template new linked pages start from. */
  pageTemplate?: string;
}

export interface ChecklistStep {
  id: string;
  label: string;
  /** Usually matches a status option (e.g. "Recorded"). */
  stage?: string;
}

export type Cadence = "week" | "2weeks" | "month";

export type RepeatFreq = "day" | "week" | "month" | "year";

/** repeat: how an item's date recurs (bills, chores, standing events). */
export interface RepeatValue {
  freq: RepeatFreq;
  interval: number;
  until?: string | null;
}

export interface ListDef {
  id: string;
  trip_id: string;
  name: string;
  icon: string;
  description: string;
  fields: FieldDef[];
  settings: Record<string, unknown>;
  sort_order: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ListItem {
  id: string;
  trip_id: string;
  list_id: string;
  title: string;
  values: Record<string, unknown>;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoneyValue extends CostFields {
  price: number | null;
}

export interface DateTimeValue {
  date: string | null;
  time: string | null;
}

export const FIELD_TYPES: { type: FieldType; label: string; icon: string; feeds?: string; group: "Basics" | "Choices" | "People & places" | "Connections" }[] = [
  { type: "text", label: "Text", icon: "Aa", group: "Basics" },
  { type: "longtext", label: "Long text", icon: "¶", group: "Basics" },
  { type: "number", label: "Number", icon: "#", group: "Basics" },
  { type: "money", label: "Money", icon: "$", feeds: "Budget", group: "Basics" },
  { type: "date", label: "Date", icon: "📅", feeds: "Calendar", group: "Basics" },
  { type: "datetime", label: "Date & time", icon: "🕒", feeds: "Calendar", group: "Basics" },
  { type: "repeat", label: "Repeats", icon: "🔁", feeds: "Calendar", group: "Basics" },
  { type: "checkbox", label: "Checkbox", icon: "☑", feeds: "Progress", group: "Choices" },
  { type: "status", label: "Status", icon: "◐", feeds: "Progress", group: "Choices" },
  { type: "select", label: "Dropdown", icon: "▾", group: "Choices" },
  { type: "multiselect", label: "Tags", icon: "🏷", group: "Choices" },
  { type: "rating", label: "Rating", icon: "★", group: "Choices" },
  { type: "checklist", label: "Checklist (steps)", icon: "✔", feeds: "Progress", group: "Choices" },
  { type: "person", label: "Person", icon: "👤", feeds: "Assignments", group: "People & places" },
  { type: "people", label: "People", icon: "👥", feeds: "Assignments & splits", group: "People & places" },
  { type: "place", label: "Place", icon: "📍", feeds: "Map", group: "People & places" },
  { type: "url", label: "Link", icon: "🔗", group: "People & places" },
  { type: "email", label: "Email", icon: "✉", group: "People & places" },
  { type: "phone", label: "Phone", icon: "☎", group: "People & places" },
  { type: "relation", label: "Link to another list", icon: "↔", feeds: "Both lists", group: "Connections" },
  { type: "rollup", label: "Count / total from links", icon: "Σ", group: "Connections" },
  { type: "page", label: "Linked page", icon: "📄", group: "Connections" },
];

export const fieldTypeMeta = (t: FieldType) => FIELD_TYPES.find((f) => f.type === t)!;

export const OPTION_COLORS = ["#E07A5F", "#3D5A80", "#81B29A", "#F2CC8F", "#9B5DE5", "#F15BB5", "#00BBF9", "#6D597A", "#A3A3A3"];

export function fid(prefix = "f"): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultStatusOptions(): FieldOption[] {
  return [
    { id: "todo", label: "To do", color: "#A3A3A3", kind: "todo" },
    { id: "doing", label: "In progress", color: "#F2CC8F", kind: "doing" },
    { id: "done", label: "Done", color: "#81B29A", kind: "done" },
  ];
}

export function newField(type: FieldType, name?: string): FieldDef {
  const f: FieldDef = { id: fid(), name: name ?? fieldTypeMeta(type).label, type };
  if (type === "status") f.options = defaultStatusOptions();
  if (type === "select" || type === "multiselect") f.options = [];
  if (type === "rollup") f.rollup = { via: "", op: "count" };
  if (type === "checklist") f.steps = [];
  return f;
}

// ---------------------------------------------------------------- values

export function asMoney(v: unknown): MoneyValue | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Partial<MoneyValue>;
  if (m.price == null || Number.isNaN(Number(m.price))) return null;
  return {
    price: Number(m.price),
    cost_unit: m.cost_unit ?? "group",
    cost_unit_size: m.cost_unit_size ?? null,
    cost_qty: m.cost_qty ?? null,
    cost_unit_label: m.cost_unit_label ?? "",
  };
}

export function asDate(field: FieldDef, v: unknown): DateTimeValue | null {
  if (field.type === "date") return typeof v === "string" && v ? { date: v.slice(0, 10), time: null } : null;
  if (field.type === "datetime" && v && typeof v === "object") {
    const d = v as Partial<DateTimeValue>;
    return d.date ? { date: d.date, time: d.time ?? null } : null;
  }
  return null;
}

export function asIds(v: unknown): string[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : typeof v === "string" && v ? [v] : [];
}

export function asPlace(v: unknown): Place | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Place;
  return p.name || p.address || p.lat != null ? p : null;
}

// ---------------------------------------------------------------- links

export interface EngineContext {
  lists: ListDef[];
  items: ListItem[];
}

/** Fields that other lists point at this list with (shown here automatically). */
export interface Backlink {
  key: string;
  fromList: ListDef;
  field: FieldDef;
}

export function backlinksFor(list: ListDef, ctx: EngineContext): Backlink[] {
  const out: Backlink[] = [];
  for (const other of ctx.lists) {
    for (const f of other.fields) {
      if (f.type === "relation" && f.listId === list.id) out.push({ key: `back:${other.id}:${f.id}`, fromList: other, field: f });
    }
  }
  return out;
}

/** Items reached by following a relation field or a backlink from `item`. */
export function linkedItems(item: ListItem, via: string, ctx: EngineContext): ListItem[] {
  if (via.startsWith("back:")) {
    const [, listId, fieldId] = via.split(":");
    return ctx.items.filter((i) => i.list_id === listId && asIds(i.values[fieldId]).includes(item.id));
  }
  const ids = asIds(item.values[via]);
  return ids.map((id) => ctx.items.find((i) => i.id === id)).filter((i): i is ListItem => !!i);
}

/** The list a link points to (for relation fields or backlinks). */
export function linkTarget(list: ListDef, via: string, ctx: EngineContext): ListDef | undefined {
  if (via.startsWith("back:")) return ctx.lists.find((l) => l.id === via.split(":")[1]);
  const f = list.fields.find((x) => x.id === via);
  return f?.listId ? ctx.lists.find((l) => l.id === f.listId) : undefined;
}

/** Ways to follow links out of a list: its own relation fields plus backlinks. */
export function linkPaths(list: ListDef, ctx: EngineContext): { key: string; name: string; target?: ListDef }[] {
  return [
    ...list.fields.filter((f) => f.type === "relation").map((f) => ({ key: f.id, name: f.name, target: ctx.lists.find((l) => l.id === f.listId) })),
    ...backlinksFor(list, ctx).map((b) => ({ key: b.key, name: b.fromList.name, target: b.fromList })),
  ];
}

// ---------------------------------------------------------------- rollups

export interface MoneyContext {
  going: string[];
  householdOf?: HouseholdOf;
}

/** Numeric value of a field on an item (money = its total). */
export function numericValue(item: ListItem, field: FieldDef, list: ListDef, money?: MoneyContext): number | null {
  const v = item.values[field.id];
  if (field.type === "number" || field.type === "rating") return v == null || v === "" ? null : Number(v);
  if (field.type === "money") {
    const m = asMoney(v);
    if (!m) return null;
    return costTotal(m.price, m, { participants: itemParticipants(item, list, money?.going ?? []), householdOf: money?.householdOf });
  }
  if (field.type === "checkbox") return v ? 1 : 0;
  return null;
}

export function rollupValue(item: ListItem, field: FieldDef, list: ListDef, ctx: EngineContext, money?: MoneyContext): number | string | null {
  const r = field.rollup;
  if (!r?.via) return null;
  const linked = linkedItems(item, r.via, ctx);
  if (r.op === "count") return linked.length;
  const target = linkTarget(list, r.via, ctx);
  const tf = target?.fields.find((f) => f.id === r.target);
  if (!target || !tf) return null;
  if (r.op === "checked") return linked.filter((i) => isDone(i, target)).length;
  if (r.op === "earliest" || r.op === "latest") {
    const ds = linked.map((i) => asDate(tf, i.values[tf.id])?.date).filter((d): d is string => !!d).sort();
    return (r.op === "earliest" ? ds[0] : ds[ds.length - 1]) ?? null;
  }
  const nums = linked.map((i) => numericValue(i, tf, target, money)).filter((n): n is number => n != null && !Number.isNaN(n));
  if (!nums.length) return r.op === "sum" ? 0 : null;
  if (r.op === "sum") return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
  if (r.op === "min") return Math.min(...nums);
  if (r.op === "max") return Math.max(...nums);
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

// ---------------------------------------------------------------- meaning

/** People attached to an item through person/people fields. */
export function itemPeople(item: ListItem, list: ListDef): string[] {
  const out = new Set<string>();
  for (const f of list.fields) if (f.type === "person" || f.type === "people") asIds(item.values[f.id]).forEach((u) => out.add(u));
  return [...out];
}

/** Who a cost is split between: the item's people, or everyone going. */
export function itemParticipants(item: ListItem, list: ListDef, going: string[]): string[] {
  const people = list.fields.filter((f) => f.type === "people").flatMap((f) => asIds(item.values[f.id]));
  return people.length ? [...new Set(people)] : going;
}

export function statusField(list: ListDef): FieldDef | undefined {
  return list.fields.find((f) => f.type === "status");
}

export function statusOf(item: ListItem, list: ListDef): FieldOption | undefined {
  const sf = statusField(list);
  if (!sf) return undefined;
  return sf.options?.find((o) => o.id === item.values[sf.id]);
}

/** Done = a status option marked done, or (with no status) the first checkbox ticked. */
export function isDone(item: ListItem, list: ListDef): boolean {
  const sf = statusField(list);
  if (sf) return statusOf(item, list)?.kind === "done";
  const cb = list.fields.find((f) => f.type === "checkbox");
  return cb ? !!item.values[cb.id] : false;
}

export function isCancelled(item: ListItem, list: ListDef): boolean {
  return statusOf(item, list)?.kind === "cancelled";
}

export function listProgress(list: ListDef, items: ListItem[]): { done: number; total: number } | null {
  if (!statusField(list) && !list.fields.some((f) => f.type === "checkbox")) return null;
  const live = items.filter((i) => !isCancelled(i, list));
  return { done: live.filter((i) => isDone(i, list)).length, total: live.length };
}

/** Total of an item's budget-feeding money fields. */
export function itemMoneyTotal(item: ListItem, list: ListDef, money: MoneyContext): number | null {
  if (isCancelled(item, list)) return null;
  let total: number | null = null;
  for (const f of list.fields) {
    if (f.type !== "money" || f.feeds?.budget === false || f.moneyKind === "income") continue;
    const n = numericValue(item, f, list, money);
    if (n != null) total = (total ?? 0) + n;
  }
  return total == null ? null : Math.round(total * 100) / 100;
}

/** Total of an item's income money fields (sponsor deals, gifts…). */
export function itemIncomeTotal(item: ListItem, list: ListDef, money: MoneyContext): number | null {
  if (isCancelled(item, list)) return null;
  let total: number | null = null;
  for (const f of list.fields) {
    if (f.type !== "money" || f.moneyKind !== "income") continue;
    const n = numericValue(item, f, list, money);
    if (n != null) total = (total ?? 0) + n;
  }
  return total == null ? null : Math.round(total * 100) / 100;
}

// ---------------------------------------------------------------- repeats

export function asRepeat(v: unknown): RepeatValue | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Partial<RepeatValue>;
  if (!r.freq || !["day", "week", "month", "year"].includes(r.freq)) return null;
  return { freq: r.freq, interval: Math.max(1, Number(r.interval) || 1), until: r.until ?? null };
}

export function repeatOf(item: ListItem, list: ListDef): RepeatValue | null {
  const f = list.fields.find((x) => x.type === "repeat");
  return f ? asRepeat(item.values[f.id]) : null;
}

function addMonthsClamped(day: string, months: number, anchorDay: number): string {
  const [y, m] = day.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(anchorDay, last)).padStart(2, "0")}`;
}

/** The next date after `day` ("monthly on the 31st" lands on the 30th/28th as needed). */
export function nextOccurrence(day: string, rule: RepeatValue, anchorDay = Number(day.slice(8, 10))): string {
  const n = rule.interval;
  if (rule.freq === "month") return addMonthsClamped(day, n, anchorDay);
  if (rule.freq === "year") return addMonthsClamped(day, 12 * n, anchorDay);
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (rule.freq === "week" ? 7 * n : n));
  return d.toISOString().slice(0, 10);
}

/** Every occurrence between from and to (inclusive), starting at `start`. */
export function occurrences(start: string, rule: RepeatValue, from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  const anchor = Number(start.slice(8, 10));
  let d = start;
  for (let i = 0; i < 5000 && d <= to && out.length < max; i++) {
    if (rule.until && d > rule.until) break;
    if (d >= from) out.push(d);
    d = nextOccurrence(d, rule, anchor);
  }
  return out;
}

/**
 * "Done" on a repeating item completes this round and schedules the next:
 * its date moves forward and its done state resets.
 */
export function advanceRecurring(item: ListItem, list: ListDef): Record<string, unknown> | null {
  const rule = repeatOf(item, list);
  const df = list.fields.find((f) => f.type === "date" || f.type === "datetime");
  if (!rule || !df) return null;
  const cur = asDate(df, item.values[df.id]);
  if (!cur?.date) return null;
  const next = nextOccurrence(cur.date, rule);
  if (rule.until && next > rule.until) return null;
  const values: Record<string, unknown> = { ...item.values, [df.id]: df.type === "date" ? next : { date: next, time: cur.time } };
  const sf = statusField(list);
  if (sf) values[sf.id] = sf.options?.find((o) => o.kind === "todo")?.id ?? null;
  else {
    const cb = list.fields.find((f) => f.type === "checkbox");
    if (cb) values[cb.id] = false;
  }
  return values;
}

export interface ItemDate {
  item: ListItem;
  list: ListDef;
  field: FieldDef;
  day: string;
  time: string | null;
  /** A future repeat of a recurring item (not its current due date). */
  repeat?: boolean;
}

function defaultWindow() {
  const now = Date.now();
  return {
    from: new Date(now - 62 * 86_400_000).toISOString().slice(0, 10),
    to: new Date(now + 400 * 86_400_000).toISOString().slice(0, 10),
  };
}

/**
 * Calendar entries from every date field that feeds the calendar.
 * Repeating items appear on each occurrence inside the window.
 */
export function calendarEntries(ctx: EngineContext, window?: { from: string; to: string }): ItemDate[] {
  const out: ItemDate[] = [];
  const win = window ?? defaultWindow();
  for (const item of ctx.items) {
    const list = ctx.lists.find((l) => l.id === item.list_id);
    if (!list || isCancelled(item, list)) continue;
    const rule = repeatOf(item, list);
    const firstDate = list.fields.find((f) => f.type === "date" || f.type === "datetime");
    for (const f of list.fields) {
      if ((f.type !== "date" && f.type !== "datetime") || f.feeds?.calendar === false) continue;
      const d = asDate(f, item.values[f.id]);
      if (!d?.date) continue;
      if (rule && f === firstDate) {
        for (const day of occurrences(d.date, rule, win.from, win.to)) out.push({ item, list, field: f, day, time: d.time, repeat: day !== d.date });
      } else {
        out.push({ item, list, field: f, day: d.date, time: d.time });
      }
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "99").localeCompare(b.time ?? "99"));
}

export interface ItemPlace {
  item: ListItem;
  list: ListDef;
  field: FieldDef;
  place: Place;
}

export function mapEntries(ctx: EngineContext): ItemPlace[] {
  const out: ItemPlace[] = [];
  for (const item of ctx.items) {
    const list = ctx.lists.find((l) => l.id === item.list_id);
    if (!list || isCancelled(item, list)) continue;
    for (const f of list.fields) {
      if (f.type !== "place" || f.feeds?.map === false) continue;
      const p = asPlace(item.values[f.id]);
      if (p?.lat != null && p.lng != null) out.push({ item, list, field: f, place: p });
    }
  }
  return out;
}

/** Which parts of the space an item feeds, for the little "Feeds:" labels. */
export function itemFeeds(item: ListItem, list: ListDef): string[] {
  const feeds = new Set<string>();
  for (const f of list.fields) {
    const v = item.values[f.id];
    if (f.type === "money" && f.moneyKind === "income" && asMoney(v)) feeds.add("Income");
    else if (f.type === "money" && f.feeds?.budget !== false && asMoney(v)) feeds.add("Budget");
    if (f.type === "repeat" && asRepeat(v)) feeds.add("Repeats");
    if ((f.type === "date" || f.type === "datetime") && f.feeds?.calendar !== false && asDate(f, v)) feeds.add("Calendar");
    if (f.type === "place" && f.feeds?.map !== false && asPlace(v)?.lat != null) feeds.add("Map");
    if ((f.type === "person" || f.type === "people") && asIds(v).length) feeds.add("Assignments");
    if (f.type === "relation" && asIds(v).length) feeds.add("Linked lists");
  }
  return [...feeds];
}

/** Items in any list assigned to a person. */
export function assignedTo(userId: string, ctx: EngineContext): { item: ListItem; list: ListDef }[] {
  const out: { item: ListItem; list: ListDef }[] = [];
  for (const item of ctx.items) {
    const list = ctx.lists.find((l) => l.id === item.list_id);
    if (list && !isCancelled(item, list) && !isDone(item, list) && itemPeople(item, list).includes(userId)) out.push({ item, list });
  }
  return out;
}

/** Remove references to a deleted item from every relation field (keeps links tidy). */
export function stripLinks(values: Record<string, unknown>, list: ListDef, removedId: string): Record<string, unknown> | null {
  let changed = false;
  const next = { ...values };
  for (const f of list.fields) {
    if (f.type !== "relation") continue;
    const ids = asIds(next[f.id]);
    if (ids.includes(removedId)) {
      next[f.id] = ids.filter((x) => x !== removedId);
      changed = true;
    }
  }
  return changed ? next : null;
}


// ---------------------------------------------------------------- checklists

/** Which steps are ticked (ids). */
export const checklistDone = (v: unknown): string[] => asIds(v);

export function checklistProgress(field: FieldDef, v: unknown): { done: number; total: number } {
  const steps = field.steps ?? [];
  const done = new Set(checklistDone(v));
  return { done: steps.filter((s) => done.has(s.id)).length, total: steps.length };
}

/** Steps from text: one per line; a line starting with "#" starts a stage. */
export function stepsFromText(text: string, existing: ChecklistStep[] = []): ChecklistStep[] {
  let stage: string | undefined;
  const out: ChecklistStep[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      stage = line.replace(/^#+\s*/, "") || undefined;
      continue;
    }
    // Keep ids for steps that still exist, so ticks survive edits.
    const keep = existing.find((e) => e.label === line && e.stage === stage && !out.some((o) => o.id === e.id));
    out.push({ id: keep?.id ?? fid("s"), label: line, stage });
  }
  return out;
}

export function stepsToText(steps: ChecklistStep[]): string {
  const lines: string[] = [];
  let stage: string | undefined;
  for (const s of steps) {
    if (s.stage !== stage) {
      stage = s.stage;
      if (stage) lines.push(`# ${stage}`);
    }
    lines.push(s.label);
  }
  return lines.join("\n");
}

/**
 * Finishing a stage's steps moves the item to that stage (never backwards).
 * Stages match status options by name, so "Recorded" steps done → status "Recorded".
 */
export function advanceByChecklist(list: ListDef, values: Record<string, unknown>): Record<string, unknown> | null {
  const sf = statusField(list);
  const cl = list.fields.find((f) => f.type === "checklist" && f.autoAdvance && f.steps?.length);
  if (!sf || !cl || !sf.options?.length) return null;
  const done = new Set(checklistDone(values[cl.id]));
  const order = sf.options.map((o) => o.label.trim().toLowerCase());
  const current = order.indexOf(sf.options.find((o) => o.id === values[sf.id])?.label.trim().toLowerCase() ?? "");
  let target = current;
  for (let i = 0; i < sf.options.length; i++) {
    const steps = cl.steps!.filter((s) => s.stage?.trim().toLowerCase() === order[i]);
    if (!steps.length) continue;
    if (steps.every((s) => done.has(s.id))) target = Math.max(target, i);
    else break;
  }
  if (target <= current) return null;
  return { ...values, [sf.id]: sf.options[target].id };
}

// ---------------------------------------------------------------- cadence

const startOfWeek = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
};
const plusDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * For a date field with a cadence (a weekly release), the coming periods that have nothing
 * in them yet: returns each empty period's first day. Cancelled items don't count.
 */
export function cadenceGaps(items: ListItem[], list: ListDef, field: FieldDef, from: string, count = 6): string[] {
  if (!field.cadence) return [];
  const dates = items
    .filter((i) => i.list_id === list.id && !isCancelled(i, list))
    .map((i) => asDate(field, i.values[field.id])?.date)
    .filter((d): d is string => !!d);
  const gaps: string[] = [];
  if (field.cadence === "month") {
    const [y, m] = from.split("-").map(Number);
    for (let k = 0; k < count; k++) {
      const mm = ((m - 1 + k) % 12) + 1;
      const yy = y + Math.floor((m - 1 + k) / 12);
      const start = `${yy}-${String(mm).padStart(2, "0")}-01`;
      const prefix = start.slice(0, 7);
      if (!dates.some((d) => d.startsWith(prefix))) gaps.push(start);
    }
    return gaps;
  }
  const len = field.cadence === "2weeks" ? 14 : 7;
  let start = startOfWeek(from);
  for (let k = 0; k < count; k++) {
    const end = plusDays(start, len);
    if (!dates.some((d) => d >= start && d < end)) gaps.push(start);
    start = end;
  }
  return gaps;
}
