"use client";

// One place that turns ideas, plans, flights and stays into money numbers:
// total (from price × unit × who's doing it), what's been paid, what's left.

import { useMemo } from "react";
import { useTrip } from "../TripProvider";
import { costTotal, participantsOf, pickCost } from "@/lib/costs";
import { daysBetween } from "@/lib/format";
import type { Expense, Flight, Idea, ItineraryItem, LinkedType, Stay } from "@/lib/types";
import { asDate, itemIncomeTotal, itemMoneyTotal, itemParticipants, repeatOf } from "@/lib/fields";

export function homeAmount(e: Expense, tripCurrency: string): number {
  if (e.currency === tripCurrency) return Number(e.amount);
  return Number(e.amount_home ?? e.amount);
}

export function stayNights(s: Pick<Stay, "check_in" | "check_out">): number | null {
  return s.check_in && s.check_out ? Math.max(0, daysBetween(s.check_in, s.check_out)) : null;
}

export interface CostedThing {
  type: LinkedType;
  id: string;
  title: string;
  day: string | null;
  participants: string[];
  total: number | null;
  paid: number;
  deposits: number;
  remaining: number;
  status: "none" | "unpaid" | "deposit" | "paid";
  payments: Expense[];
  /** Plain name without an icon, for payment titles. */
  name?: string;
  /** Repeating items: the due date this round of payments is for. */
  period?: string | null;
  income?: boolean;
}

export function participantsForItem(item: Pick<ItineraryItem, "participants">, going: string[]) {
  return participantsOf(item.participants, going);
}
export function participantsForFlight(f: Pick<Flight, "travelers">, going: string[]) {
  return participantsOf(f.travelers, going);
}
export function participantsForStay(s: Pick<Stay, "guests">, going: string[]) {
  return participantsOf(s.guests, going);
}

export function useMoney() {
  const { rows, trip, goingIds, householdOf } = useTrip();
  const cur = trip?.currency ?? "USD";

  return useMemo(() => {
    const ctxBase = { householdOf };
    const paymentsFor = (type: LinkedType, id: string, kind: "expense" | "income", period?: string | null) =>
      rows.expenses.filter(
        (e) =>
          e.linked_type === type && e.linked_id === id && e.category !== "settlement" && (e.kind ?? "expense") === kind &&
          // Repeating items only count payments for the current round.
          (period === undefined || e.period === period),
      );

    const build = (type: LinkedType, id: string, title: string, day: string | null, participants: string[], total: number | null, opts: { period?: string | null; income?: boolean; name?: string } = {}): CostedThing => {
      const payments = paymentsFor(type, id, opts.income ? "income" : "expense", opts.period);
      const paid = payments.reduce((n, e) => n + homeAmount(e, cur), 0);
      const deposits = payments.filter((e) => e.is_deposit).reduce((n, e) => n + homeAmount(e, cur), 0);
      const remaining = total == null ? 0 : Math.max(0, Math.round((total - paid) * 100) / 100);
      const status: CostedThing["status"] =
        total == null && !payments.length ? "none" : paid <= 0 ? "unpaid" : remaining > 0.004 ? "deposit" : "paid";
      return { type, id, title, day, participants, total, paid, deposits, remaining, status, payments, period: opts.period, income: opts.income, name: opts.name ?? title };
    };

    const items = rows.itinerary_items.map((i) => {
      const participants = participantsForItem(i, goingIds);
      return build("itinerary", i.id, i.title, i.day, participants, costTotal(i.cost, pickCost(i), { ...ctxBase, participants }));
    });
    const flights = rows.flights
      .filter((f) => f.status === "booked")
      .map((f) => {
        const participants = participantsForFlight(f, goingIds);
        const label = [f.airline, f.flight_number].filter(Boolean).join(" ") || `Flight ${f.from_code}→${f.to_code}`;
        return build("flight", f.id, label, f.depart_local?.slice(0, 10) ?? null, participants, costTotal(f.cost, pickCost(f), { ...ctxBase, participants }));
      });
    const stays = rows.stays
      .filter((s) => s.status === "booked")
      .map((s) => {
        const participants = participantsForStay(s, goingIds);
        return build("stay", s.id, s.name, s.check_in, participants, costTotal(s.cost, pickCost(s), { ...ctxBase, participants, nights: stayNights(s) }));
      });

    // Custom list items with money fields (vendors, bills, costumes…).
    const incomeThings: CostedThing[] = [];
    const listThings = rows.list_items.flatMap((it) => {
      const list = rows.lists.find((l) => l.id === it.list_id);
      if (!list) return [];
      const dateField = list.fields.find((f) => f.type === "date" || f.type === "datetime");
      const day = dateField ? asDate(dateField, it.values[dateField.id])?.date ?? null : null;
      const period = repeatOf(it, list) ? day : undefined;
      const title = `${list.icon} ${it.title || "Untitled"}`;
      const participants = itemParticipants(it, list, goingIds);
      const income = itemIncomeTotal(it, list, { going: goingIds, householdOf });
      const name = it.title || "Untitled";
      if (income != null) incomeThings.push(build("list_item", it.id, title, day, participants, income, { period, income: true, name }));
      const total = itemMoneyTotal(it, list, { going: goingIds, householdOf });
      if (total == null) return [];
      return [build("list_item", it.id, title, day, participants, total, { period, name })];
    });

    const committed = [...items, ...flights, ...stays, ...listThings];
    const committedTotal = committed.reduce((n, c) => n + (c.total ?? 0), 0);
    const stillToPay = committed.reduce((n, c) => n + c.remaining, 0);
    const isIncome = (e: Expense) => (e.kind ?? "expense") === "income";
    const spent = rows.expenses.filter((e) => e.category !== "settlement" && !isIncome(e)).reduce((n, e) => n + homeAmount(e, cur), 0);
    const received = rows.expenses.filter(isIncome).reduce((n, e) => n + homeAmount(e, cur), 0);
    const expectedIncome = incomeThings.reduce((n, c) => n + c.remaining, 0);
    const wishlist = rows.ideas
      .filter((i) => i.status === "open" || i.status === "maybe")
      .reduce((n, i) => n + (costTotal(i.est_cost, pickCost(i), { ...ctxBase, participants: goingIds }) ?? 0), 0);
    const budget = Number(trip?.budget ?? 0);

    return {
      cur,
      committed,
      byKey: Object.fromEntries(committed.map((c) => [`${c.type}:${c.id}`, c])) as Record<string, CostedThing>,
      incomeByKey: Object.fromEntries(incomeThings.map((c) => [`${c.type}:${c.id}`, c])) as Record<string, CostedThing>,
      incomeThings,
      received,
      expectedIncome,
      committedTotal,
      stillToPay,
      spent,
      wishlist,
      budget,
      // Money that came in offsets spending against the budget.
      remainingBudget: budget - (spent + stillToPay) + received,
    };
  }, [rows.itinerary_items, rows.flights, rows.stays, rows.expenses, rows.ideas, rows.lists, rows.list_items, goingIds, householdOf, cur, trip?.budget]);
}

export function ideaTotal(i: Idea, going: string[], householdOf: (id: string) => string | null) {
  return costTotal(i.est_cost, pickCost(i), { participants: going, householdOf });
}
