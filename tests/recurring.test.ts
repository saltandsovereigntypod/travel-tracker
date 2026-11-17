import { describe, expect, it } from "vitest";
import { advanceRecurring, calendarEntries, itemFeeds, itemIncomeTotal, itemMoneyTotal, nextOccurrence, occurrences, type ListDef, type ListItem } from "@/lib/fields";
import { netBalances, settleUp } from "@/lib/balances";
import { buildLists } from "@/lib/list-templates";

const A = "ashley", D = "daniel", L = "lizza";
const mk = (list: ListDef, title: string, values: Record<string, unknown>): ListItem => ({
  id: title, trip_id: "t", list_id: list.id, title, values, sort_order: 0, created_by: A, created_at: "", updated_at: "",
});

describe("repeating dates", () => {
  it("steps by day, week, month and year", () => {
    expect(nextOccurrence("2027-01-10", { freq: "day", interval: 3 })).toBe("2027-01-13");
    expect(nextOccurrence("2027-01-10", { freq: "week", interval: 2 })).toBe("2027-01-24");
    expect(nextOccurrence("2027-01-10", { freq: "month", interval: 1 })).toBe("2027-02-10");
    expect(nextOccurrence("2027-01-10", { freq: "year", interval: 1 })).toBe("2028-01-10");
  });

  it("monthly on the 31st lands on the last day of shorter months, then goes back to the 31st", () => {
    expect(occurrences("2027-01-31", { freq: "month", interval: 1 }, "2027-01-01", "2027-05-31")).toEqual([
      "2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31",
    ]);
  });

  it("stops at the until date", () => {
    expect(occurrences("2027-01-01", { freq: "week", interval: 1, until: "2027-01-20" }, "2027-01-01", "2027-12-31")).toEqual(["2027-01-01", "2027-01-08", "2027-01-15"]);
  });

  it("repeating bills show on every due date in the calendar", () => {
    const [bills] = buildLists(["bills"], "t") as ListDef[];
    const rent = mk(bills, "Rent", { amount: { price: 1200, cost_unit: "group" }, due: "2027-01-01", repeat: { freq: "month", interval: 1 } });
    const days = calendarEntries({ lists: [bills], items: [rent] }, { from: "2027-01-01", to: "2027-04-30" }).map((c) => c.day);
    expect(days).toEqual(["2027-01-01", "2027-02-01", "2027-03-01", "2027-04-01"]);
    expect(itemFeeds(rent, bills)).toContain("Repeats");
  });

  it("finishing a repeating chore schedules the next one", () => {
    const [chores] = buildLists(["chores"], "t") as ListDef[];
    const trash = mk(chores, "Trash", { due: "2027-01-05", repeat: { freq: "week", interval: 1 }, done: true });
    expect(advanceRecurring(trash, chores)).toMatchObject({ due: "2027-01-12", done: false });
  });

  it("does nothing for items that don't repeat", () => {
    const [chores] = buildLists(["chores"], "t") as ListDef[];
    expect(advanceRecurring(mk(chores, "Once", { due: "2027-01-05", done: true }), chores)).toBeNull();
  });
});

describe("income", () => {
  it("sponsor deals are income, not spending", () => {
    const [sponsors] = buildLists(["sponsors"], "t") as ListDef[];
    const deal = mk(sponsors, "Coffee Co", { amount: { price: 500, cost_unit: "group" } });
    expect(itemMoneyTotal(deal, sponsors, { going: [A, D] })).toBeNull();
    expect(itemIncomeTotal(deal, sponsors, { going: [A, D] })).toBe(500);
    expect(itemFeeds(deal, sponsors)).toContain("Income");
  });

  it("whoever receives income owes everyone their share", () => {
    // Ashley received $300 that belongs to all three.
    const bal = netBalances([{ amount: 300, paid_by: A, split_between: [A, D, L], kind: "income" }], [A, D, L]);
    expect(bal).toEqual({ [A]: -200, [D]: 100, [L]: 100 });
    expect(settleUp(bal)).toEqual([
      { from: A, to: D, amount: 100 },
      { from: A, to: L, amount: 100 },
    ]);
  });

  it("income can cancel out spending", () => {
    const bal = netBalances(
      [
        { amount: 100, paid_by: D, split_between: [A, D] },
        { amount: 100, paid_by: D, split_between: [A, D], kind: "income" },
      ],
      [A, D],
    );
    expect(bal).toEqual({ [A]: 0, [D]: 0 });
  });
});
