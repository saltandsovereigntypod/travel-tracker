import { describe, expect, it } from "vitest";
import { costSummary, costTotal, costUnits, pairCount, partyCount, participantsOf, unitLabel } from "@/lib/costs";
import { expenseShares, groupBalances, netBalances, settleUp } from "@/lib/balances";
import type { CostFields } from "@/lib/types";

const A = "ashley", D = "daniel", L = "lizza", M = "mo";
const couple = (id: string) => (id === A || id === D ? "h1" : null);
const cost = (p: Partial<CostFields>): CostFields => ({ cost_unit: "group", cost_unit_size: null, cost_qty: null, cost_unit_label: "", ...p });
const usd = (n: number) => `$${n}`;

describe("cost units", () => {
  it("per person multiplies by who's doing it", () => {
    expect(costTotal(35, cost({ cost_unit: "person" }), { participants: [A, D, L] })).toBe(105);
  });

  it("per group is a flat total", () => {
    expect(costTotal(200, cost({ cost_unit: "group" }), { participants: [A, D, L] })).toBe(200);
  });

  it("per 2 people rounds up for odd groups", () => {
    expect(costUnits(cost({ cost_unit: "pair" }), { participants: [A, D, L] })).toBe(2);
    expect(costUnits(cost({ cost_unit: "pair" }), { participants: [A, D, L, M] })).toBe(2);
  });

  it("per 2 people keeps couples together", () => {
    expect(pairCount([A, L, D, M], couple)).toBe(2);
    expect(pairCount([A, D, L], couple)).toBe(2);
  });

  it("per X people", () => {
    expect(costUnits(cost({ cost_unit: "people", cost_unit_size: 4 }), { participants: [A, D, L, M, "x"] })).toBe(2);
  });

  it("per night uses nights by default, or a typed quantity", () => {
    expect(costTotal(150, cost({ cost_unit: "night" }), { participants: [A, D], nights: 13 })).toBe(1950);
    expect(costTotal(150, cost({ cost_unit: "night", cost_qty: 2 }), { participants: [A, D], nights: 13 })).toBe(300);
  });

  it("per room defaults to one room per household or solo traveler", () => {
    expect(partyCount([A, D, L], couple)).toBe(2);
    expect(costUnits(cost({ cost_unit: "room" }), { participants: [A, D, L], householdOf: couple })).toBe(2);
  });

  it("per hour, per car and custom use the quantity", () => {
    expect(costTotal(40, cost({ cost_unit: "hour", cost_qty: 3 }), { participants: [A] })).toBe(120);
    expect(costTotal(60, cost({ cost_unit: "car", cost_qty: 2 }), { participants: [A, D, L] })).toBe(120);
    expect(costTotal(5, cost({ cost_unit: "custom", cost_unit_label: "locker", cost_qty: 3 }), { participants: [A] })).toBe(15);
  });

  it("no price means no total", () => {
    expect(costTotal(null, cost({ cost_unit: "person" }), { participants: [A] })).toBeNull();
  });

  it("describes costs in plain words", () => {
    expect(unitLabel(cost({ cost_unit: "custom", cost_unit_label: "locker" }))).toBe("per locker");
    expect(costSummary(35, cost({ cost_unit: "person" }), { participants: [A, D, L] }, usd)).toBe("$35 per person × 3 people = $105");
    expect(costSummary(200, cost({ cost_unit: "group" }), { participants: [A] }, usd)).toBe("$200 total");
  });

  it("empty participant list means everyone going", () => {
    expect(participantsOf([], [A, D])).toEqual([A, D]);
    expect(participantsOf([L], [A, D])).toEqual([L]);
  });
});

describe("custom splits", () => {
  it("splits by shares", () => {
    const s = expenseShares({ amount: 90, paid_by: A, split_between: [A, D, L], split_mode: "shares", split_shares: { [A]: 2, [D]: 1, [L]: 0 } }, [A, D, L]);
    expect(s).toEqual({ [A]: 60, [D]: 30, [L]: 0 });
  });

  it("splits by exact amounts", () => {
    const s = expenseShares({ amount: 100, paid_by: A, split_between: [A, L], split_mode: "exact", split_shares: { [A]: 70, [L]: 30 } }, [A, L]);
    expect(s).toEqual({ [A]: 70, [L]: 30 });
  });

  it("exact amounts that don't add up still balance", () => {
    const s = expenseShares({ amount: 100, paid_by: A, split_between: [A, L], split_mode: "exact", split_shares: { [A]: 70, [L]: 20 } }, [A, L]);
    expect(s[A] + s[L]).toBeCloseTo(100);
  });

  it("shares never lose a cent", () => {
    const s = expenseShares({ amount: 100, paid_by: A, split_between: [A, D, L], split_mode: "shares", split_shares: { [A]: 1, [D]: 1, [L]: 1 } }, [A, D, L]);
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });
});

describe("households in settle-up", () => {
  it("a couple settles as one party", () => {
    const bal = netBalances([{ amount: 300, paid_by: L, split_between: [A, D, L] }], [A, D, L]);
    const grouped = groupBalances(bal, (id) => couple(id) ?? id);
    expect(grouped).toEqual({ h1: -200, [L]: 200 });
    expect(settleUp(grouped)).toEqual([{ from: "h1", to: L, amount: 200 }]);
  });

  it("money moving inside a couple cancels out", () => {
    const bal = netBalances([{ amount: 100, paid_by: A, split_between: [A, D] }], [A, D]);
    expect(settleUp(groupBalances(bal, (id) => couple(id) ?? id))).toEqual([]);
  });
});
