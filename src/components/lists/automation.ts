"use client";

import { useCallback } from "react";
import { useTrip } from "../TripProvider";
import { useToast } from "../ui/Toast";
import { useMoney } from "../sections/money";
import { advanceRecurring, asIds, isDone, itemPeople, type ListDef, type ListItem } from "@/lib/fields";
import { formatDay, formatMoney, todayString } from "@/lib/format";

/**
 * Saving an item's values with follow-through, so things don't need manual double entry:
 * - Marking a money item done in a list with auto-pay (Bills) records the payment.
 * - Marking a repeating item done (rent, chores) schedules the next round.
 */
export function useCommitItem() {
  const { update, insert, me, trip } = useTrip();
  const money = useMoney();
  const toast = useToast();
  const cur = trip?.currency ?? "USD";

  return useCallback(
    async (list: ListDef, item: ListItem, values: Record<string, unknown>) => {
      const before = isDone(item, list);
      const after = isDone({ ...item, values }, list);
      if (before || !after) {
        await update("list_items", item.id, { values });
        return;
      }

      const notes: string[] = [];
      // 1) Auto-pay: record what's left as paid.
      const settings = list.settings as { autoPay?: boolean };
      const owed = money.byKey[`list_item:${item.id}`];
      if (settings.autoPay && owed && owed.remaining > 0.004) {
        const personField = list.fields.find((f) => f.type === "person");
        const payer = (personField && asIds(values[personField.id])[0]) || itemPeople(item, list)[0] || me;
        const ok = await insert("expenses", {
          title: item.title || list.name,
          amount: owed.remaining,
          currency: cur,
          amount_home: owed.remaining,
          category: "other",
          paid_by: payer,
          split_between: owed.participants,
          spent_on: todayString(),
          linked_type: "list_item",
          linked_id: item.id,
          period: owed.period ?? null,
          kind: "expense",
          created_by: me,
        });
        if (ok) notes.push(`Recorded ${formatMoney(owed.remaining, cur)} paid`);
      }

      // 2) Repeating: roll forward to the next date and reset.
      const next = advanceRecurring({ ...item, values }, list);
      if (next) {
        await update("list_items", item.id, { values: next });
        const df = list.fields.find((f) => f.type === "date" || f.type === "datetime");
        const raw = df ? next[df.id] : null;
        const day = typeof raw === "string" ? raw : (raw as { date?: string } | null)?.date;
        if (day) notes.push(`next one ${formatDay(day)}`);
      } else {
        await update("list_items", item.id, { values });
      }
      if (notes.length) toast.success(`${item.title || "Done"}: ${notes.join(", ")}`);
    },
    [update, insert, me, money.byKey, cur, toast],
  );
}
