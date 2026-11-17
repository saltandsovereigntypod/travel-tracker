import { describe, expect, it } from "vitest";
import { BLOCKS, defaultPageLayout, newPageBlock, pageToBoard } from "@/lib/blocks";
import { THEME_PRESETS, resolveTheme, readableOn } from "@/lib/themes";
import { orderForTime } from "@/components/sections/itinerary-order";

describe("layouts", () => {
  it("default page includes every trip section", () => {
    const types = defaultPageLayout().map((b) => b.type);
    for (const t of ["ideas", "itinerary", "flights", "stays", "budget", "packing", "map", "notes", "photos"]) expect(types).toContain(t);
  });

  it("converts a page into non-overlapping board positions", () => {
    const board = pageToBoard(defaultPageLayout());
    for (let i = 0; i < board.length; i++)
      for (let j = i + 1; j < board.length; j++) {
        const a = board[i], b = board[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
  });

  it("creates every block type with a unique id", () => {
    const ids = new Set(BLOCKS.map((m) => newPageBlock(m.type).id));
    expect(ids.size).toBe(BLOCKS.length);
  });
});

describe("themes", () => {
  it("fills missing theme values from the default", () => {
    const t = resolveTheme({ accent: "#ff0000" });
    expect(t.accent).toBe("#ff0000");
    expect(t.headingFont).toBeTruthy();
    expect(t.background.kind).toBeTruthy();
  });

  it("every preset is complete", () => {
    for (const p of THEME_PRESETS) for (const k of ["bg", "surface", "ink", "accent", "headingFont", "bodyFont"] as const) expect(p.theme[k]).toBeTruthy();
  });

  it("picks readable text colors", () => {
    expect(readableOn("#ffffff")).toBe("#1a1a1a");
    expect(readableOn("#111111")).toBe("#ffffff");
  });
});

describe("itinerary ordering", () => {
  const item = (id: string, sort_order: number, start_time: string | null) => ({ id, sort_order, start_time }) as never;
  it("places a timed item between earlier and later ones", () => {
    const day = [item("a", 0, "09:00:00"), item("b", 1, "13:00:00")];
    const o = orderForTime(day, "11:00:00");
    expect(o).toBeGreaterThan(0);
    expect(o).toBeLessThan(1);
  });
  it("puts untimed items at the end", () => {
    expect(orderForTime([item("a", 0, null), item("b", 4, null)], null)).toBe(5);
  });
});
