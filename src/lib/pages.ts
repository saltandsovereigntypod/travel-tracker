// Pages: shared docs made of blocks. Pure helpers (no React) so they can be tested.
// Edits are kept as small operations on top of the last saved copy, which lets two
// people type on the same page without overwriting each other's blocks.

import { uid } from "./format";

export type DocBlockType =
  | "text"
  | "h1"
  | "h2"
  | "h3"
  | "todo"
  | "bullet"
  | "numbered"
  | "quote"
  | "callout"
  | "toggle"
  | "divider"
  | "image"
  | "list"
  | "item"
  | "page"
  | "widget";

export type EmbedView = "cards" | "table" | "checklist" | "board";

export interface DocBlock {
  id: string;
  type: DocBlockType;
  text?: string;
  /** todo */
  checked?: boolean;
  due?: string | null;
  who?: string | null;
  /** callout */
  emoji?: string;
  /** toggle: the hidden part */
  body?: string;
  /** image */
  url?: string;
  caption?: string;
  /** list embed */
  listId?: string;
  view?: EmbedView;
  mine?: boolean;
  hideDone?: boolean;
  limit?: number;
  /** linked item */
  itemId?: string;
  /** subpage */
  pageId?: string;
  /** a live widget from the space (budget, countdown…) */
  widget?: string;
}

export interface Page {
  id: string;
  trip_id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  cover: string;
  blocks: DocBlock[];
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlockMenuEntry {
  type: DocBlockType;
  label: string;
  hint: string;
  icon: string;
  group: "Basic" | "Linked";
  keywords?: string;
}

export const BLOCK_MENU: BlockMenuEntry[] = [
  { type: "text", label: "Text", hint: "Plain writing", icon: "¶", group: "Basic" },
  { type: "h1", label: "Heading 1", hint: "Big section title", icon: "H1", group: "Basic", keywords: "title" },
  { type: "h2", label: "Heading 2", hint: "Medium title", icon: "H2", group: "Basic" },
  { type: "h3", label: "Heading 3", hint: "Small title", icon: "H3", group: "Basic" },
  { type: "todo", label: "To-do", hint: "Checkbox, with an optional date and person", icon: "☑", group: "Basic", keywords: "task check" },
  { type: "bullet", label: "Bulleted list", hint: "Simple bullets", icon: "•", group: "Basic" },
  { type: "numbered", label: "Numbered list", hint: "1, 2, 3", icon: "1.", group: "Basic" },
  { type: "toggle", label: "Toggle", hint: "Hide details until tapped", icon: "▸", group: "Basic", keywords: "collapse" },
  { type: "quote", label: "Quote", hint: "Pull out a quote", icon: "❝", group: "Basic" },
  { type: "callout", label: "Callout", hint: "A highlighted note", icon: "💡", group: "Basic", keywords: "note tip warning" },
  { type: "divider", label: "Divider", hint: "A line between sections", icon: "—", group: "Basic", keywords: "line hr" },
  { type: "image", label: "Image", hint: "A picture from your device or a link", icon: "🖼", group: "Basic", keywords: "photo picture" },
  { type: "list", label: "List view", hint: "Show a list here, live", icon: "▦", group: "Linked", keywords: "database table embed" },
  { type: "item", label: "Linked item", hint: "A live card for one list item", icon: "↗", group: "Linked", keywords: "mention link" },
  { type: "page", label: "Subpage", hint: "A page inside this page", icon: "📄", group: "Linked", keywords: "doc" },
  { type: "widget", label: "Space widget", hint: "Budget, countdown, calendar…", icon: "◫", group: "Linked", keywords: "budget map calendar countdown" },
];

/** Blocks that hold a line of text the user types into. */
export const TEXT_BLOCKS: DocBlockType[] = ["text", "h1", "h2", "h3", "todo", "bullet", "numbered", "quote", "callout", "toggle"];

/** Blocks that continue onto the next line when you press Enter. */
export const CONTINUING: DocBlockType[] = ["todo", "bullet", "numbered"];

export function newBlock(type: DocBlockType = "text", extra: Partial<DocBlock> = {}): DocBlock {
  const b: DocBlock = { id: uid("blk"), type };
  if (TEXT_BLOCKS.includes(type)) b.text = "";
  if (type === "todo") b.checked = false;
  if (type === "callout") b.emoji = "💡";
  if (type === "list") {
    b.view = "cards";
    b.limit = 6;
  }
  return { ...b, ...extra };
}

/** Change a block's type, keeping its text where that makes sense. */
export function convertBlock(b: DocBlock, type: DocBlockType): DocBlock {
  const next = newBlock(type, { id: b.id });
  if (TEXT_BLOCKS.includes(type) && b.text != null) next.text = b.text;
  if (type === "todo" && b.type === "todo") Object.assign(next, { checked: b.checked, due: b.due, who: b.who });
  if (type === "toggle" && b.body) next.body = b.body;
  return next;
}

// ---- Edits as operations -------------------------------------------------

export type BlockOp =
  | { kind: "set"; block: DocBlock; after?: string | null }
  | { kind: "del"; id: string }
  | { kind: "move"; id: string; after: string | null };

function insertAfter(list: DocBlock[], block: DocBlock, after: string | null | undefined) {
  if (after === null) {
    list.unshift(block);
    return;
  }
  const at = after === undefined ? -1 : list.findIndex((b) => b.id === after);
  if (at < 0) list.push(block);
  else list.splice(at + 1, 0, block);
}

/** Apply pending local edits on top of the latest saved blocks. */
export function applyOps(base: DocBlock[], ops: BlockOp[]): DocBlock[] {
  const out = base.map((b) => ({ ...b }));
  for (const op of ops) {
    if (op.kind === "set") {
      const i = out.findIndex((b) => b.id === op.block.id);
      if (i >= 0) out[i] = { ...op.block };
      else insertAfter(out, { ...op.block }, op.after);
    } else if (op.kind === "del") {
      const i = out.findIndex((b) => b.id === op.id);
      if (i >= 0) out.splice(i, 1);
    } else {
      const i = out.findIndex((b) => b.id === op.id);
      if (i < 0) continue;
      const [b] = out.splice(i, 1);
      insertAfter(out, b, op.after);
    }
  }
  return out;
}

/** Collapse consecutive edits of the same block so the pending queue stays small. */
export function pushOp(ops: BlockOp[], op: BlockOp): BlockOp[] {
  const last = ops[ops.length - 1];
  if (op.kind === "set" && last?.kind === "set" && last.block.id === op.block.id) {
    return [...ops.slice(0, -1), { ...last, block: op.block }];
  }
  return [...ops, op];
}

// ---- Inline formatting ---------------------------------------------------

export type InlineToken =
  | { t: "text"; v: string }
  | { t: "b" | "i" | "s" | "code"; v: string }
  | { t: "link"; v: string; href: string };

const INLINE = /(\*\*([^*]+)\*\*)|(~~([^~]+)~~)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)|(https?:\/\/[^\s)]+)/g;

/** A tiny, safe subset of markdown: **bold**, *italic*, ~~strike~~, `code`, [links](url) and bare URLs. */
export function parseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: "text", v: text.slice(last, at) });
    if (m[2]) out.push({ t: "b", v: m[2] });
    else if (m[4]) out.push({ t: "s", v: m[4] });
    else if (m[6]) out.push({ t: "code", v: m[6] });
    else if (m[8]) out.push({ t: "link", v: m[8], href: safeHref(m[9]) });
    else if (m[11]) out.push({ t: "i", v: m[11] });
    else if (m[13]) out.push({ t: "i", v: m[13] });
    else if (m[14]) out.push({ t: "link", v: m[14].replace(/^https?:\/\//, "").replace(/\/$/, ""), href: safeHref(m[14]) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

function safeHref(href: string): string {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(href)) return `https://${href}`;
  return "#";
}

/** Typing these at the start of a line turns it into a block, like Notion. */
export function shortcutFor(text: string): { type: DocBlockType; rest: string; checked?: boolean } | null {
  const rules: [RegExp, DocBlockType, boolean?][] = [
    [/^###\s/, "h3"],
    [/^##\s/, "h2"],
    [/^#\s/, "h1"],
    [/^\[\s?\]\s/, "todo", false],
    [/^\[x\]\s/i, "todo", true],
    [/^[-*]\s/, "bullet"],
    [/^1[.)]\s/, "numbered"],
    [/^>\s/, "toggle"],
    [/^"\s/, "quote"],
    [/^---$/, "divider"],
  ];
  for (const [re, type, checked] of rules) {
    const m = text.match(re);
    if (m) return { type, rest: text.slice(m[0].length), checked };
  }
  return null;
}

// ---- Tree and tasks ------------------------------------------------------

export function childPages(pages: Page[], parentId: string | null): Page[] {
  return pages.filter((p) => (p.parent_id ?? null) === parentId).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export function breadcrumbs(pages: Page[], id: string): Page[] {
  const out: Page[] = [];
  const seen = new Set<string>();
  let cur = pages.find((p) => p.id === id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parent_id ? pages.find((p) => p.id === cur!.parent_id) : undefined;
  }
  return out;
}

/** Every page under `id` (for "this will also delete N subpages"). */
export function descendants(pages: Page[], id: string): Page[] {
  const out: Page[] = [];
  const walk = (pid: string) => {
    for (const c of pages.filter((p) => p.parent_id === pid)) {
      if (out.includes(c)) continue;
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

export interface PageTask {
  page: Page;
  block: DocBlock;
  text: string;
  due: string | null;
  who: string | null;
  done: boolean;
}

/** To-dos written on pages: they show up in Today, Home and the calendar like any other task. */
export function pageTasks(pages: Page[]): PageTask[] {
  const out: PageTask[] = [];
  for (const page of pages) {
    for (const b of Array.isArray(page.blocks) ? page.blocks : []) {
      if (b.type !== "todo" || !(b.text ?? "").trim()) continue;
      out.push({ page, block: b, text: b.text!.trim(), due: b.due ?? null, who: b.who ?? null, done: !!b.checked });
    }
  }
  return out;
}

/** Number shown before a numbered-list block (counts the run it belongs to). */
export function listNumber(blocks: DocBlock[], index: number): number {
  let n = 1;
  for (let i = index - 1; i >= 0 && blocks[i].type === "numbered"; i--) n++;
  return n;
}

/** Plain text of a page, for search and previews. */
export function pageText(page: Pick<Page, "blocks">, max = 160): string {
  const s = (page.blocks ?? [])
    .map((b) => b.text ?? "")
    .filter(Boolean)
    .join(" · ")
    .replace(/[*_~`]/g, "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
