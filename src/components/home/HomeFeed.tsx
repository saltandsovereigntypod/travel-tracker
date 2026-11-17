"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Wallet, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { supabase } from "@/lib/supabase";
import { addDays, formatDay, formatMoney, formatTime, splitLocal, todayString } from "@/lib/format";
import { assignedTo, calendarEntries, itemMoneyTotal, type ListDef, type ListItem } from "@/lib/fields";
import { expenseShares, netBalances } from "@/lib/balances";
import { templateFor } from "@/lib/spaces";
import type { Expense, Flight, ItineraryItem, Member, PackingItem, Stay, Trip } from "@/lib/types";

interface Data {
  members: Member[];
  plans: ItineraryItem[];
  flights: Flight[];
  stays: Stay[];
  lists: ListDef[];
  items: ListItem[];
  expenses: Expense[];
  packing: PackingItem[];
}

interface Entry {
  key: string;
  day: string;
  time: string | null;
  title: string;
  sub: string;
  icon: string;
  href: string;
}

const homeAmount = (e: Expense, cur: string) => (e.currency === cur ? Number(e.amount) : Number(e.amount_home ?? e.amount));

/**
 * The cross-space Home: one place that pulls from every trip, wedding, show and household
 * you're part of: this week, what's on your plate, what's due, and where you stand on money.
 */
export function HomeFeed({ spaces }: { spaces: Trip[] }) {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const [data, setData] = useState<Data | null>(null);
  const ids = useMemo(() => spaces.map((s) => s.id), [spaces]);
  const today = todayString();
  const weekEnd = addDays(today, 6);

  useEffect(() => {
    if (!ids.length) return;
    let alive = true;
    (async () => {
      const sb = supabase();
      const [members, plans, flights, stays, lists, items, expenses, packing] = await Promise.all([
        sb.from("trip_members").select("*").in("trip_id", ids),
        sb.from("itinerary_items").select("*").in("trip_id", ids).gte("day", today).lte("day", weekEnd),
        sb.from("flights").select("*").in("trip_id", ids).neq("status", "cancelled").gte("depart_local", today).lte("depart_local", `${weekEnd}T23:59:59`),
        sb.from("stays").select("*").in("trip_id", ids).neq("status", "cancelled").or(`and(check_in.gte.${today},check_in.lte.${weekEnd}),and(check_out.gte.${today},check_out.lte.${weekEnd})`),
        sb.from("lists").select("*").in("trip_id", ids),
        sb.from("list_items").select("*").in("trip_id", ids),
        sb.from("expenses").select("*").in("trip_id", ids),
        sb.from("packing_items").select("*").in("trip_id", ids).eq("assigned_to", me).eq("packed", false),
      ]);
      if (!alive) return;
      setData({
        members: (members.data as Member[]) ?? [],
        plans: (plans.data as ItineraryItem[]) ?? [],
        flights: (flights.data as Flight[]) ?? [],
        stays: (stays.data as Stay[]) ?? [],
        lists: (lists.data as ListDef[]) ?? [],
        items: (items.data as ListItem[]) ?? [],
        expenses: (expenses.data as Expense[]) ?? [],
        packing: (packing.data as PackingItem[]) ?? [],
      });
    })();
    return () => {
      alive = false;
    };
  }, [ids, me, today, weekEnd]);

  const view = useMemo(() => {
    if (!data) return null;
    const space = (id: string) => spaces.find((s) => s.id === id)!;
    const icon = (id: string) => space(id).icon || templateFor(space(id).kind).icon;
    const going = (tripId: string) => data.members.filter((m) => m.trip_id === tripId && m.attendance === "going").map((m) => m.user_id);

    // This week, across everything.
    const week: Entry[] = [];
    for (const p of data.plans) week.push({ key: `p${p.id}`, day: p.day!, time: p.start_time, title: p.title, sub: space(p.trip_id).name, icon: icon(p.trip_id), href: `/trips/${p.trip_id}/itinerary` });
    for (const f of data.flights) {
      const d = splitLocal(f.depart_local);
      week.push({ key: `f${f.id}`, day: d.day!, time: d.time, title: `✈️ ${f.from_code || f.from_name} → ${f.to_code || f.to_name}`, sub: space(f.trip_id).name, icon: icon(f.trip_id), href: `/trips/${f.trip_id}/flights` });
    }
    for (const s of data.stays) {
      if (s.check_in && s.check_in >= today && s.check_in <= weekEnd) week.push({ key: `si${s.id}`, day: s.check_in, time: s.check_in_time, title: `Check in: ${s.name}`, sub: space(s.trip_id).name, icon: icon(s.trip_id), href: `/trips/${s.trip_id}/stays` });
      if (s.check_out && s.check_out >= today && s.check_out <= weekEnd) week.push({ key: `so${s.id}`, day: s.check_out, time: s.check_out_time, title: `Check out: ${s.name}`, sub: space(s.trip_id).name, icon: icon(s.trip_id), href: `/trips/${s.trip_id}/stays` });
    }
    for (const c of calendarEntries({ lists: data.lists, items: data.items })) {
      if (c.day < today || c.day > weekEnd) continue;
      week.push({ key: `l${c.item.id}${c.field.id}`, day: c.day, time: c.time, title: `${c.list.icon} ${c.item.title || "Untitled"}`, sub: `${space(c.list.trip_id).name} · ${c.field.name}`, icon: icon(c.list.trip_id), href: `/trips/${c.list.trip_id}/lists/${c.list.id}?item=${c.item.id}` });
    }
    week.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "99").localeCompare(b.time ?? "99"));

    // On your plate: anything assigned to you, anywhere.
    const plate = [
      ...assignedTo(me, { lists: data.lists, items: data.items }).map(({ item, list }) => ({
        key: item.id, title: item.title || "Untitled", sub: `${space(list.trip_id).name} · ${list.name}`, icon: list.icon, href: `/trips/${list.trip_id}/lists/${list.id}?item=${item.id}`,
      })),
      ...data.packing.map((p) => ({ key: p.id, title: `Bring: ${p.title}`, sub: space(p.trip_id).name, icon: "🧳", href: `/trips/${p.trip_id}/packing` })),
    ];

    // Payments coming due (or overdue) from lists with money and a date.
    const due: { key: string; day: string; title: string; sub: string; left: number; cur: string; href: string; overdue: boolean }[] = [];
    for (const item of data.items) {
      const list = data.lists.find((l) => l.id === item.list_id);
      if (!list) continue;
      const cur = space(list.trip_id).currency;
      const total = itemMoneyTotal(item, list, { going: going(list.trip_id) });
      if (total == null) continue;
      const paid = data.expenses.filter((e) => e.linked_type === "list_item" && e.linked_id === item.id).reduce((n, e) => n + homeAmount(e, cur), 0);
      const left = Math.round((total - paid) * 100) / 100;
      if (left <= 0.004) continue;
      const dates = calendarEntries({ lists: [list], items: [item] }).map((c) => c.day).sort();
      const next = dates.find((d) => d >= today) ?? dates[dates.length - 1];
      if (!next || next > addDays(today, 30)) continue;
      due.push({ key: item.id, day: next, title: `${list.icon} ${item.title || "Untitled"}`, sub: space(list.trip_id).name, left, cur, href: `/trips/${list.trip_id}/lists/${list.id}?item=${item.id}`, overdue: next < today });
    }
    due.sort((a, b) => a.day.localeCompare(b.day));

    // Money: where you stand in each space.
    const money = spaces
      .map((s) => {
        const ex = data.expenses.filter((e) => e.trip_id === s.id);
        if (!ex.length) return null;
        const everyone = data.members.filter((m) => m.trip_id === s.id).map((m) => m.user_id);
        const g = going(s.id);
        const bal = netBalances(
          ex.map((e) => ({ amount: homeAmount(e, s.currency), paid_by: e.paid_by, split_between: e.split_between.length ? e.split_between : g, split_mode: e.split_mode, split_shares: e.split_shares })),
          everyone,
        )[me] ?? 0;
        const myShare = ex
          .filter((e) => e.category !== "settlement")
          .reduce((n, e) => n + (expenseShares({ amount: homeAmount(e, s.currency), paid_by: e.paid_by, split_between: e.split_between.length ? e.split_between : g, split_mode: e.split_mode, split_shares: e.split_shares }, g)[me] ?? 0), 0);
        return { space: s, bal, myShare };
      })
      .filter((x): x is { space: Trip; bal: number; myShare: number } => !!x);

    return { week, plate, due, money };
  }, [data, spaces, me, today, weekEnd]);

  if (!spaces.length) return null;
  if (!view) return <div className="card" style={{ marginBottom: "1.4rem" }}><Loader2 className="spin" size={18} /></div>;
  if (!view.week.length && !view.plate.length && !view.due.length && !view.money.length) return null;

  const byDay = view.week.reduce<Record<string, Entry[]>>((acc, e) => ((acc[e.day] ??= []).push(e), acc), {});

  return (
    <div className="home-grid">
      <section className="card">
        <h3 className="row" style={{ marginBottom: "0.6rem" }}><CalendarDays size={18} /> This week</h3>
        {!view.week.length ? (
          <p className="muted small">Nothing scheduled in the next 7 days.</p>
        ) : (
          Object.entries(byDay).map(([day, entries]) => (
            <div key={day} style={{ marginBottom: "0.6rem" }}>
              <div className="day-num">{day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : formatDay(day, { weekday: "long" })}</div>
              {entries.map((e) => (
                <Link key={e.key} href={e.href} className="check-row" style={{ textDecoration: "none" }}>
                  <span className="tiny muted" style={{ minWidth: 58 }}>{formatTime(e.time) || "Any time"}</span>
                  <span className="grow small"><strong>{e.title}</strong> <span className="muted">· {e.icon} {e.sub}</span></span>
                </Link>
              ))}
            </div>
          ))
        )}
      </section>

      {view.due.length > 0 && (
        <section className="card">
          <h3 className="row" style={{ marginBottom: "0.6rem" }}><AlertCircle size={18} /> Payments due</h3>
          {view.due.map((d) => (
            <Link key={d.key} href={d.href} className="check-row" style={{ textDecoration: "none" }}>
              <span className="grow small"><strong>{d.title}</strong> <span className="muted">· {d.sub}</span></span>
              <span className="small nowrap" style={{ color: d.overdue ? "var(--danger)" : undefined }}>{formatMoney(d.left, d.cur)} · {d.overdue ? "overdue" : formatDay(d.day, { weekday: undefined })}</span>
            </Link>
          ))}
        </section>
      )}

      {view.plate.length > 0 && (
        <section className="card">
          <h3 className="row" style={{ marginBottom: "0.6rem" }}><CheckCircle2 size={18} /> On your plate</h3>
          {view.plate.slice(0, 12).map((p) => (
            <Link key={p.key} href={p.href} className="check-row" style={{ textDecoration: "none" }}>
              <span aria-hidden>{p.icon}</span>
              <span className="grow small">{p.title} <span className="muted">· {p.sub}</span></span>
            </Link>
          ))}
          {view.plate.length > 12 && <p className="tiny muted">+{view.plate.length - 12} more</p>}
        </section>
      )}

      {view.money.length > 0 && (
        <section className="card">
          <h3 className="row" style={{ marginBottom: "0.6rem" }}><Wallet size={18} /> Money</h3>
          {view.money.map(({ space, bal, myShare }) => (
            <Link key={space.id} href={`/trips/${space.id}/budget`} className="check-row" style={{ textDecoration: "none" }}>
              <span aria-hidden>{space.icon || templateFor(space.kind).icon}</span>
              <span className="grow small"><strong>{space.name}</strong> <span className="muted">· your share {formatMoney(myShare, space.currency)}</span></span>
              <span className="small nowrap" style={{ color: bal > 0.004 ? "var(--success)" : bal < -0.004 ? "var(--danger)" : "var(--muted)" }}>
                {bal > 0.004 ? `owed ${formatMoney(bal, space.currency)}` : bal < -0.004 ? `you owe ${formatMoney(-bal, space.currency)}` : "square"}
              </span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
