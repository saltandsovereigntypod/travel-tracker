"use client";

import { COST_UNITS, costSummary, defaultQty } from "@/lib/costs";
import { formatMoney } from "@/lib/format";
import type { CostFields, CostUnit } from "@/lib/types";

export interface CostValue extends CostFields {
  price: string;
}

export function costValueFrom(price: number | null | undefined, c: Partial<CostFields> | null | undefined, fallbackUnit: CostUnit = "group"): CostValue {
  return {
    price: price == null ? "" : String(price),
    cost_unit: c?.cost_unit ?? fallbackUnit,
    cost_unit_size: c?.cost_unit_size ?? null,
    cost_qty: c?.cost_qty ?? null,
    cost_unit_label: c?.cost_unit_label ?? "",
  };
}

/** Split a CostValue back into the database columns. */
export function costColumns(v: CostValue, priceColumn: "cost" | "est_cost" = "cost") {
  return {
    [priceColumn]: v.price === "" ? null : Number(v.price),
    cost_unit: v.cost_unit,
    cost_unit_size: v.cost_unit === "people" ? v.cost_unit_size ?? 2 : null,
    cost_qty: ["night", "hour", "car", "room", "custom"].includes(v.cost_unit) ? v.cost_qty : null,
    cost_unit_label: v.cost_unit === "custom" ? v.cost_unit_label.trim() : "",
  };
}

/** Price + "per what" + a live total, e.g. "$35 per person × 3 people = $105". */
export function CostEditor({
  value,
  onChange,
  participants,
  currency,
  householdOf,
  nights,
  label = "Cost",
  disabled,
}: {
  value: CostValue;
  onChange: (v: CostValue) => void;
  participants: string[];
  currency: string;
  householdOf?: (id: string) => string | null;
  nights?: number | null;
  label?: string;
  disabled?: boolean;
}) {
  const set = (p: Partial<CostValue>) => onChange({ ...value, ...p });
  const unit = COST_UNITS.find((u) => u.id === value.cost_unit) ?? COST_UNITS[0];
  const ctx = { participants, householdOf, nights };
  const summary = value.price !== "" ? costSummary(Number(value.price), value, ctx, (n) => formatMoney(n, currency)) : "";
  const qtyPlaceholder = String(defaultQty(value.cost_unit, ctx));

  return (
    <div className="field field-full cost-editor">
      <span className="field-label">{label} ({currency})</span>
      <div className="cost-row">
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="Price"
          aria-label="Price"
          value={value.price}
          disabled={disabled}
          onChange={(e) => set({ price: e.target.value })}
        />
        <select className="input" aria-label="Price is" value={value.cost_unit} disabled={disabled} onChange={(e) => set({ cost_unit: e.target.value as CostUnit })}>
          {COST_UNITS.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
        {unit.needs === "size" && (
          <label className="cost-inline">
            per
            <input className="input" type="number" min="1" step="1" value={value.cost_unit_size ?? 2} disabled={disabled} onChange={(e) => set({ cost_unit_size: Math.max(1, Number(e.target.value) || 1) })} aria-label="People per ticket" />
            people
          </label>
        )}
        {unit.needs === "label" && (
          <input className="input" placeholder="per what? (locker, bundle…)" value={value.cost_unit_label} disabled={disabled} onChange={(e) => set({ cost_unit_label: e.target.value })} aria-label="Custom unit" />
        )}
        {(unit.needs === "qty" || unit.needs === "label") && (
          <label className="cost-inline">
            ×
            <input
              className="input"
              type="number"
              min="0"
              step="0.5"
              placeholder={qtyPlaceholder}
              value={value.cost_qty ?? ""}
              disabled={disabled}
              onChange={(e) => set({ cost_qty: e.target.value === "" ? null : Number(e.target.value) })}
              aria-label="How many"
            />
          </label>
        )}
      </div>
      {summary && <span className="cost-summary">{summary}</span>}
    </div>
  );
}
