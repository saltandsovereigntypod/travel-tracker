import { describe, expect, it } from "vitest";
import {
  assignedTo, backlinksFor, calendarEntries, isDone, itemFeeds, itemMoneyTotal, linkedItems, listProgress,
  mapEntries, rollupValue, stripLinks, type ListDef, type ListItem,
} from "@/lib/fields";
import { buildLists } from "@/lib/list-templates";

const A = "ashley", D = "daniel";

function item(id: string, list_id: string, title: string, values: Record<string, unknown> = {}): ListItem {
  return { id, trip_id: "t", list_id, title, values, sort_order: 0, created_by: A, created_at: "", updated_at: "" };
}

// Podcast space: Episodes ↔ Guests, plus Sponsors → Episodes.
const lists = buildLists(["episodes", "podcast_guests", "sponsors"], "t") as ListDef[];
const [episodes, guests, sponsors] = lists;

const g1 = item("g1", guests.id, "Dr. Rivera", { status: "confirmed" });
const g2 = item("g2", guests.id, "Sam Lee", { status: "pitched" });
const e1 = item("e1", episodes.id, "Ep 1", { guests: ["g1", "g2"], status: "published", record: { date: "2027-01-10", time: "14:00:00" }, release: "2027-01-20", host: [A, D] });
const e2 = item("e2", episodes.id, "Ep 2", { guests: ["g1"], status: "editing", release: "2027-02-01", editor: D });
const e3 = item("e3", episodes.id, "Ep 3", { status: "shelved", release: "2027-03-01" });
const s1 = item("s1", sponsors.id, "Coffee Co", { amount: { price: 500, cost_unit: "group" }, episodes: ["e1", "e2"] });
const ctx = { lists, items: [g1, g2, e1, e2, e3, s1] };

describe("templates", () => {
  it("links lists created together", () => {
    expect(episodes.fields.find((f) => f.id === "guests")?.listId).toBe(guests.id);
    expect(sponsors.fields.find((f) => f.id === "episodes")?.listId).toBe(episodes.id);
  });
  it("drops links to lists that don't exist", () => {
    const [solo] = buildLists(["episodes"], "t") as ListDef[];
    expect(solo.fields.some((f) => f.type === "relation")).toBe(false);
  });
  it("links to an existing list made from the matching template", () => {
    const [ep] = buildLists(["episodes"], "t", [{ id: "existing-guests", settings: { template: "podcast_guests" } }]) as ListDef[];
    expect(ep.fields.find((f) => f.id === "guests")?.listId).toBe("existing-guests");
  });
});

describe("two-way links", () => {
  it("follows a relation forward", () => {
    expect(linkedItems(e1, "guests", ctx).map((i) => i.id)).toEqual(["g1", "g2"]);
  });
  it("shows the link on the other list automatically", () => {
    const back = backlinksFor(guests, ctx);
    expect(back).toHaveLength(1);
    expect(linkedItems(g1, back[0].key, ctx).map((i) => i.id).sort()).toEqual(["e1", "e2"]);
    expect(linkedItems(g2, back[0].key, ctx).map((i) => i.id)).toEqual(["e1"]);
  });
  it("cleans up links when an item is deleted", () => {
    expect(stripLinks(e1.values, episodes, "g2")).toMatchObject({ guests: ["g1"] });
    expect(stripLinks(e3.values, episodes, "g2")).toBeNull();
  });
});

describe("rollups", () => {
  const back = () => backlinksFor(guests, ctx)[0].key;
  it("counts linked items", () => {
    expect(rollupValue(g1, { id: "n", name: "Episodes", type: "rollup", rollup: { via: back(), op: "count" } }, guests, ctx)).toBe(2);
  });
  it("finds the latest linked date", () => {
    expect(rollupValue(g1, { id: "n", name: "Last release", type: "rollup", rollup: { via: back(), target: "release", op: "latest" } }, guests, ctx)).toBe("2027-02-01");
  });
  it("counts finished linked items", () => {
    expect(rollupValue(g1, { id: "n", name: "Published", type: "rollup", rollup: { via: back(), target: "status", op: "checked" } }, guests, ctx)).toBe(1);
  });
  it("sums money through links", () => {
    const backToSponsors = backlinksFor(episodes, ctx).find((b) => b.fromList.id === sponsors.id)!.key;
    expect(rollupValue(e1, { id: "n", name: "Sponsor $", type: "rollup", rollup: { via: backToSponsors, target: "amount", op: "sum" } }, episodes, ctx, { going: [A, D] })).toBe(500);
  });
});

describe("what flows where", () => {
  it("dates feed the calendar, skipping cancelled items", () => {
    const cal = calendarEntries(ctx);
    expect(cal.map((c) => `${c.item.id}:${c.field.id}:${c.day}`)).toEqual(["e1:record:2027-01-10", "e1:release:2027-01-20", "e2:release:2027-02-01"]);
    expect(cal[0].time).toBe("14:00:00");
  });

  it("money feeds the budget unless switched off", () => {
    const [vendors] = buildLists(["vendors"], "t") as ListDef[];
    const v = item("v1", vendors.id, "Photographer", { price: { price: 3500, cost_unit: "group" }, status: "booked" });
    expect(itemMoneyTotal(v, vendors, { going: [A, D] })).toBe(3500);
    // Sponsor deal amounts are income, so they don't count as spending.
    expect(itemMoneyTotal(s1, sponsors, { going: [A, D] })).toBeNull();
    const passed = item("v2", vendors.id, "Other", { price: { price: 900, cost_unit: "group" }, status: "passed" });
    expect(itemMoneyTotal(passed, vendors, { going: [A, D] })).toBeNull();
  });

  it("per-person money uses the item's people", () => {
    const [cos] = buildLists(["costumes"], "t") as ListDef[];
    const c = item("c1", cos.id, "Witches", { who: [A, D], cost: { price: 40, cost_unit: "person" } });
    expect(itemMoneyTotal(c, cos, { going: [A, D, "lizza"] })).toBe(80);
  });

  it("places feed the map", () => {
    const [r] = buildLists(["restaurants"], "t") as ListDef[];
    const x = item("r1", r.id, "Turner's", { where: { name: "Turner's", lat: 42.5, lng: -70.9 } });
    expect(mapEntries({ lists: [r], items: [x] })).toHaveLength(1);
    const [g] = buildLists(["guests"], "t") as ListDef[];
    const y = item("y", g.id, "Aunt May", { address: { name: "Home", lat: 1, lng: 2 } });
    expect(mapEntries({ lists: [g], items: [y] })).toHaveLength(0); // mailing addresses stay off the map
  });

  it("people get assignments", () => {
    expect(assignedTo(D, ctx).map((x) => x.item.id)).toEqual(["e2"]); // e1 is published (done)
  });

  it("progress and done", () => {
    expect(isDone(e1, episodes)).toBe(true);
    expect(listProgress(episodes, [e1, e2, e3])).toEqual({ done: 1, total: 2 });
    const [chores] = buildLists(["chores"], "t") as ListDef[];
    expect(isDone(item("c", chores.id, "Trash", { done: true }), chores)).toBe(true);
  });

  it("labels what an item feeds", () => {
    expect(itemFeeds(e1, episodes).sort()).toEqual(["Assignments", "Calendar", "Linked lists"]);
  });
});
