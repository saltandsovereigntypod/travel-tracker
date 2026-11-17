import { describe, expect, it } from "vitest";
import { boardColumns, defaultGroupField, filterItems, itemsByDay, monthGrid, sortItems } from "@/lib/views";
import { buildLists } from "@/lib/list-templates";
import type { ListDef, ListItem } from "@/lib/fields";

const [vendors] = buildLists(["vendors"], "t") as ListDef[];
const it_ = (id: string, title: string, values: Record<string, unknown>, sort_order = 0): ListItem => ({
  id, trip_id: "t", list_id: vendors.id, title, values, sort_order, created_by: null, created_at: "", updated_at: "",
});
const a = it_("a", "Florist", { price: { price: 900 }, status: "contacted", deposit_due: "2027-02-01" }, 2);
const b = it_("b", "Venue", { price: { price: 12000 }, status: "booked", deposit_due: "2027-01-10" }, 1);
const c = it_("c", "Band", { status: "researching" }, 3);

describe("sorting", () => {
  it("keeps manual order by default", () => {
    expect(sortItems([a, b, c], vendors).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
  it("sorts by money with empty values last", () => {
    expect(sortItems([a, b, c], vendors, { field: "price", dir: "desc" }).map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(sortItems([a, b, c], vendors, { field: "price", dir: "asc" }).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("sorts by date and by title", () => {
    expect(sortItems([a, b, c], vendors, { field: "deposit_due", dir: "asc" }).map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(sortItems([a, b, c], vendors, { field: "title", dir: "asc" }).map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
});

describe("board", () => {
  it("groups by status with an empty column", () => {
    const cols = boardColumns([a, b, c, it_("d", "Cake", {})], defaultGroupField(vendors)!, []);
    expect(cols.map((col) => `${col.label}:${col.items.length}`)).toEqual(["Researching:1", "Contacted:1", "Booked:1", "Passed:0", "No status:1"]);
  });
});

describe("filters", () => {
  it("hides finished items", () => {
    expect(filterItems([a, b, c], vendors, { hideDone: true }, "me").map((i) => i.id)).toEqual(["a", "c"]);
  });
  it("searches titles and values", () => {
    expect(filterItems([a, b, c], vendors, {}, "me", "flor").map((i) => i.id)).toEqual(["a"]);
  });
});

describe("calendar", () => {
  it("builds a 6-week month starting Sunday", () => {
    const g = monthGrid(2027, 0); // January 2027 starts on a Friday
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-12-27");
    expect(g[5]).toBe("2027-01-01");
  });
  it("groups items by day", () => {
    const f = vendors.fields.find((x) => x.id === "deposit_due")!;
    expect(Object.keys(itemsByDay([a, b, c], f)).sort()).toEqual(["2027-01-10", "2027-02-01"]);
  });
});
