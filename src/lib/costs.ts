// Cost math: "price per unit" → a real total, based on who's doing it.
// Pure functions so they're easy to test and reuse everywhere.

import type { CostFields, CostUnit } from "./types";

export const COST_UNITS: { id: CostUnit; label: string; needs: "none" | "size" | "qty" | "label" }[] = [
  { id: "person", label: "per person", needs: "none" },
  { id: "pair", label: "per 2 people", needs: "none" },
  { id: "people", label: "per X people", needs: "size" },
  { id: "group", label: "total for the group", needs: "none" },
  { id: "night", label: "per night", needs: "qty" },
  { id: "hour", label: "per hour", needs: "qty" },
  { id: "car", label: "per car", needs: "qty" },
  { id: "room", label: "per room", needs: "qty" },
  { id: "custom", label: "custom…", needs: "label" },
];

/** Returns the household a person shares money with, or null. */
export type HouseholdOf = (userId: string) => string | null;
const noHouseholds: HouseholdOf = () => null;

export interface CostContext {
  participants: string[];
  householdOf?: HouseholdOf;
  /** Nights for stays; used as the default for "per night". */
  nights?: number | null;
}

/** Number of separate parties (each household counts once, everyone else alone). */
export function partyCount(participants: string[], householdOf: HouseholdOf = noHouseholds): number {
  return new Set(participants.map((p) => householdOf(p) ?? `solo:${p}`)).size;
}

/** How many "2-person" tickets are needed, pairing couples/households together first. */
export function pairCount(participants: string[], householdOf: HouseholdOf = noHouseholds): number {
  const groups = new Map<string, number>();
  let singles = 0;
  for (const p of participants) {
    const h = householdOf(p);
    if (h) groups.set(h, (groups.get(h) ?? 0) + 1);
    else singles++;
  }
  let pairs = 0;
  for (const n of groups.values()) {
    pairs += Math.floor(n / 2);
    singles += n % 2;
  }
  return pairs + Math.ceil(singles / 2);
}

/** Sensible default quantity when someone hasn't typed one. */
export function defaultQty(unit: CostUnit, ctx: CostContext): number {
  const n = ctx.participants.length;
  switch (unit) {
    case "night":
      return Math.max(1, ctx.nights ?? 1);
    case "room":
      return Math.max(1, partyCount(ctx.participants, ctx.householdOf));
    case "car":
      return Math.max(1, Math.ceil(n / 5));
    default:
      return 1;
  }
}

/** How many units the price gets multiplied by. */
export function costUnits(c: CostFields, ctx: CostContext): number {
  const n = ctx.participants.length;
  switch (c.cost_unit) {
    case "person":
      return n;
    case "pair":
      return pairCount(ctx.participants, ctx.householdOf);
    case "people":
      return Math.ceil(n / Math.max(1, c.cost_unit_size ?? 1));
    case "group":
      return 1;
    default:
      return c.cost_qty ?? defaultQty(c.cost_unit, ctx);
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Total cost, or null when there's no price. */
export function costTotal(price: number | null | undefined, c: CostFields, ctx: CostContext): number | null {
  if (price == null || Number.isNaN(Number(price))) return null;
  return round2(Number(price) * costUnits(c, ctx));
}

export function unitLabel(c: Pick<CostFields, "cost_unit" | "cost_unit_size" | "cost_unit_label">): string {
  switch (c.cost_unit) {
    case "people":
      return `per ${c.cost_unit_size ?? "X"} people`;
    case "custom":
      return `per ${c.cost_unit_label?.trim() || "unit"}`;
    default:
      return COST_UNITS.find((u) => u.id === c.cost_unit)?.label ?? "";
  }
}

const UNIT_NOUN: Partial<Record<CostUnit, [string, string]>> = {
  person: ["person", "people"],
  pair: ["pair", "pairs"],
  people: ["group", "groups"],
  night: ["night", "nights"],
  hour: ["hour", "hours"],
  car: ["car", "cars"],
  room: ["room", "rooms"],
};

/**
 * Human sentence for a cost, e.g. "$35 per person × 3 people = $105".
 * `money` formats amounts in the trip's currency.
 */
export function costSummary(price: number | null | undefined, c: CostFields, ctx: CostContext, money: (n: number) => string): string {
  if (price == null) return "";
  const units = costUnits(c, ctx);
  const total = costTotal(price, c, ctx) ?? 0;
  if (c.cost_unit === "group") return `${money(Number(price))} total`;
  const noun = c.cost_unit === "custom" ? [c.cost_unit_label || "unit", `${c.cost_unit_label || "unit"}s`] : UNIT_NOUN[c.cost_unit] ?? ["unit", "units"];
  const count = `${units} ${units === 1 ? noun[0] : noun[1]}`;
  return `${money(Number(price))} ${unitLabel(c)} × ${count} = ${money(total)}`;
}

/** Plans with no explicit list mean "everyone who's going". */
export function participantsOf(explicit: string[] | null | undefined, everyoneGoing: string[]): string[] {
  return explicit && explicit.length ? explicit : everyoneGoing;
}

export const DEFAULT_COST: CostFields = { cost_unit: "group", cost_unit_size: null, cost_qty: null, cost_unit_label: "" };

export function pickCost(row: Partial<CostFields> | null | undefined): CostFields {
  return {
    cost_unit: row?.cost_unit ?? "group",
    cost_unit_size: row?.cost_unit_size ?? null,
    cost_qty: row?.cost_qty ?? null,
    cost_unit_label: row?.cost_unit_label ?? "",
  };
}
