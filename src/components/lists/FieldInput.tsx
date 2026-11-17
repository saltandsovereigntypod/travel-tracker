"use client";

import { useState } from "react";
import { Star, Plus, X, Search } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { PersonPicker, PlaceSearch } from "../ui/Fields";
import { CostEditor, costValueFrom, type CostValue } from "../ui/CostEditor";
import { OptionChip } from "./FieldValue";
import { useEngine } from "./engine";
import {
  asDate, asIds, asMoney, asPlace, itemParticipants, OPTION_COLORS, fid,
  type FieldDef, type FieldOption, type ListDef, type ListItem,
} from "@/lib/fields";
import type { Place } from "@/lib/types";

/**
 * Editor for one field. Text-like fields save when you leave them; everything
 * else saves immediately, so lists feel live like a spreadsheet.
 */
export function FieldInput({
  field,
  item,
  list,
  disabled,
  onChange,
  onAddOption,
}: {
  field: FieldDef;
  item: ListItem;
  list: ListDef;
  disabled?: boolean;
  onChange: (value: unknown) => void;
  onAddOption?: (field: FieldDef, option: FieldOption) => void;
}) {
  const { rows, nameOf, colorOf, trip, goingIds, householdOf } = useTrip();
  const v = item.values[field.id];
  const people = rows.trip_members.map((m) => m.user_id);

  switch (field.type) {
    case "text":
    case "email":
    case "phone":
    case "url":
      return (
        <BlurInput
          type={field.type === "text" ? "text" : field.type === "url" ? "url" : field.type === "email" ? "email" : "tel"}
          value={typeof v === "string" ? v : ""}
          disabled={disabled}
          placeholder={field.type === "url" ? "https://" : ""}
          onCommit={(x) => onChange(field.type === "url" && x && !/^https?:\/\//i.test(x) ? `https://${x}` : x)}
        />
      );
    case "longtext":
      return <BlurInput multiline value={typeof v === "string" ? v : ""} disabled={disabled} onCommit={onChange} />;
    case "number":
      return <BlurInput type="number" value={v == null ? "" : String(v)} disabled={disabled} onCommit={(x) => onChange(x === "" ? null : Number(x))} />;
    case "money": {
      const m = asMoney(v);
      return (
        <MoneyInput
          value={costValueFrom(m?.price ?? null, m)}
          participants={itemParticipants(item, list, goingIds)}
          currency={trip?.currency ?? "USD"}
          householdOf={householdOf}
          disabled={disabled}
          label={field.name}
          onCommit={(c) => onChange(c.price === "" ? null : { price: Number(c.price), cost_unit: c.cost_unit, cost_unit_size: c.cost_unit_size, cost_qty: c.cost_qty, cost_unit_label: c.cost_unit_label })}
        />
      );
    }
    case "date":
      return <input className="input" type="date" value={typeof v === "string" ? v : ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} />;
    case "datetime": {
      const d = asDate(field, v) ?? { date: null, time: null };
      return (
        <div className="row">
          <input className="input" type="date" value={d.date ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value ? { date: e.target.value, time: d.time } : null)} />
          <input className="input" type="time" value={d.time?.slice(0, 5) ?? ""} disabled={disabled || !d.date} onChange={(e) => onChange({ date: d.date, time: e.target.value ? `${e.target.value}:00` : null })} style={{ maxWidth: 140 }} />
        </div>
      );
    }
    case "checkbox":
      return (
        <label className="row" style={{ minHeight: 40 }}>
          <input type="checkbox" checked={!!v} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> {v ? "Yes" : "No"}
        </label>
      );
    case "rating":
      return (
        <div className="row" style={{ gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className="icon-btn" disabled={disabled} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange(Number(v) === n ? null : n)} style={{ color: Number(v) >= n ? "var(--accent)" : "var(--muted)" }}>
              <Star size={20} fill={Number(v) >= n ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      );
    case "status":
      return (
        <div className="chip-row">
          {(field.options ?? []).map((o) => (
            <button key={o.id} type="button" disabled={disabled} className={clsx("opt-btn", v === o.id && "on")} style={{ ["--c" as string]: o.color }} onClick={() => onChange(v === o.id ? null : o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      );
    case "select":
    case "multiselect": {
      const multi = field.type === "multiselect";
      const selected = multi ? asIds(v) : typeof v === "string" ? [v] : [];
      return (
        <div className="chip-row">
          {(field.options ?? []).map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                disabled={disabled}
                className={clsx("opt-btn", on && "on")}
                style={{ ["--c" as string]: o.color }}
                onClick={() => onChange(multi ? (on ? selected.filter((x) => x !== o.id) : [...selected, o.id]) : on ? null : o.id)}
              >
                {o.label}
              </button>
            );
          })}
          {onAddOption && !disabled && (
            <AddOption
              onAdd={(label) => {
                const o: FieldOption = { id: fid("o"), label, color: OPTION_COLORS[(field.options?.length ?? 0) % OPTION_COLORS.length] };
                onAddOption(field, o);
                onChange(multi ? [...selected, o.id] : o.id);
              }}
            />
          )}
        </div>
      );
    }
    case "person":
      return (
        <select className="input" value={typeof v === "string" ? v : ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Nobody</option>
          {people.map((p) => <option key={p} value={p}>{nameOf(p)}</option>)}
        </select>
      );
    case "people":
      return <PersonPicker people={people} value={asIds(v)} onChange={(ids) => !disabled && onChange(ids)} nameOf={nameOf} colorOf={colorOf} />;
    case "place": {
      const near = trip?.lat != null && trip?.lng != null ? { lat: trip.lat, lng: trip.lng } : null;
      return <PlaceInput value={asPlace(v) ?? {}} near={near} disabled={disabled} onCommit={(p) => onChange(p.name || p.address ? p : null)} />;
    }
    case "relation":
      return <RelationInput field={field} item={item} disabled={disabled} onChange={onChange} />;
    case "rollup":
      return null;
  }
}

function BlurInput({ value, onCommit, multiline, type = "text", disabled, placeholder }: {
  value: string; onCommit: (v: string) => void; multiline?: boolean; type?: string; disabled?: boolean; placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setText(value);
  }
  const commit = () => text !== value && onCommit(text);
  return multiline ? (
    <textarea className="input textarea" rows={3} value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onBlur={commit} />
  ) : (
    <input
      className="input"
      type={type}
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      step={type === "number" ? "any" : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function MoneyInput({ value, onCommit, ...rest }: {
  value: CostValue; onCommit: (v: CostValue) => void; participants: string[]; currency: string; householdOf?: (id: string) => string | null; disabled?: boolean; label: string;
}) {
  const [local, setLocal] = useState(value);
  const key = JSON.stringify(value);
  const [last, setLast] = useState(key);
  if (key !== last) {
    setLast(key);
    setLocal(value);
  }
  return (
    <div
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node) && JSON.stringify(local) !== key) onCommit(local);
      }}
    >
      <CostEditor
        value={local}
        onChange={(v) => {
          setLocal(v);
          // Unit changes (dropdowns) save right away; typed numbers save on blur.
          if (v.cost_unit !== local.cost_unit) onCommit(v);
        }}
        {...rest}
      />
    </div>
  );
}

function PlaceInput({ value, near, onCommit, disabled }: { value: Place; near: { lat: number; lng: number } | null; onCommit: (p: Place) => void; disabled?: boolean }) {
  const [local, setLocal] = useState<Place>(value);
  if (disabled) return <span>{value.name || value.address || "—"}</span>;
  return (
    <div onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && JSON.stringify(local) !== JSON.stringify(value) && onCommit(local)}>
      <PlaceSearch
        value={local}
        near={near}
        onChange={(p) => {
          setLocal(p);
          if (p.lat != null) onCommit(p); // picked a result: save now
        }}
      />
    </div>
  );
}

function AddOption({ onAdd }: { onAdd: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  if (!open) {
    return (
      <button type="button" className="opt-btn" onClick={() => setOpen(true)} style={{ ["--c" as string]: "#A3A3A3" }}>
        <Plus size={12} /> Add
      </button>
    );
  }
  return (
    <span className="row" style={{ gap: 4 }}>
      <input
        className="input"
        autoFocus
        style={{ width: 140, minHeight: 34 }}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (label.trim()) onAdd(label.trim());
            setLabel("");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="New option"
      />
    </span>
  );
}

/** Link this item to items in another list. Creating a new one by name works too. */
export function RelationInput({ field, item, onChange, disabled }: { field: FieldDef; item: ListItem; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const { insert } = useTrip();
  const { ctx, listById } = useEngine();
  const target = field.listId ? listById(field.listId) : undefined;
  const ids = asIds(item.values[field.id]);
  return (
    <LinkPicker
      targetName={target?.name ?? "list"}
      options={ctx.items.filter((i) => i.list_id === field.listId)}
      selected={ids}
      disabled={disabled || !target}
      onToggle={(id) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])}
      onCreate={
        target
          ? async (title) => {
              const created = await insert("list_items", { list_id: target.id, title, values: {}, sort_order: Date.now() / 1e6 });
              if (created) onChange([...ids, created.id]);
            }
          : undefined
      }
    />
  );
}

export function LinkPicker({ targetName, options, selected, onToggle, onCreate, disabled }: {
  targetName: string;
  options: ListItem[];
  selected: string[];
  onToggle: (id: string) => void;
  onCreate?: (title: string) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = options.filter((o) => selected.includes(o.id));
  const matches = options.filter((o) => !selected.includes(o.id) && o.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const exact = options.some((o) => o.title.toLowerCase() === q.trim().toLowerCase());
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="chip-row">
        {chosen.map((o) => (
          <span key={o.id} className="link-chip">
            {o.title || "Untitled"}
            {!disabled && (
              <button type="button" aria-label={`Unlink ${o.title}`} onClick={() => onToggle(o.id)}>
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {!disabled && !open && (
          <button type="button" className="opt-btn" style={{ ["--c" as string]: "#3D5A80" }} onClick={() => setOpen(true)}>
            <Plus size={12} /> Link {targetName.toLowerCase()}
          </button>
        )}
      </div>
      {open && (
        <div className="link-search">
          <div className="input-icon">
            <Search size={15} />
            <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find or add in ${targetName}`} onKeyDown={(e) => e.key === "Escape" && setOpen(false)} />
          </div>
          <div className="stack" style={{ gap: 2, maxHeight: 220, overflow: "auto" }}>
            {matches.map((o) => (
              <button key={o.id} type="button" className="check-row" style={{ border: 0, background: "none", textAlign: "left", cursor: "pointer", color: "inherit" }} onClick={() => { onToggle(o.id); setQ(""); }}>
                {o.title || "Untitled"}
              </button>
            ))}
            {onCreate && q.trim() && !exact && (
              <button type="button" className="check-row" style={{ border: 0, background: "none", textAlign: "left", cursor: "pointer", color: "var(--accent)" }} onClick={() => { onCreate(q.trim()); setQ(""); }}>
                <Plus size={14} /> Add “{q.trim()}” to {targetName}
              </button>
            )}
            {!matches.length && !q && <span className="tiny muted" style={{ padding: 6 }}>Nothing to link yet. Type a name to add one.</span>}
          </div>
          <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(false)}>Done</button>
        </div>
      )}
    </div>
  );
}
