"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Wallet, ArrowRight, Check, Pencil, Loader2 } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Modal } from "../ui/Modal";
import { Avatar, EmptyState, Field, PersonPicker } from "../ui/Fields";
import { EXPENSE_CATEGORIES, expenseCategoryOf } from "@/lib/categories";
import { formatDay, formatMoney, todayString } from "@/lib/format";
import { CURRENCIES, exchangeRate } from "@/lib/services";
import { netBalances, settleUp } from "@/lib/balances";
import type { Expense } from "@/lib/types";

export function homeAmount(e: Expense, tripCurrency: string): number {
  if (e.currency === tripCurrency) return Number(e.amount);
  return Number(e.amount_home ?? e.amount);
}

export function useBudgetNumbers() {
  const { rows, trip } = useTrip();
  return useMemo(() => {
    const cur = trip?.currency ?? "USD";
    const spent = rows.expenses.filter((e) => e.category !== "settlement").reduce((n, e) => n + homeAmount(e, cur), 0);
    const planned =
      rows.flights.filter((f) => f.status === "booked").reduce((n, f) => n + Number(f.cost ?? 0), 0) +
      rows.stays.filter((s) => s.status === "booked").reduce((n, s) => n + Number(s.cost ?? 0), 0) +
      rows.itinerary_items.reduce((n, i) => n + Number(i.cost ?? 0), 0);
    const budget = Number(trip?.budget ?? 0);
    return { cur, spent, planned, budget, remaining: budget - Math.max(spent, planned) };
  }, [rows.expenses, rows.flights, rows.stays, rows.itinerary_items, trip]);
}

export function BudgetSection({ compact = false }: { compact?: boolean }) {
  const { rows, canEdit, updateTrip, nameOf, colorOf, insert, me, tripId } = useTrip();
  const { cur, spent, planned, budget, remaining } = useBudgetNumbers();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  const travelers = rows.trip_members.filter((m) => m.attendance !== "not_going").map((m) => m.user_id);
  const balances = useMemo(
    () =>
      netBalances(
        rows.expenses.map((e) => ({ amount: homeAmount(e, cur), paid_by: e.paid_by, split_between: e.split_between.length ? e.split_between : travelers })),
        rows.trip_members.map((m) => m.user_id),
      ),
    [rows.expenses, rows.trip_members, travelers, cur],
  );
  const settlements = settleUp(balances);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    rows.expenses.filter((e) => e.category !== "settlement").forEach((e) => (m[e.category] = (m[e.category] ?? 0) + homeAmount(e, cur)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows.expenses, cur]);
  const maxCat = Math.max(1, ...byCategory.map(([, v]) => v));
  const expenses = [...rows.expenses].sort((a, b) => (b.spent_on ?? b.created_at).localeCompare(a.spent_on ?? a.created_at));
  const pct = budget > 0 ? Math.min(100, (Math.max(spent, planned) / budget) * 100) : 0;

  async function settle(from: string, to: string, amount: number) {
    if (!confirm(`Record that ${nameOf(from)} paid ${nameOf(to)} ${formatMoney(amount, cur)}?`)) return;
    await insert("expenses", {
      title: `${nameOf(from)} paid back ${nameOf(to)}`,
      amount,
      currency: cur,
      amount_home: amount,
      category: "settlement",
      paid_by: from,
      split_between: [to],
      spent_on: todayString(),
      created_by: me,
    });
  }

  const stats = (
    <div className="stat-grid">
      <div className="card stat">
        <small>Budget</small>
        {editBudget ? (
          <form
            className="row"
            onSubmit={async (e) => {
              e.preventDefault();
              await updateTrip({ budget: Math.max(0, Number(budgetInput) || 0) });
              setEditBudget(false);
            }}
          >
            <input className="input" type="number" min="0" step="1" autoFocus value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
            <button className="icon-btn" aria-label="Save budget"><Check size={16} /></button>
          </form>
        ) : (
          <strong className="row">
            {budget ? formatMoney(budget, cur) : "Not set"}
            {canEdit && (
              <button className="icon-btn" aria-label="Edit budget" onClick={() => { setBudgetInput(String(budget || "")); setEditBudget(true); }}>
                <Pencil size={14} />
              </button>
            )}
          </strong>
        )}
      </div>
      <div className="card stat">
        <small>Booked & planned</small>
        <strong>{formatMoney(planned, cur)}</strong>
      </div>
      <div className="card stat">
        <small>Spent so far</small>
        <strong>{formatMoney(spent, cur)}</strong>
      </div>
      <div className="card stat">
        <small>{remaining >= 0 ? "Left to spend" : "Over budget"}</small>
        <strong style={{ color: remaining < 0 ? "var(--danger)" : undefined }}>{budget ? formatMoney(Math.abs(remaining), cur) : "—"}</strong>
      </div>
    </div>
  );

  if (compact) {
    const myBal = balances[me] ?? 0;
    return (
      <div className="stack">
        <div className="row-between">
          <div>
            <div className="tiny muted">Spent</div>
            <strong className="heading" style={{ fontSize: "1.6rem" }}>{formatMoney(spent, cur)}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="tiny muted">Budget</div>
            <strong>{budget ? formatMoney(budget, cur) : "—"}</strong>
          </div>
        </div>
        {budget > 0 && <div className="progress"><span style={{ width: `${pct}%` }} /></div>}
        <p className="small">
          {Math.abs(myBal) < 0.01 ? "You're all square. 🙌" : myBal > 0 ? `You're owed ${formatMoney(myBal, cur)}.` : `You owe ${formatMoney(-myBal, cur)}.`}
        </p>
        <div className="row">
          {canEdit && <button className="btn btn-sm" onClick={() => setEditing("new")}><Plus size={14} /> Add expense</button>}
          <Link className="btn btn-sm btn-ghost" href={`/trips/${tripId}/budget`}>Details →</Link>
        </div>
        <ExpenseModal expense={editing} onClose={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>Budget</h1>
          <p>Log what you spend in any currency. Driftbook converts it to {cur} and works out who owes whom.</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add expense</button>}
      </div>
      {stats}
      {budget > 0 && <div className="progress" style={{ margin: "1rem 0 0" }}><span style={{ width: `${pct}%`, background: remaining < 0 ? "var(--danger)" : undefined }} /></div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem", marginTop: "1.2rem" }}>
        <div className="card">
          <h3 style={{ marginBottom: "0.8rem" }}>Settle up</h3>
          {settlements.length === 0 ? (
            <p className="muted">Everyone&apos;s square. 🎉</p>
          ) : (
            <div className="stack">
              {settlements.map((s, i) => (
                <div key={i} className="row">
                  <Avatar name={nameOf(s.from)} color={colorOf(s.from)} size={26} />
                  <span className="small"><strong>{nameOf(s.from)}</strong> owes <strong>{nameOf(s.to)}</strong></span>
                  <ArrowRight size={14} className="muted" />
                  <strong className="grow" style={{ textAlign: "right" }}>{formatMoney(s.amount, cur)}</strong>
                  {canEdit && <button className="btn btn-sm" onClick={() => settle(s.from, s.to, s.amount)}>Mark paid</button>}
                </div>
              ))}
            </div>
          )}
          <div className="divider-line" />
          <div className="stack" style={{ gap: "0.4rem" }}>
            {rows.trip_members.map((m) => {
              const b = balances[m.user_id] ?? 0;
              return (
                <div key={m.user_id} className="row small">
                  <Avatar name={nameOf(m.user_id)} color={m.color} size={22} />
                  <span className="grow">{nameOf(m.user_id)}</span>
                  <span style={{ color: b > 0.004 ? "var(--success)" : b < -0.004 ? "var(--danger)" : "var(--muted)" }}>
                    {b > 0.004 ? `is owed ${formatMoney(b, cur)}` : b < -0.004 ? `owes ${formatMoney(-b, cur)}` : "square"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: "0.8rem" }}>Where the money goes</h3>
          {byCategory.length === 0 ? (
            <p className="muted">No expenses yet.</p>
          ) : (
            <div className="stack" style={{ gap: "0.55rem" }}>
              {byCategory.map(([cat, v]) => {
                const c = expenseCategoryOf(cat);
                return (
                  <div key={cat} className="bar-row">
                    <span className="truncate">{c.emoji} {c.label}</span>
                    <div className="progress"><span style={{ width: `${(v / maxCat) * 100}%` }} /></div>
                    <span className="small nowrap">{formatMoney(v, cur, true)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <h2 style={{ margin: "1.8rem 0 0.8rem" }}>Expenses</h2>
      {expenses.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Wallet />} title="Nothing logged yet">Deposits, tickets, dinners. Add who paid and who it&apos;s split between.</EmptyState>
        </div>
      ) : (
        <div className="card" style={{ padding: "0.4rem" }}>
          {expenses.map((e) => {
            const c = e.category === "settlement" ? { emoji: "🤝", label: "Settle up" } : expenseCategoryOf(e.category);
            return (
              <button key={e.id} className="check-row" style={{ width: "100%", border: 0, background: "none", textAlign: "left", cursor: "pointer", color: "inherit" }} onClick={() => setEditing(e)}>
                <span className="cat-dot">{c.emoji}</span>
                <div className="grow">
                  <strong className="small" style={{ display: "block" }}>{e.title}</strong>
                  <span className="tiny muted">
                    {e.paid_by ? `${nameOf(e.paid_by)} paid` : "Unassigned"} · {e.split_between.length ? `split ${e.split_between.length} ways` : "split with everyone"}
                    {e.spent_on && ` · ${formatDay(e.spent_on)}`}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong className="small">{formatMoney(homeAmount(e, cur), cur)}</strong>
                  {e.currency !== cur && <div className="tiny muted">{formatMoney(e.amount, e.currency)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
      <ExpenseModal expense={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ExpenseModal({ expense, onClose }: { expense: Expense | "new" | null; onClose: () => void }) {
  const { trip, rows, insert, update, remove, canEdit, me, nameOf, colorOf } = useTrip();
  const cur = trip?.currency ?? "USD";
  const existing = expense && expense !== "new" ? expense : null;
  const blank = { title: "", amount: "", currency: cur, amount_home: "", category: "food", paid_by: me, split_between: [] as string[], spent_on: todayString(), notes: "" };
  const [form, setForm] = useState(blank);
  const [loadedFor, setLoadedFor] = useState<unknown>(null);
  const [rateBusy, setRateBusy] = useState(false);
  if (expense !== loadedFor) {
    setLoadedFor(expense);
    setForm(
      existing
        ? {
            title: existing.title,
            amount: String(existing.amount),
            currency: existing.currency,
            amount_home: existing.amount_home?.toString() ?? "",
            category: existing.category,
            paid_by: existing.paid_by ?? "",
            split_between: existing.split_between,
            spent_on: existing.spent_on ?? "",
            notes: existing.notes,
          }
        : { ...blank, split_between: rows.trip_members.filter((m) => m.attendance !== "not_going").map((m) => m.user_id) },
    );
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Convert foreign-currency amounts to the trip currency automatically.
  useEffect(() => {
    if (!expense || form.currency === cur || !form.amount) return;
    let cancelled = false;
    queueMicrotask(() => !cancelled && setRateBusy(true));
    exchangeRate(form.currency, cur).then((rate) => {
      if (cancelled) return;
      setRateBusy(false);
      if (rate) setForm((f) => ({ ...f, amount_home: (Number(f.amount) * rate).toFixed(2) }));
    });
    return () => {
      cancelled = true;
    };
  }, [form.currency, form.amount, cur, expense]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount >= 0)) return;
    const row = {
      title: form.title.trim(),
      amount,
      currency: form.currency,
      amount_home: form.currency === cur ? amount : form.amount_home === "" ? null : Number(form.amount_home),
      category: form.category,
      paid_by: form.paid_by || null,
      split_between: form.split_between,
      spent_on: form.spent_on || null,
      notes: form.notes,
    };
    const ok = existing ? await update("expenses", existing.id, row) : !!(await insert("expenses", { ...row, created_by: me }));
    if (ok) onClose();
  }

  const people = rows.trip_members.map((m) => m.user_id);
  const share = form.split_between.length && form.amount ? (Number(form.currency === cur ? form.amount : form.amount_home || 0) / form.split_between.length) : 0;

  return (
    <Modal
      open={!!expense}
      onClose={onClose}
      title={existing ? "Expense" : "Add an expense"}
      footer={
        canEdit && (
          <>
            {existing && (
              <button className="btn btn-danger" type="button" onClick={async () => { if (confirm("Delete this expense?")) { await remove("expenses", existing.id); onClose(); } }}>
                <Trash2 size={15} /> Delete
              </button>
            )}
            <span className="spacer" />
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" form="expense-form" disabled={!form.title.trim() || form.amount === ""}>{existing ? "Save" : "Add"}</button>
          </>
        )
      }
    >
      <form id="expense-form" className="form-grid" onSubmit={save}>
        <fieldset disabled={!canEdit} style={{ display: "contents" }}>
          <Field label="What for" full><input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ghost tour tickets" required /></Field>
          <Field label="Amount"><input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} required /></Field>
          <Field label="Currency">
            <select className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              {[...new Set([cur, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          {form.currency !== cur && (
            <Field label={`In ${cur}`} hint="Converted at today's rate. You can change it." full>
              <div className="input-icon">
                <input className="input" type="number" min="0" step="0.01" value={form.amount_home} onChange={(e) => set("amount_home", e.target.value)} />
                {rateBusy && <Loader2 size={16} className="spin" />}
              </div>
            </Field>
          )}
          <Field label="Category">
            <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              {form.category === "settlement" && <option value="settlement">🤝 Settle up</option>}
            </select>
          </Field>
          <Field label="Date"><input className="input" type="date" value={form.spent_on} onChange={(e) => set("spent_on", e.target.value)} /></Field>
          <Field label="Who paid" full>
            <select className="input" value={form.paid_by} onChange={(e) => set("paid_by", e.target.value)}>
              <option value="">Not sure</option>
              {people.map((p) => <option key={p} value={p}>{nameOf(p)}</option>)}
            </select>
          </Field>
          <Field label="Split between" hint={share ? `${formatMoney(share, cur)} each` : "Nobody selected = split with everyone going."} full>
            <PersonPicker people={people} value={form.split_between} onChange={(v) => set("split_between", v)} nameOf={nameOf} colorOf={colorOf} />
          </Field>
          <Field label="Notes" full><textarea className="input textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </fieldset>
      </form>
    </Modal>
  );
}
