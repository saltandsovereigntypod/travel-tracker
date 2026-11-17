// Cost splitting: who paid, who owes, and the fewest payments to settle up.

export type SplitMode = "equal" | "shares" | "exact";

export interface SplitExpense {
  amount: number; // already in the trip's home currency
  paid_by: string | null;
  split_between: string[];
  split_mode?: SplitMode;
  /** income: paid_by received the money, which belongs to split_between. */
  kind?: "expense" | "income";
  /** Weights for "shares", amounts for "exact". */
  split_shares?: Record<string, number>;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Spread `cents` over people by weight so the pieces always add up exactly. */
function distribute(cents: number, people: string[], weights: number[]): Record<string, number> {
  const total = weights.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  if (!people.length) return out;
  const w = total > 0 ? weights : people.map(() => 1);
  const wsum = total > 0 ? total : people.length;
  const raw = people.map((_, i) => (cents * w[i]) / wsum);
  const floors = raw.map(Math.floor);
  let left = cents - floors.reduce((a, b) => a + b, 0);
  // Largest remainders get the leftover cents, ties go in list order.
  const order = raw.map((r, i) => [r - floors[i], i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  people.forEach((p, i) => (out[p] = floors[i]));
  return out;
}

/** What each person owes for one expense, in currency units (not cents). */
export function expenseShares(e: SplitExpense, everyone: string[]): Record<string, number> {
  const people = e.split_between.length ? e.split_between : everyone;
  const cents = Math.round(Number(e.amount) * 100);
  const mode = e.split_mode ?? "equal";
  const s = e.split_shares ?? {};
  let byCents: Record<string, number>;
  if (mode === "shares") {
    byCents = distribute(cents, people, people.map((p) => Math.max(0, Number(s[p] ?? 1))));
  } else if (mode === "exact") {
    const exact = people.map((p) => Math.max(0, Math.round(Number(s[p] ?? 0) * 100)));
    const assigned = exact.reduce((a, b) => a + b, 0);
    byCents = Object.fromEntries(people.map((p, i) => [p, exact[i]]));
    // If the typed amounts don't add up to the total, spread the difference evenly
    // so the books always balance.
    const diff = cents - assigned;
    if (diff !== 0) {
      const sign = Math.sign(diff);
      const extra = distribute(Math.abs(diff), people, people.map(() => 1));
      for (const p of people) byCents[p] += sign * extra[p];
    }
  } else {
    byCents = distribute(cents, people, people.map(() => 1));
  }
  return Object.fromEntries(Object.entries(byCents).map(([k, v]) => [k, v / 100]));
}

/** Net balance per person. Positive = they are owed money. Negative = they owe. */
export function netBalances(expenses: SplitExpense[], everyone: string[]): Record<string, number> {
  const bal: Record<string, number> = Object.fromEntries(everyone.map((id) => [id, 0]));
  for (const e of expenses) {
    if (!e.paid_by || !(e.amount > 0)) continue;
    const shares = expenseShares(e, everyone);
    if (!Object.keys(shares).length) continue;
    // Spending: the payer is owed everyone's shares. Income: the receiver owes everyone theirs.
    const sign = e.kind === "income" ? -1 : 1;
    bal[e.paid_by] = (bal[e.paid_by] ?? 0) + sign * Number(e.amount);
    for (const [person, share] of Object.entries(shares)) bal[person] = (bal[person] ?? 0) - sign * share;
  }
  for (const k of Object.keys(bal)) bal[k] = round(bal[k]);
  return bal;
}

/** Combine people who share money (couples, families) into one party. */
export function groupBalances(balances: Record<string, number>, partyOf: (id: string) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(balances)) {
    const party = partyOf(id);
    out[party] = round((out[party] ?? 0) + v);
  }
  return out;
}

/** Greedy settle-up: largest debtor pays largest creditor until everyone is even. */
export function settleUp(balances: Record<string, number>): Settlement[] {
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -0.004)
    .map(([id, v]) => ({ id, amt: -v }))
    .sort((a, b) => b.amt - a.amt);
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0.004)
    .map(([id, v]) => ({ id, amt: v }))
    .sort((a, b) => b.amt - a.amt);
  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = round(Math.min(debtors[i].amt, creditors[j].amt));
    if (pay > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt = round(debtors[i].amt - pay);
    creditors[j].amt = round(creditors[j].amt - pay);
    if (debtors[i].amt <= 0.004) i++;
    if (creditors[j].amt <= 0.004) j++;
  }
  return out;
}
