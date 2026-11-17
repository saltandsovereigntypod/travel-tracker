import { describe, expect, it } from "vitest";
import { netBalances, settleUp } from "@/lib/balances";

const A = "ashley", D = "daniel", L = "lizza";

describe("netBalances", () => {
  it("splits an expense evenly and credits the payer", () => {
    const b = netBalances([{ amount: 90, paid_by: A, split_between: [A, D, L] }], [A, D, L]);
    expect(b).toEqual({ [A]: 60, [D]: -30, [L]: -30 });
  });

  it("splits with everyone when split_between is empty", () => {
    const b = netBalances([{ amount: 40, paid_by: D, split_between: [] }], [A, D]);
    expect(b).toEqual({ [A]: -20, [D]: 20 });
  });

  it("never loses a cent on uneven splits", () => {
    const b = netBalances([{ amount: 100, paid_by: A, split_between: [A, D, L] }], [A, D, L]);
    const total = Object.values(b).reduce((n, v) => n + v, 0);
    expect(Math.abs(total)).toBeLessThan(0.001);
  });

  it("ignores expenses without a payer", () => {
    expect(netBalances([{ amount: 50, paid_by: null, split_between: [A] }], [A])).toEqual({ [A]: 0 });
  });

  it("treats a settlement as paying someone back", () => {
    const b = netBalances(
      [
        { amount: 100, paid_by: A, split_between: [A, D] },
        { amount: 50, paid_by: D, split_between: [A] }, // Daniel pays Ashley back
      ],
      [A, D],
    );
    expect(b).toEqual({ [A]: 0, [D]: 0 });
  });
});

describe("settleUp", () => {
  it("produces the payments that zero everyone out", () => {
    const b = netBalances(
      [
        { amount: 300, paid_by: A, split_between: [A, D, L] },
        { amount: 60, paid_by: L, split_between: [A, D, L] },
      ],
      [A, D, L],
    );
    const s = settleUp(b);
    const after = { ...b };
    for (const p of s) {
      after[p.from] += p.amount;
      after[p.to] -= p.amount;
    }
    Object.values(after).forEach((v) => expect(Math.abs(v)).toBeLessThan(0.01));
    expect(s.length).toBeLessThanOrEqual(2);
  });

  it("returns nothing when everyone is square", () => {
    expect(settleUp({ [A]: 0, [D]: 0 })).toEqual([]);
  });
});
