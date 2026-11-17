"use client";

import { useState } from "react";
import { CheckCircle2, CircleDollarSign, PiggyBank } from "lucide-react";
import { useTrip } from "../TripProvider";
import { formatDay, formatMoney } from "@/lib/format";
import type { Expense, LinkedType } from "@/lib/types";
import { ExpenseModal, type ExpensePreset } from "./Budget";
import { homeAmount, useMoney, type CostedThing } from "./money";

export function PayStatus({ thing }: { thing: CostedThing | undefined }) {
  const { trip } = useTrip();
  const cur = trip?.currency ?? "USD";
  if (!thing || thing.status === "none") return null;
  const verb = thing.income ? "received" : "paid";
  if (thing.status === "paid") return <span className="pay-status pay-paid">✓ {thing.income ? "Received" : "Paid"}</span>;
  if (thing.status === "deposit") return <span className="pay-status pay-deposit">{formatMoney(thing.paid, cur)} {verb} · {formatMoney(thing.remaining, cur)} left</span>;
  return <span className="pay-status pay-unpaid">{thing.income ? "Not received yet" : "Not paid yet"}</span>;
}

/** Shows what a plan/flight/stay costs, what's been paid, and buttons to pay it. */
export function PaymentPanel({ type, id, category, income = false }: { type: LinkedType; id: string; category: string; income?: boolean }) {
  const { canEdit, trip, nameOf } = useTrip();
  const money = useMoney();
  const thing = (income ? money.incomeByKey : money.byKey)[`${type}:${id}`];
  const cur = trip?.currency ?? "USD";
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [preset, setPreset] = useState<ExpensePreset | null>(null);

  if (!thing) {
    return <p className="tiny muted">Mark it as booked to track payments.</p>;
  }

  const open = (p: ExpensePreset | null, e: Expense | "new") => {
    setPreset(p);
    setEditing(e);
  };

  return (
    <div className="pay-panel">
      <div className="row-between">
        <strong className="small row"><CircleDollarSign size={15} /> {income ? "Money in" : "Payment"}{thing.period && <span className="tiny muted" style={{ fontWeight: 500 }}>· for {formatDay(thing.period, { weekday: undefined })}</span>}</strong>
        <PayStatus thing={thing} />
      </div>
      {thing.total != null && (
        <div className="row-between small">
          <span className="muted">Total {formatMoney(thing.total, cur)}</span>
          <span>{thing.remaining > 0 ? <>{income ? "Still expected" : "Left to pay"} <strong>{formatMoney(thing.remaining, cur)}</strong></> : thing.paid > 0 ? (income ? "All received" : "All paid") : ""}</span>
        </div>
      )}
      {thing.payments.length > 0 && (
        <div className="stack" style={{ gap: 2 }}>
          {thing.payments.map((e) => (
            <button key={e.id} type="button" className="check-row" style={{ border: 0, background: "none", textAlign: "left", cursor: "pointer", color: "inherit", padding: "0.3rem 0.2rem" }} onClick={() => open(null, e)}>
              {e.is_deposit ? <PiggyBank size={14} /> : <CheckCircle2 size={14} />}
              <span className="grow small">{income ? "Received" : e.is_deposit ? "Deposit" : "Payment"} · {nameOf(e.paid_by)}{e.spent_on ? ` · ${formatDay(e.spent_on)}` : ""}</span>
              <strong className="small">{formatMoney(homeAmount(e, cur), cur)}</strong>
            </button>
          ))}
        </div>
      )}
      {canEdit && thing.status !== "paid" && (
        <div className="row wrap">
          {!income && (
            <button type="button" className="btn btn-sm" onClick={() => open({ title: `${thing.name ?? thing.title} (deposit)`, category, linked_type: type, linked_id: id, is_deposit: true, split_between: thing.participants, period: thing.period ?? null }, "new")}>
              <PiggyBank size={14} /> Add deposit
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => open({ title: thing.name ?? thing.title, amount: thing.total != null ? thing.remaining : undefined, category, linked_type: type, linked_id: id, split_between: thing.participants, period: thing.period ?? null, kind: income ? "income" : "expense" }, "new")}
          >
            <CheckCircle2 size={14} /> {income ? "Mark as received" : "Mark as paid"}
          </button>
        </div>
      )}
      {thing.total == null && <p className="tiny muted">Add a price above to see what&apos;s left to pay.</p>}
      <ExpenseModal expense={editing} preset={preset} onClose={() => setEditing(null)} />
    </div>
  );
}
