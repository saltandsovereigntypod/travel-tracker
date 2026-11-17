"use client";

import { Star, ExternalLink, MapPin } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Avatar } from "../ui/Fields";
import { useEngine } from "./engine";
import { asDate, asIds, asMoney, asPlace, asRepeat, linkedItems, numericValue, rollupValue, type FieldDef, type ListDef, type ListItem } from "@/lib/fields";
import { unitLabel } from "@/lib/costs";
import { formatDay, formatMoney, formatTime, hostname } from "@/lib/format";

export function OptionChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="opt-chip" style={{ background: `color-mix(in srgb, ${color} 22%, var(--surface))`, color: `color-mix(in srgb, ${color} 70%, var(--ink))` }}>
      {label}
    </span>
  );
}

/** Read-only display of a field value, compact enough for tables and cards. */
export function FieldValue({ field, item, list, compact }: { field: FieldDef; item: ListItem; list: ListDef; compact?: boolean }) {
  const { trip, nameOf, colorOf } = useTrip();
  const { ctx, money } = useEngine();
  const v = item.values[field.id];
  const cur = trip?.currency ?? "USD";

  switch (field.type) {
    case "text":
      return v ? <span className="truncate">{String(v)}</span> : null;
    case "phone":
      return v ? <a href={`tel:${String(v).replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()} className="truncate">{String(v)}</a> : null;
    case "repeat": {
      const r = asRepeat(v);
      if (!r) return null;
      const unit = { day: "day", week: "week", month: "month", year: "year" }[r.freq];
      return <span className="nowrap">🔁 {r.interval === 1 ? `Every ${unit}` : `Every ${r.interval} ${unit}s`}</span>;
    }
    case "longtext":
      return v ? <span className="truncate muted">{String(v)}</span> : null;
    case "email":
      return v ? <a href={`mailto:${v}`} onClick={(e) => e.stopPropagation()} className="truncate">{String(v)}</a> : null;
    case "url":
      return v ? (
        <a href={String(v)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="row" style={{ gap: 3 }}>
          <ExternalLink size={12} /> {hostname(String(v))}
        </a>
      ) : null;
    case "number":
      return v === "" || v == null ? null : <span>{Number(v).toLocaleString()}</span>;
    case "money": {
      const m = asMoney(v);
      if (!m) return null;
      const total = numericValue(item, field, list, money);
      return (
        <span className="nowrap">
          {formatMoney(m.price, cur)}
          {m.cost_unit !== "group" && <span className="muted"> {unitLabel(m)}{!compact && total != null && ` · ${formatMoney(total, cur)}`}</span>}
        </span>
      );
    }
    case "date":
    case "datetime": {
      const d = asDate(field, v);
      return d?.date ? <span className="nowrap">{formatDay(d.date)}{d.time && ` · ${formatTime(d.time)}`}</span> : null;
    }
    case "checkbox":
      return <span aria-label={v ? "Yes" : "No"}>{v ? "✅" : "⬜"}</span>;
    case "rating":
      return v ? <span className="nowrap" style={{ color: "var(--accent)" }}>{Array.from({ length: Number(v) }, (_, i) => <Star key={i} size={12} fill="currentColor" style={{ display: "inline" }} />)}</span> : null;
    case "status":
    case "select": {
      const o = field.options?.find((x) => x.id === v);
      return o ? <OptionChip label={o.label} color={o.color} /> : null;
    }
    case "multiselect":
      return (
        <span className="row wrap" style={{ gap: 3 }}>
          {asIds(v).map((id) => {
            const o = field.options?.find((x) => x.id === id);
            return o ? <OptionChip key={id} label={o.label} color={o.color} /> : null;
          })}
        </span>
      );
    case "person":
    case "people": {
      const ids = asIds(v);
      if (!ids.length) return null;
      return (
        <span className="row" style={{ gap: 4 }}>
          <span className="avatar-stack">{ids.map((u) => <Avatar key={u} name={nameOf(u)} color={colorOf(u)} size={20} />)}</span>
          {!compact && ids.length === 1 && <span className="small">{nameOf(ids[0])}</span>}
        </span>
      );
    }
    case "place": {
      const p = asPlace(v);
      return p ? <span className="row truncate" style={{ gap: 3 }}><MapPin size={12} /> {p.name || p.address}</span> : null;
    }
    case "relation": {
      const linked = linkedItems(item, field.id, ctx);
      if (!linked.length) return null;
      return (
        <span className="row wrap" style={{ gap: 3 }}>
          {linked.slice(0, compact ? 2 : 6).map((i) => <span key={i.id} className="link-chip">{i.title || "Untitled"}</span>)}
          {linked.length > (compact ? 2 : 6) && <span className="tiny muted">+{linked.length - (compact ? 2 : 6)}</span>}
        </span>
      );
    }
    case "rollup": {
      const r = rollupValue(item, field, list, ctx, money);
      if (r == null) return null;
      const target = field.rollup?.target;
      const targetField = ctx.lists.flatMap((l) => l.fields).find((f) => f.id === target);
      if (typeof r === "string") return <span>{formatDay(r)}</span>;
      if (targetField?.type === "money" && field.rollup?.op !== "count" && field.rollup?.op !== "checked") return <span>{formatMoney(r, cur)}</span>;
      return <span>{r.toLocaleString()}</span>;
    }
  }
}
