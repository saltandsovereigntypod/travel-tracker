import { describe, expect, it } from "vitest";
import { applyOps, breadcrumbs, convertBlock, descendants, listNumber, pageTasks, parseInline, pushOp, shortcutFor, type DocBlock, type Page } from "@/lib/pages";
import { finalizeSnapshot, instantiate, snapshotSpace } from "@/lib/space-templates";
import type { ListDef, ListItem } from "@/lib/fields";

const b = (id: string, text = id, type: DocBlock["type"] = "text"): DocBlock => ({ id, type, text });
const page = (id: string, parent: string | null = null, blocks: DocBlock[] = []): Page => ({
  id, trip_id: "t", parent_id: parent, title: id, icon: "📄", cover: "", blocks, sort_order: 0,
  created_by: null, updated_by: null, created_at: "2026-01-01", updated_at: "2026-01-01",
});

describe("block edits", () => {
  it("applies local edits on top of someone else's newer copy", () => {
    const base = [b("a"), b("b"), b("c")];
    let ops = pushOp([], { kind: "set", block: b("b", "mine") });
    ops = pushOp(ops, { kind: "set", block: b("n", "new"), after: "b" });
    // Meanwhile someone else edited "a" and added "z" at the end.
    const remote = [b("a", "theirs"), b("b"), b("c"), b("z")];
    expect(applyOps(remote, ops).map((x) => `${x.id}:${x.text}`)).toEqual(["a:theirs", "b:mine", "n:new", "c:c", "z:z"]);
    expect(applyOps(base, ops)).toHaveLength(4);
  });

  it("collapses repeated typing into one op", () => {
    let ops = pushOp([], { kind: "set", block: b("a", "h") });
    ops = pushOp(ops, { kind: "set", block: b("a", "hi") });
    expect(ops).toHaveLength(1);
    expect((ops[0] as { block: DocBlock }).block.text).toBe("hi");
  });

  it("deletes and moves", () => {
    const base = [b("a"), b("b"), b("c")];
    expect(applyOps(base, [{ kind: "del", id: "b" }]).map((x) => x.id)).toEqual(["a", "c"]);
    expect(applyOps(base, [{ kind: "move", id: "c", after: null }]).map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(applyOps(base, [{ kind: "move", id: "a", after: "c" }]).map((x) => x.id)).toEqual(["b", "c", "a"]);
    // A block deleted remotely while I edited it comes back with my text (my edit wins).
    expect(applyOps([b("a")], [{ kind: "set", block: b("x", "kept"), after: "gone" }]).map((x) => x.id)).toEqual(["a", "x"]);
  });

  it("converts blocks keeping text", () => {
    const t = convertBlock({ id: "a", type: "text", text: "Buy flowers" }, "todo");
    expect(t).toMatchObject({ id: "a", type: "todo", text: "Buy flowers", checked: false });
  });
});

describe("inline formatting", () => {
  it("parses bold, italic, links and urls", () => {
    expect(parseInline("a **b** *c* [d](example.com) https://x.io/ `e`")).toEqual([
      { t: "text", v: "a " },
      { t: "b", v: "b" },
      { t: "text", v: " " },
      { t: "i", v: "c" },
      { t: "text", v: " " },
      { t: "link", v: "d", href: "https://example.com" },
      { t: "text", v: " " },
      { t: "link", v: "x.io", href: "https://x.io/" },
      { t: "text", v: " " },
      { t: "code", v: "e" },
    ]);
  });
  it("never produces javascript: links", () => {
    for (const t of parseInline("[x](javascript:alert(1)) [y](data:text/html,hi)")) if (t.t === "link") expect(t.href).toBe("#");
    const l = parseInline("[x](javascript:alert)").find((t) => t.t === "link") as { href: string } | undefined;
    expect(l?.href ?? "#").toBe("#");
  });
  it("knows markdown shortcuts", () => {
    expect(shortcutFor("# Title")).toEqual({ type: "h1", rest: "Title", checked: undefined });
    expect(shortcutFor("[] Call venue")?.type).toBe("todo");
    expect(shortcutFor("- milk")?.type).toBe("bullet");
    expect(shortcutFor("hello")).toBeNull();
  });
});

describe("page tree and tasks", () => {
  const pages = [page("root"), page("kid", "root"), page("grandkid", "kid"), page("other")];
  it("walks the tree", () => {
    expect(breadcrumbs(pages, "grandkid").map((p) => p.id)).toEqual(["root", "kid", "grandkid"]);
    expect(descendants(pages, "root").map((p) => p.id)).toEqual(["kid", "grandkid"]);
  });
  it("collects to-dos with dates and people", () => {
    const p = page("p", null, [
      { id: "1", type: "todo", text: "Book DJ", due: "2027-05-01", who: "u1", checked: false },
      { id: "2", type: "todo", text: "  " },
      { id: "3", type: "text", text: "notes" },
    ]);
    expect(pageTasks([p])).toMatchObject([{ text: "Book DJ", due: "2027-05-01", who: "u1", done: false }]);
  });
  it("numbers list runs", () => {
    const bl = [b("a", "", "numbered"), b("b", "", "numbered"), b("c"), b("d", "", "numbered")];
    expect([0, 1, 3].map((i) => listNumber(bl, i))).toEqual([1, 2, 1]);
  });
});

describe("space templates", () => {
  const guests: ListDef = {
    id: "L1", trip_id: "old", name: "Guests", icon: "💌", description: "", sort_order: 0, settings: {},
    fields: [
      { id: "rsvp", name: "RSVP", type: "status", options: [{ id: "o1", label: "Invited", color: "#000", kind: "todo" }, { id: "o2", label: "Yes", color: "#000", kind: "done" }] },
      { id: "who", name: "Host", type: "person" },
      { id: "date", name: "Date", type: "date" },
      { id: "table", name: "Table", type: "relation", listId: "L2" },
    ],
  };
  const tables: ListDef = {
    id: "L2", trip_id: "old", name: "Tables", icon: "🍽", description: "", sort_order: 1, settings: {},
    fields: [{ id: "count", name: "Guests", type: "rollup", rollup: { via: "back:L1:table", op: "count" } }],
  };
  const items: ListItem[] = [
    { id: "i1", trip_id: "old", list_id: "L1", title: "Aunt May", values: { rsvp: "o2", who: "u1", date: "2027-01-01", table: ["i2"] }, sort_order: 0, created_by: null, created_at: "", updated_at: "" },
    { id: "i2", trip_id: "old", list_id: "L2", title: "Table 1", values: {}, sort_order: 0, created_by: null, created_at: "", updated_at: "" },
  ];
  const pages = [
    page("P1", null, [{ id: "x", type: "list", listId: "L1" }, { id: "y", type: "item", itemId: "i1" }, { id: "z", type: "page", pageId: "P2" }, { id: "w", type: "todo", text: "Seat chart", checked: true, who: "u1", due: "2027-01-02" }]),
    page("P2", "P1"),
  ];

  it("snapshots without people, ticks or (optionally) dates", () => {
    const s = finalizeSnapshot(snapshotSpace({ modules: [{ id: "budget" }] }, { lists: [guests, tables], list_items: items, pages }, { items: true, pages: true, dates: false, design: false }));
    const may = s.items.find((i) => i.title === "Aunt May")!;
    expect(may.values).toEqual({ rsvp: "o1", table: ["i2"], __id: "i1" });
    const todo = s.pages[0].blocks.find((x) => x.type === "todo")!;
    expect(todo).toMatchObject({ checked: false });
    expect(todo.who).toBeUndefined();
    expect(todo.due).toBeUndefined();
    expect(s.design).toBeUndefined();
  });

  it("drops links to things it leaves out", () => {
    const s = snapshotSpace({}, { lists: [guests, tables], list_items: items, pages }, { items: false, pages: true, dates: true, design: false });
    expect(s.items).toEqual([]);
    expect(s.pages[0].blocks.some((x) => x.type === "item")).toBe(false);
    expect(s.pages[0].blocks.find((x) => x.type === "todo")?.due).toBe("2027-01-02");
  });

  it("rewires every link with fresh ids", () => {
    const s = finalizeSnapshot(snapshotSpace({}, { lists: [guests, tables], list_items: items, pages }, { items: true, pages: true, dates: true, design: false }));
    let n = 0;
    const out = instantiate(s, "NEW", () => `id${++n}-xxxxxxxxxxxx`);
    const [g, t] = out.lists;
    expect(g.trip_id).toBe("NEW");
    expect(g.id).not.toBe("L1");
    expect(g.fields.find((f) => f.id === "table")!.listId).toBe(t.id);
    expect(t.fields[0].rollup!.via).toBe(`back:${g.id}:table`);
    const may = out.items.find((i) => i.title === "Aunt May")!;
    const table1 = out.items.find((i) => i.title === "Table 1")!;
    expect(may.list_id).toBe(g.id);
    expect(may.values.table).toEqual([table1.id]);
    expect(may.values).not.toHaveProperty("__id");
    expect(out.pageLevels.map((l) => l.length)).toEqual([1, 1]);
    const [p1] = out.pageLevels[0];
    const [p2] = out.pageLevels[1];
    expect(p2.parent_id).toBe(p1.id);
    expect(p1.blocks.find((x) => x.type === "list")!.listId).toBe(g.id);
    expect(p1.blocks.find((x) => x.type === "item")!.itemId).toBe(may.id);
    expect(p1.blocks.find((x) => x.type === "page")!.pageId).toBe(p2.id);
  });
});
