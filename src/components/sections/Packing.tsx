"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Luggage, Lock, Users, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Avatar, EmptyState, Segmented } from "../ui/Fields";
import { PACKING_SUGGESTIONS } from "@/lib/categories";
import type { PackingItem } from "@/lib/types";

type Tab = "shared" | "mine";

export function PackingSection({ compact = false }: { compact?: boolean }) {
  const { rows, me, canEdit, insert, tripId } = useTrip();
  const [tab, setTab] = useState<Tab>("shared");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [showSuggest, setShowSuggest] = useState(false);

  const shared = rows.packing_items.filter((p) => p.owner_id === null);
  const mine = rows.packing_items.filter((p) => p.owner_id === me);
  const list = tab === "shared" ? shared : mine;
  const canAdd = tab === "mine" || canEdit;

  const groups = useMemo(() => {
    const g: Record<string, PackingItem[]> = {};
    [...list].sort((a, b) => Number(a.packed) - Number(b.packed) || a.sort_order - b.sort_order).forEach((p) => (g[p.category] ??= []).push(p));
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [list]);
  const categories = [...new Set(["General", ...rows.packing_items.map((p) => p.category), ...Object.keys(PACKING_SUGGESTIONS)])];
  const done = list.filter((p) => p.packed).length;

  async function add(t: string, cat = category) {
    const v = t.trim();
    if (!v) return;
    await insert("packing_items", { title: v, category: cat, owner_id: tab === "mine" ? me : null, sort_order: Date.now() / 1e6 });
  }

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <ModuleTitle id="packing" fallback="Packing" />
            <p>The shared list is for group stuff (&quot;who&apos;s bringing the speaker?&quot;). Your list is private to you.</p>
          </div>
        </div>
      )}
      <div className="row-between wrap" style={{ marginBottom: "0.8rem" }}>
        <Segmented<Tab>
          size={compact ? "sm" : undefined}
          value={tab}
          onChange={setTab}
          options={[
            { value: "shared", label: <><Users size={14} /> Group</>, count: shared.length },
            { value: "mine", label: <><Lock size={14} /> Mine</>, count: mine.length },
          ]}
        />
        {list.length > 0 && <span className="small muted">{done}/{list.length} packed</span>}
      </div>
      {list.length > 0 && <div className="progress" style={{ marginBottom: "0.8rem" }}><span style={{ width: `${(done / list.length) * 100}%` }} /></div>}

      {canAdd && (
        <form
          className="quick-add"
          style={{ marginBottom: "0.8rem" }}
          onSubmit={(e) => {
            e.preventDefault();
            void add(title);
            setTitle("");
          }}
        >
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tab === "mine" ? "Add to my list…" : "Add to the group list…"} />
          {!compact && (
            <select className="input" style={{ width: 150 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <button className="btn btn-sm" disabled={!title.trim()} aria-label="Add"><Plus size={14} /></button>
        </form>
      )}

      {list.length === 0 ? (
        <EmptyState icon={<Luggage />} title={tab === "mine" ? "Your list is empty" : "No group items yet"}>
          {canAdd && !compact && (
            <button className="btn btn-sm" onClick={() => setShowSuggest(true)}><Sparkles size={14} /> Show suggestions</button>
          )}
        </EmptyState>
      ) : (
        <div className="stack" style={{ gap: "0.9rem" }}>
          {(compact ? groups.slice(0, 2) : groups).map(([cat, items]) => (
            <div key={cat}>
              <div className="tiny muted" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 0.2rem 0.4rem" }}>{cat}</div>
              {(compact ? items.slice(0, 6) : items).map((p) => <PackRow key={p.id} item={p} editable={tab === "mine" || canEdit} />)}
            </div>
          ))}
        </div>
      )}

      {!compact && canAdd && list.length > 0 && (
        <button className="btn btn-sm btn-ghost" style={{ marginTop: "1rem" }} onClick={() => setShowSuggest((s) => !s)}>
          <Sparkles size={14} /> {showSuggest ? "Hide" : "Show"} suggestions
        </button>
      )}
      {showSuggest && !compact && (
        <div className="card" style={{ marginTop: "0.8rem" }}>
          {Object.entries(PACKING_SUGGESTIONS).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: "0.7rem" }}>
              <strong className="small">{cat}</strong>
              <div className="chip-row" style={{ marginTop: 4 }}>
                {items.map((it) => {
                  const has = list.some((p) => p.title.toLowerCase() === it.toLowerCase());
                  return (
                    <button key={it} className={clsx("chip chip-toggle", has && "chip-on")} disabled={has} onClick={() => add(it, cat)} style={{ paddingLeft: "0.7rem" }}>
                      {has ? "✓ " : "+ "}{it}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {compact && <Link className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} href={`/trips/${tripId}/packing`}>Full list →</Link>}
    </div>
  );
}

function PackRow({ item, editable }: { item: PackingItem; editable: boolean }) {
  const { update, remove, rows, nameOf, colorOf } = useTrip();
  return (
    <div className={clsx("check-row", item.packed && "done")}>
      <input type="checkbox" checked={item.packed} disabled={!editable} onChange={(e) => update("packing_items", item.id, { packed: e.target.checked })} aria-label={`Packed ${item.title}`} />
      <span className="check-title">{item.title}{item.quantity > 1 && <span className="muted"> ×{item.quantity}</span>}</span>
      {item.owner_id === null && (
        editable ? (
          <select
            className="input"
            style={{ width: "auto", minHeight: 30, padding: "0 0.4rem", fontSize: "0.8rem" }}
            value={item.assigned_to ?? ""}
            onChange={(e) => update("packing_items", item.id, { assigned_to: e.target.value || null })}
            aria-label="Who's bringing it"
          >
            <option value="">Anyone</option>
            {rows.trip_members.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}
          </select>
        ) : item.assigned_to ? (
          <Avatar name={nameOf(item.assigned_to)} color={colorOf(item.assigned_to)} size={22} />
        ) : null
      )}
      {editable && (
        <button className="icon-btn" aria-label="Remove" onClick={() => remove("packing_items", item.id)}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
