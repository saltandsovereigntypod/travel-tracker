import type { BlockType, BlockWidth, BoardBlock, PageBlock } from "./types";
import { uid } from "./format";

export interface BlockMeta {
  type: BlockType;
  label: string;
  description: string;
  group: "Trip info" | "Decorate";
  defaultWidth: BlockWidth;
  boardSize: { w: number; h: number };
  /** Path of the full section page, for "open" links. */
  section?: string;
}

export const BLOCKS: BlockMeta[] = [
  { type: "hero", label: "Header", description: "Name, dates and people", group: "Trip info", defaultWidth: "full", boardSize: { w: 720, h: 260 } },
  { type: "countdown", label: "Countdown", description: "Days until the big day, or the next thing", group: "Trip info", defaultWidth: "third", boardSize: { w: 280, h: 200 } },
  { type: "today", label: "Today / Up next", description: "What's happening now", group: "Trip info", defaultWidth: "two-thirds", boardSize: { w: 440, h: 320 }, section: "today" },
  { type: "ideas", label: "Ideas", description: "Everyone's wishlist, with votes", group: "Trip info", defaultWidth: "full", boardSize: { w: 620, h: 460 }, section: "ideas" },
  { type: "itinerary", label: "Itinerary", description: "Day-by-day plan", group: "Trip info", defaultWidth: "full", boardSize: { w: 620, h: 520 }, section: "itinerary" },
  { type: "flights", label: "Flights", description: "Boarding passes", group: "Trip info", defaultWidth: "half", boardSize: { w: 440, h: 340 }, section: "flights" },
  { type: "stays", label: "Stays", description: "Hotels, hostels, rentals", group: "Trip info", defaultWidth: "half", boardSize: { w: 440, h: 340 }, section: "stays" },
  { type: "budget", label: "Budget", description: "Spending and who owes whom", group: "Trip info", defaultWidth: "half", boardSize: { w: 420, h: 340 }, section: "budget" },
  { type: "packing", label: "Checklists", description: "Shared and personal lists", group: "Trip info", defaultWidth: "half", boardSize: { w: 380, h: 420 }, section: "packing" },
  { type: "notes", label: "Notes", description: "Shared notes and journal", group: "Trip info", defaultWidth: "half", boardSize: { w: 420, h: 360 }, section: "notes" },
  { type: "photos", label: "Photos", description: "Photo grid", group: "Trip info", defaultWidth: "full", boardSize: { w: 560, h: 380 }, section: "photos" },
  { type: "map", label: "Map", description: "Everything pinned on a map", group: "Trip info", defaultWidth: "full", boardSize: { w: 620, h: 420 }, section: "map" },
  { type: "people", label: "People", description: "Who's in", group: "Trip info", defaultWidth: "third", boardSize: { w: 300, h: 260 }, section: "people" },
  { type: "list", label: "List", description: "Any list (episodes, guests, bills…) as cards, a board, a table or a checklist", group: "Trip info", defaultWidth: "full", boardSize: { w: 620, h: 460 } },
  { type: "nextup", label: "Next up", description: "What's coming soon, from every list and the calendar", group: "Trip info", defaultWidth: "half", boardSize: { w: 420, h: 360 } },
  { type: "heading", label: "Heading", description: "A big title", group: "Decorate", defaultWidth: "full", boardSize: { w: 480, h: 110 } },
  { type: "text", label: "Text", description: "Your own words", group: "Decorate", defaultWidth: "half", boardSize: { w: 340, h: 200 } },
  { type: "quote", label: "Quote", description: "A quote or mantra", group: "Decorate", defaultWidth: "half", boardSize: { w: 380, h: 180 } },
  { type: "image", label: "Image", description: "A photo or picture", group: "Decorate", defaultWidth: "third", boardSize: { w: 320, h: 260 } },
  { type: "sticker", label: "Sticker", description: "Stamps, tickets, emoji", group: "Decorate", defaultWidth: "third", boardSize: { w: 160, h: 160 } },
  { type: "links", label: "Links", description: "Handy bookmarks", group: "Decorate", defaultWidth: "third", boardSize: { w: 300, h: 220 } },
  { type: "divider", label: "Divider", description: "A decorative line", group: "Decorate", defaultWidth: "full", boardSize: { w: 600, h: 40 } },
];

export const blockMeta = (t: BlockType) => BLOCKS.find((b) => b.type === t)!;

export const WIDTH_SPAN: Record<BlockWidth, number> = { full: 6, "two-thirds": 4, half: 3, third: 2 };

export function newPageBlock(type: BlockType): PageBlock {
  const meta = blockMeta(type);
  const block: PageBlock = { id: uid(type), type, width: meta.defaultWidth };
  if (type === "heading") block.props = { text: "Our adventure" };
  if (type === "text") block.props = { text: "Write anything here. Only you see this block." };
  if (type === "quote") block.props = { text: "Not all those who wander are lost." };
  if (type === "sticker") block.props = { sticker: "/stickers/passport-stamp.svg" };
  if (type === "links") block.props = { links: [] };
  if (type === "list") block.props = { view: "cards", limit: 6 };
  if (type === "nextup") block.props = { limit: 6 };
  return block;
}

const TRIP_LAYOUT: PageBlock[] = [
  { id: "hero", type: "hero", width: "full" },
  { id: "countdown", type: "countdown", width: "third" },
  { id: "today", type: "today", width: "two-thirds" },
  { id: "ideas", type: "ideas", width: "full", props: { limit: 6 } },
  { id: "itinerary", type: "itinerary", width: "full" },
  { id: "flights", type: "flights", width: "half" },
  { id: "stays", type: "stays", width: "half" },
  { id: "budget", type: "budget", width: "half" },
  { id: "packing", type: "packing", width: "half" },
  { id: "map", type: "map", width: "full" },
  { id: "notes", type: "notes", width: "half" },
  { id: "people", type: "people", width: "half" },
  { id: "photos", type: "photos", width: "full" },
];

const list = (key: string, width: PageBlock["width"], view: NonNullable<PageBlock["props"]>["view"], limit = 8): PageBlock => ({
  id: `list-${key}`,
  type: "list",
  width,
  props: { listTemplate: key, view, limit },
});

/** Each kind of space opens on a home made for it. */
const LAYOUTS: Record<string, PageBlock[]> = {
  trip: TRIP_LAYOUT,
  podcast: [
    { id: "hero", type: "hero", width: "full" },
    { id: "countdown", type: "countdown", width: "third" },
    { id: "nextup", type: "nextup", width: "two-thirds", props: { limit: 6 } },
    list("episodes", "full", "board", 30),
    { id: "ideas", type: "ideas", width: "full", props: { limit: 6 } },
    list("podcast_guests", "half", "cards", 6),
    list("sponsors", "half", "cards", 6),
    { id: "itinerary", type: "itinerary", width: "half" },
    { id: "budget", type: "budget", width: "half" },
    { id: "notes", type: "notes", width: "half" },
    { id: "people", type: "people", width: "half" },
    { id: "photos", type: "photos", width: "full" },
  ],
  wedding: [
    { id: "hero", type: "hero", width: "full" },
    { id: "countdown", type: "countdown", width: "third" },
    { id: "nextup", type: "nextup", width: "two-thirds", props: { limit: 6 } },
    list("guests", "full", "table", 12),
    list("vendors", "full", "cards", 6),
    { id: "budget", type: "budget", width: "half" },
    { id: "packing", type: "packing", width: "half" },
    { id: "ideas", type: "ideas", width: "full", props: { limit: 6 } },
    { id: "itinerary", type: "itinerary", width: "full" },
    { id: "photos", type: "photos", width: "full" },
  ],
  household: [
    { id: "hero", type: "hero", width: "full" },
    { id: "nextup", type: "nextup", width: "two-thirds", props: { limit: 6 } },
    { id: "budget", type: "budget", width: "third" },
    list("bills", "half", "checklist", 8),
    list("chores", "half", "checklist", 8),
    { id: "itinerary", type: "itinerary", width: "full" },
    { id: "packing", type: "packing", width: "half" },
    { id: "notes", type: "notes", width: "half" },
    { id: "ideas", type: "ideas", width: "full", props: { limit: 6 } },
  ],
  event: [
    { id: "hero", type: "hero", width: "full" },
    { id: "countdown", type: "countdown", width: "third" },
    { id: "nextup", type: "nextup", width: "two-thirds", props: { limit: 6 } },
    list("guests", "full", "table", 12),
    list("tasks", "half", "checklist", 8),
    { id: "budget", type: "budget", width: "half" },
    { id: "ideas", type: "ideas", width: "full", props: { limit: 6 } },
    { id: "itinerary", type: "itinerary", width: "full" },
    { id: "photos", type: "photos", width: "full" },
  ],
  blank: [
    { id: "hero", type: "hero", width: "full" },
    { id: "nextup", type: "nextup", width: "two-thirds", props: { limit: 6 } },
    { id: "today", type: "today", width: "third" },
    { id: "notes", type: "notes", width: "full" },
  ],
};

export function defaultPageLayout(kind?: string | null): PageBlock[] {
  return (LAYOUTS[kind ?? "trip"] ?? LAYOUTS.blank).map((b) => ({ ...b, props: b.props ? { ...b.props } : undefined }));
}

/** A saved layout that is still exactly the old trip default (never customized). */
export function isUntouchedTripLayout(page: PageBlock[] | undefined): boolean {
  if (!page?.length) return false;
  return page.map((b) => `${b.id}:${b.type}`).join("|") === TRIP_LAYOUT.map((b) => `${b.id}:${b.type}`).join("|");
}

/** Lay out page blocks onto a board in a tidy grid, as a starting point. */
export function pageToBoard(page: PageBlock[]): BoardBlock[] {
  const COL = 220;
  const GAP = 24;
  const out: BoardBlock[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  page.forEach((b, i) => {
    const span = WIDTH_SPAN[b.width];
    const w = span * COL + (span - 1) * GAP;
    const h = Math.max(blockMeta(b.type).boardSize.h, 140);
    if (x + span > 6) {
      x = 0;
      y += rowH + GAP;
      rowH = 0;
    }
    out.push({ id: b.id, type: b.type, x: 40 + x * (COL + GAP), y: 40 + y, w, h, z: i + 1, props: b.props, style: b.style });
    x += span;
    rowH = Math.max(rowH, h);
  });
  return out;
}

export const STICKERS: { src: string; label: string }[] = [
  { src: "/stickers/passport-stamp.svg", label: "Passport stamp" },
  { src: "/stickers/ticket.svg", label: "Boarding pass" },
  { src: "/stickers/watercolor-map.svg", label: "Watercolor map" },
  { src: "/stickers/compass.svg", label: "Compass" },
  { src: "/stickers/pumpkin.svg", label: "Pumpkin" },
  { src: "/stickers/moon.svg", label: "Crescent moon" },
  { src: "/stickers/witch-hat.svg", label: "Witch hat" },
  { src: "/stickers/leaf.svg", label: "Autumn leaf" },
  { src: "/stickers/heart.svg", label: "Heart" },
  { src: "/stickers/star.svg", label: "Star" },
  { src: "/stickers/plane.svg", label: "Plane" },
  { src: "/stickers/tape.svg", label: "Washi tape" },
];

export const EMOJI_STICKERS = ["🎃", "🧙‍♀️", "🕯️", "🦇", "🍂", "👻", "🌙", "✨", "🗺️", "✈️", "🏨", "📸", "☕", "🍁", "🔮", "🖤", "💜", "🧡", "🏰", "⚓", "🦞", "🌊", "🍎", "🐈‍⬛"];
