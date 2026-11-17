"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Wallet, ArrowRight, Check, Pencil, Loader2, Users, HeartHandshake } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Modal } from "../ui/Modal";
import { Avatar, EmptyState, Field, PersonPicker, Segmented } from "../ui/Fields";
import { EXPENSE_CATEGORIES, expenseCategoryOf } from "@/lib/categories";
import { formatDay, formatMoney, todayString } from "@/lib/format";
import { CURRENCIES, exchangeRate } from "@/lib/services";
import { expenseShares, groupBalances, netBalances, settleUp } from "@/lib/balances";
import type { Expense, LinkedType, SplitMode } from "@/lib/types";
import { homeAmount, useMoney, type CostedThing } from "./money";
import { PayStatus } from "./Payments";

export { homeAmount };

/** Fields to prefill when creating an expense from somewhere else (e.g. "Mark as paid"). */
export interface ExpensePreset {
  title?: string;
  amount?: number;
  category?: string;
  linked_type?: LinkedType;
  linked_id?: string;
  is_deposit?: boolean;
  split_between?: string[];
}

export function BudgetSection({ compact = false }: { compact?: boolean }) {
  const { rows, canEdit, updateTrip, nameOf, colorOf, insert, me, tripId, partyOf, partyName, households } = useTrip();
  const money = useMoney();
  const { cur, spent, committedTotal, stillToPay, wishlist, budget, remainingBudget } = money;
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [preset, setPreset] = useState<ExpensePreset | null>(null);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [combine, setCombine] = useState(true);

  const everyone = rows.trip_members.map((m) => m.user_id);
  const going = rows.trip_members.filter((m) => m.attendance !== "not_going").map((m) => m.user_id);
  const balances = useMemo(
    () =>
      netBalances(
        rows.expenses.map((e) => ({
          amount: homeAmount(e, cur),
          paid_by: e.paid_by,
          split_between: e.split_between.length ? e.split_between : going,
          split_mode: e.split_mode,
          split_shares: e.split_shares,
        })),
        everyone,
      ),
    [rows.expenses, everyone, going, cur],
  );
  const hasHouseholds = households.length > 0;
  const grouped = combine && hasHouseholds ? groupBalances(balances, partyOf) : balances;
  const settlements = settleUp(grouped);
  const label = (party: string) => (combine && hasHouseholds ? partyName(party) : nameOf(party));

  // My share of what's still to be paid (equal split among people doing each thing).
  const myShareLeft = money.committed.reduce((n, c) => (c.participants.includes(me) && c.participants.length ? n + c.remaining / c.participants.length : n), 0);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    rows.expenses.filter((e) => e.category !== "settlement").forEach((e) => (m[e.category] = (m[e.category] ?? 0) + homeAmount(e, cur)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows.expenses, cur]);
  const maxCat = Math.max(1, ...byCategory.map(([, v]) => v));
  const expenses = [...rows.expenses].sort((a, b) => (b.spent_on ?? b.created_at).localeCompare(a.spent_on ?? a.created_at));
  const toPay = money.committed.filter((c) => c.status === "unpaid" || c.status === "deposit").sort((a, b) => (a.day ?? "9999").localeCompare(b.day ?? "9999"));
  const pct = budget > 0 ? Math.min(100, ((spent + stillToPay) / budget) * 100) : 0;

  function openNew(p: ExpensePreset | null = null) {
    setPreset(p);
    setEditing("new");
  }

  async function settle(from: string, to: string, amount: number) {
    if (!confirm(`Record that ${label(from)} paid ${label(to)} ${formatMoney(amount, cur)}?`)) return;
    // Pay from/to the first member of each party.
    const pick = (party: string) => (rows.trip_members.find((m) => partyOf(m.user_id) === party)?.user_id ?? party);
    await insert("expenses", {
      title: `${label(from)} paid back ${label(to)}`,
      amount,
      currency: cur,
      amount_home: amount,
      category: "settlement",
      paid_by: pick(from),
      split_between: [pick(to)],
      spent_on: todayString(),
      created_by: me,
    });
  }

  if (compact) {
    const myBal = combine && hasHouseholds ? grouped[partyOf(me)] ?? 0 : balances[me] ?? 0;
    return (
      <div className="stack">
        <div className="row-between">
          <div>
            <div className="tiny muted">Spent</div>
            <strong className="heading" style={{ fontSize: "1.6rem" }}>{formatMoney(spent, cur)}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="tiny muted">Still to pay</div>
            <strong>{formatMoney(stillToPay, cur)}</strong>
          </div>
        </div>
        {budget > 0 && <div className="progress"><span style={{ width: `${pct}%` }} /></div>}
        <p className="small">
          {Math.abs(myBal) < 0.01 ? "You're all square. 🙌" : myBal > 0 ? `You're owed ${formatMoney(myBal, cur)}.` : `You owe ${formatMoney(-myBal, cur)}.`}
          {myShareLeft > 0.01 && <span className="muted"> Your share still to pay: {formatMoney(myShareLeft, cur)}.</span>}
        </p>
        <div className="row">
          {canEdit && <button className="btn btn-sm" onClick={() => openNew()}><Plus size={14} /> Add expense</button>}
          <Link className="btn btn-sm btn-ghost" href={`/trips/${tripId}/budget`}>Details →</Link>
        </div>
        <ExpenseModal expense={editing} preset={preset} onClose={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <ModuleTitle id="budget" fallback="Budget" />
          <p>Plans you schedule count as <strong>still to pay</strong>. Mark them paid (or pay a deposit) and they move to <strong>spent</strong>.</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => openNew()}><Plus size={16} /> Add expense</button>}
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <small>Budget</small>
          {editBudget ? (
            <form className="row" onSubmit={async (e) => { e.preventDefault(); await updateTrip({ budget: Math.max(0, Number(budgetInput) || 0) }); setEditBudget(false); }}>
              <input className="input" type="number" min="0" step="1" autoFocus value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
              <button className="icon-btn" aria-label="Save budget"><Check size={16} /></button>
            </form>
          ) : (
            <strong className="row">
              {budget ? formatMoney(budget, cur) : "Not set"}
              {canEdit && <button className="icon-btn" aria-label="Edit budget" onClick={() => { setBudgetInput(String(budget || "")); setEditBudget(true); }}><Pencil size={14} /></button>}
            </strong>
          )}
        </div>
        <div className="card stat"><small>Spent (paid)</small><strong>{formatMoney(spent, cur)}</strong></div>
        <div className="card stat"><small>Still to pay</small><strong>{formatMoney(stillToPay, cur)}</strong><span className="tiny muted">of {formatMoney(committedTotal, cur)} planned</span></div>
        <div className="card stat">
          <small>{remainingBudget >= 0 ? "Left in budget" : "Over budget"}</small>
          <strong style={{ color: remainingBudget < 0 ? "var(--danger)" : undefined }}>{budget ? formatMoney(Math.abs(remainingBudget), cur) : "—"}</strong>
        </div>
        <div className="card stat"><small>Wishlist (ideas)</small><strong>{formatMoney(wishlist, cur)}</strong><span className="tiny muted">if you did every idea</span></div>
        <div className="card stat"><small>Your share to pay</small><strong>{formatMoney(myShareLeft, cur)}</strong></div>
      </div>
      {budget > 0 && <div className="progress" style={{ margin: "1rem 0 0" }}><span style={{ width: `${pct}%`, background: remainingBudget < 0 ? "var(--danger)" : undefined }} /></div>}

      {toPay.length > 0 && (
        <>
          <h2 style={{ margin: "1.8rem 0 0.8rem" }}>Still to pay</h2>
          <div className="card" style={{ padding: "0.4rem" }}>
            {toPay.map((c) => <ToPayRow key={`${c.type}:${c.id}`} thing={c} canEdit={canEdit} onPay={(p) => openNew(p)} />)}
          </div>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem", marginTop: "1.2rem" }}>
        <div className="card">
          <div className="row-between" style={{ marginBottom: "0.8rem" }}>
            <h3>Settle up</h3>
            {hasHouseholds && (
              <Segmented<"together" | "separate">
                size="sm"
                value={combine ? "together" : "separate"}
                onChange={(v) => setCombine(v === "together")}
                options={[{ value: "together", label: <><HeartHandshake size={13} /> Households</> }, { value: "separate", label: <><Users size={13} /> Each person</> }]}
              />
            )}
          </div>
          {settlements.length === 0 ? (
            <p className="muted">Everyone&apos;s square. 🎉</p>
          ) : (
            <div className="stack">
              {settlements.map((s, i) => (
                <div key={i} className="row">
                  <span className="small"><strong>{label(s.from)}</strong> owes <strong>{label(s.to)}</strong></span>
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
                  <span className="grow">{nameOf(m.user_id)}{partyOf(m.user_id) !== m.user_id && <span className="muted"> · {partyName(partyOf(m.user_id))}</span>}</span>
                  <span style={{ color: b > 0.004 ? "var(--success)" : b < -0.004 ? "var(--danger)" : "var(--muted)" }}>
                    {b > 0.004 ? `is owed ${formatMoney(b, cur)}` : b < -0.004 ? `owes ${formatMoney(-b, cur)}` : "square"}
                  </span>
                </div>
              );
            })}
          </div>
          {!hasHouseholds && <p className="tiny muted" style={{ marginTop: 8 }}>Couples or families who share money can link up in <Link href="/settings" style={{ color: "var(--accent)" }}>Settings → Household</Link> to settle up as one.</p>}
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
          <EmptyState icon={<Wallet />} title="Nothing paid yet">Use &quot;Mark as paid&quot; or &quot;Add deposit&quot; on any plan, flight or stay, or add an expense here.</EmptyState>
        </div>
      ) : (
        <div className="card" style={{ padding: "0.4rem" }}>
          {expenses.map((e) => <ExpenseRow key={e.id} e={e} onOpen={() => { setPreset(null); setEditing(e); }} />)}
        </div>
      )}
      <ExpenseModal expense={editing} preset={preset} onClose={() => setEditing(null)} />
    </div>
  );

  function ExpenseRow({ e, onOpen }: { e: Expense; onOpen: () => void }) {
    const c = e.category === "settlement" ? { emoji: "🤝", label: "Settle up" } : expenseCategoryOf(e.category);
    const splitText =
      e.split_mode === "exact" ? "custom amounts" : e.split_mode === "shares" ? "split by shares" : e.split_between.length ? `split ${e.split_between.length} ways` : "split with everyone";
    return (
      <button className="check-row" style={{ width: "100%", border: 0, background: "none", textAlign: "left", cursor: "pointer", color: "inherit" }} onClick={onOpen}>
        <span className="cat-dot">{c.emoji}</span>
        <div className="grow">
          <strong className="small" style={{ display: "block" }}>{e.title}{e.is_deposit && <span className="pay-status pay-deposit" style={{ marginLeft: 6 }}>deposit</span>}</strong>
          <span className="tiny muted">
            {e.paid_by ? `${nameOf(e.paid_by)} paid` : "Unassigned"} · {splitText}
            {e.spent_on && ` · ${formatDay(e.spent_on)}`}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong className="small">{formatMoney(homeAmount(e, cur), cur)}</strong>
          {e.currency !== cur && <div className="tiny muted">{formatMoney(e.amount, e.currency)}</div>}
        </div>
      </button>
    );
  }
}

function ToPayRow({ thing: c, canEdit, onPay }: { thing: CostedThing; canEdit: boolean; onPay: (p: ExpensePreset) => void }) {
  const { trip } = useTrip();
  const cur = trip?.currency ?? "USD";
  const emoji = c.type === "flight" ? "✈️" : c.type === "stay" ? "🏨" : "🎟️";
  const category = c.type === "flight" ? "flights" : c.type === "stay" ? "lodging" : "activities";
  return (
    <div className="check-row">
      <span className="cat-dot">{emoji}</span>
      <div className="grow">
        <strong className="small" style={{ display: "block" }}>{c.title}</strong>
        <span className="tiny muted">{c.day ? formatDay(c.day) : "No date"} · {c.participants.length} {c.participants.length === 1 ? "person" : "people"} · <PayStatus thing={c} /></span>
      </div>
      <div style={{ textAlign: "right" }}>
        <strong className="small">{formatMoney(c.remaining, cur)}</strong>
        <div className="tiny muted">of {formatMoney(c.total ?? 0, cur)}</div>
      </div>
      {canEdit && (
        <div className="row hide-sm" style={{ gap: 4 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => onPay({ title: `${c.title} (deposit)`, category, linked_type: c.type, linked_id: c.id, is_deposit: true, split_between: c.participants })}>Deposit</button>
          <button className="btn btn-sm" onClick={() => onPay({ title: c.title, amount: c.remaining, category, linked_type: c.type, linked_id: c.id, split_between: c.participants })}>Mark paid</button>
        </div>
      )}
    </div>
  );
}

export function ExpenseModal({ expense, preset, onClose }: { expense: Expense | "new" | null; preset?: ExpensePreset | null; onClose: () => void }) {
  const { trip, rows, insert, update, remove, canEdit, me, nameOf, colorOf } = useTrip();
  const cur = trip?.currency ?? "USD";
  const existing = expense && expense !== "new" ? expense : null;
  const going = rows.trip_members.filter((m) => m.attendance !== "not_going").map((m) => m.user_id);
  const blank = {
    title: "", amount: "", currency: cur, amount_home: "", category: "food", paid_by: me, split_between: going,
    split_mode: "equal" as SplitMode, split_shares: {} as Record<string, number>, spent_on: todayString(), notes: "",
    is_deposit: false, linked_type: null as LinkedType | null, linked_id: null as string | null,
  };
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
            split_between: existing.split_between.length ? existing.split_between : going,
            split_mode: existing.split_mode ?? "equal",
            split_shares: existing.split_shares ?? {},
            spent_on: existing.spent_on ?? "",
            notes: existing.notes,
            is_deposit: existing.is_deposit,
            linked_type: existing.linked_type,
            linked_id: existing.linked_id,
          }
        : {
            ...blank,
            title: preset?.title ?? "",
            amount: preset?.amount != null ? String(preset.amount) : "",
            category: preset?.category ?? blank.category,
            split_between: preset?.split_between?.length ? preset.split_between : going,
            is_deposit: !!preset?.is_deposit,
            linked_type: preset?.linked_type ?? null,
            linked_id: preset?.linked_id ?? null,
          },
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

  const homeTotal = Number(form.currency === cur ? form.amount : form.amount_home || 0) || 0;
  const preview = expenseShares(
    { amount: homeTotal, paid_by: form.paid_by || null, split_between: form.split_between, split_mode: form.split_mode, split_shares: form.split_shares },
    going,
  );
  const exactSum = form.split_between.reduce((n, p) => n + Number(form.split_shares[p] ?? 0), 0);
  const exactOff = form.split_mode === "exact" && Math.abs(exactSum - homeTotal) > 0.009;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount >= 0) || exactOff) return;
    const row = {
      title: form.title.trim(),
      amount,
      currency: form.currency,
      amount_home: form.currency === cur ? amount : form.amount_home === "" ? null : Number(form.amount_home),
      category: form.category,
      paid_by: form.paid_by || null,
      split_between: form.split_between,
      split_mode: form.split_mode,
      split_shares: form.split_mode === "equal" ? {} : Object.fromEntries(form.split_between.map((p) => [p, Number(form.split_shares[p] ?? (form.split_mode === "shares" ? 1 : 0))])),
      spent_on: form.spent_on || null,
      notes: form.notes,
      is_deposit: form.is_deposit,
      linked_type: form.linked_type,
      linked_id: form.linked_id,
    };
    const ok = existing ? await update("expenses", existing.id, row) : !!(await insert("expenses", { ...row, created_by: me }));
    if (ok) onClose();
  }

  const people = rows.trip_members.map((m) => m.user_id);
  const linkedTitle =
    form.linked_type === "itinerary" ? rows.itinerary_items.find((i) => i.id === form.linked_id)?.title :
    form.linked_type === "flight" ? (() => { const f = rows.flights.find((x) => x.id === form.linked_id); return f ? `${f.from_code}→${f.to_code} flight` : undefined; })() :
    form.linked_type === "stay" ? rows.stays.find((s) => s.id === form.linked_id)?.name : undefined;

  return (
    <Modal
      open={!!expense}
      onClose={onClose}
      title={existing ? "Expense" : form.is_deposit ? "Add a deposit" : form.linked_type ? "Mark as paid" : "Add an expense"}
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
            <button className="btn btn-primary" form="expense-form" disabled={!form.title.trim() || form.amount === "" || exactOff}>{existing ? "Save" : "Save payment"}</button>
          </>
        )
      }
    >
      <form id="expense-form" className="form-grid" onSubmit={save}>
        <fieldset disabled={!canEdit} style={{ display: "contents" }}>
          {linkedTitle && (
            <p className="field-full small">
              Payment for <strong>{linkedTitle}</strong>
              <label className="row" style={{ marginTop: 6 }}><input type="checkbox" checked={form.is_deposit} onChange={(e) => set("is_deposit", e.target.checked)} /> This is a deposit (more to pay later)</label>
            </p>
          )}
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
          <Field label="Split between" full>
            <PersonPicker people={people} value={form.split_between} onChange={(v) => set("split_between", v)} nameOf={nameOf} colorOf={colorOf} />
          </Field>
          <div className="field field-full">
            <span className="field-label">How to split</span>
            <Segmented<SplitMode>
              size="sm"
              value={form.split_mode}
              onChange={(m) => set("split_mode", m)}
              options={[{ value: "equal", label: "Evenly" }, { value: "shares", label: "By shares" }, { value: "exact", label: "Exact amounts" }]}
            />
            {form.split_mode !== "equal" && (
              <div className="split-grid" style={{ marginTop: 8 }}>
                {form.split_between.map((p) => (
                  <SplitRow
                    key={p}
                    name={nameOf(p)}
                    color={colorOf(p)}
                    mode={form.split_mode}
                    value={form.split_shares[p]}
                    preview={preview[p] ?? 0}
                    currency={cur}
                    onChange={(v) => set("split_shares", { ...form.split_shares, [p]: v })}
                  />
                ))}
              </div>
            )}
            {form.split_mode === "equal" && homeTotal > 0 && form.split_between.length > 0 && (
              <span className="field-hint">{formatMoney(homeTotal / form.split_between.length, cur)} each</span>
            )}
            {form.split_mode === "shares" && <span className="field-hint">Example: 2 for someone paying double, 0 for someone not paying.</span>}
            {exactOff && <span className="field-hint" style={{ color: "var(--danger)" }}>Amounts add up to {formatMoney(exactSum, cur)}, but the total is {formatMoney(homeTotal, cur)}.</span>}
          </div>
          <Field label="Notes" full><textarea className="input textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </fieldset>
      </form>
    </Modal>
  );
}

function SplitRow({ name, color, mode, value, preview, currency, onChange }: {
  name: string; color: string; mode: SplitMode; value: number | undefined; preview: number; currency: string; onChange: (v: number) => void;
}) {
  return (
    <>
      <span className="row small"><Avatar name={name} color={color} size={22} /> {name} <span className="muted">· {formatMoney(preview, currency)}</span></span>
      <input
        className={clsx("input")}
        type="number"
        min="0"
        step={mode === "shares" ? "0.5" : "0.01"}
        value={value ?? (mode === "shares" ? 1 : "")}
        placeholder={mode === "exact" ? "0.00" : "1"}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        aria-label={`${name} ${mode === "shares" ? "shares" : "amount"}`}
      />
    </>
  );
}
