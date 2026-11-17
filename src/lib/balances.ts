// Cost splitting: who paid, who owes, and the fewest payments to settle up.

export interface SplitExpense {
  amount: number; // already in the trip's home currency
  paid_by: string | null;
  split_between: string[];
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Net balance per person. Positive = they are owed money. Negative = they owe. */
export function netBalances(expenses: SplitExpense[], everyone: string[]): Record<string, number> {
  const bal: Record<string, number> = Object.fromEntries(everyone.map((id) => [id, 0]));
  for (const e of expenses) {
    if (!e.paid_by || !(e.amount > 0)) continue;
    const split = e.split_between.length ? e.split_between : everyone;
    if (!split.length) continue;
    // Spread cents fairly so the shares always add up to the total.
    const cents = Math.round(e.amount * 100);
    const base = Math.floor(cents / split.length);
    let remainder = cents - base * split.length;
    bal[e.paid_by] = (bal[e.paid_by] ?? 0) + cents / 100;
    for (const person of split) {
      const share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      bal[person] = (bal[person] ?? 0) - share / 100;
    }
  }
  for (const k of Object.keys(bal)) bal[k] = round(bal[k]);
  return bal;
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
