"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Settings2, Search, ListPlus } from "lucide-react";
import { useTrip } from "../TripProvider";
import { EmptyState } from "../ui/Fields";
import { FieldValue } from "./FieldValue";
import { ListItemModal } from "./ItemModal";
import { ListSettings } from "./ListSettings";
import { useEngine } from "./engine";
import { itemFeeds, itemMoneyTotal, listProgress, statusField, type FieldDef, type ListItem } from "@/lib/fields";
import { formatMoney } from "@/lib/format";

/** A custom list: table on big screens, cards on phones. */
export function ListPage({ listId }: { listId: string }) {
  return (
    <Suspense>
      <ListPageInner listId={listId} />
    </Suspense>
  );
}

function ListPageInner({ listId }: { listId: string }) {
  const { rows, canEdit, insert, trip, tripId, loading } = useTrip();
  const { money } = useEngine();
  const params = useSearchParams();
  const router = useRouter();
  const list = rows.lists.find((l) => l.id === listId);
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState("");
  const [settings, setSettings] = useState(false);
  const openId = params.get("item");
  const setOpen = (id: string | null) => router.replace(`/trips/${tripId}/lists/${listId}${id ? `?item=${id}` : ""}`, { scroll: false });

  const items = useMemo(
    () =>
      rows.list_items
        .filter((i) => i.list_id === listId)
        .filter((i) => !q || i.title.toLowerCase().includes(q.toLowerCase()) || JSON.stringify(i.values).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.sort_order - b.sort_order),
    [rows.list_items, listId, q],
  );

  if (!list) {
    return loading ? null : <EmptyState title="This list doesn't exist anymore">It may have been deleted.</EmptyState>;
  }

  const all = rows.list_items.filter((i) => i.list_id === listId);
  const progress = listProgress(list, all);
  const moneyTotal = all.reduce((n, i) => n + (itemMoneyTotal(i, list, money) ?? 0), 0);
  const titleLabel = (list.settings as { titleLabel?: string })?.titleLabel ?? "Name";
  const columns = list.fields.filter((f) => f.type !== "longtext").slice(0, 6);
  const sf = statusField(list);
  const cardFields = list.fields.filter((f) => f !== sf && ["date", "datetime", "money", "person", "people", "place", "relation", "rollup", "select", "number", "checkbox", "rating"].includes(f.type)).slice(0, 4);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setQuick("");
    const last = all[all.length - 1];
    await insert("list_items", { list_id: listId, title, values: {}, sort_order: (last?.sort_order ?? 0) + 1 });
  }

  const openItem = openId ? all.find((i) => i.id === openId) ?? null : null;

  return (
    <div>
      <div className="section-head">
        <div>
          <h1 className="row" style={{ gap: "0.6rem" }}><span aria-hidden>{list.icon}</span> {list.name}</h1>
          <p>
            {all.length} {all.length === 1 ? "item" : "items"}
            {progress && progress.total > 0 && <> · {progress.done} of {progress.total} done</>}
            {moneyTotal > 0 && <> · {formatMoney(moneyTotal, trip?.currency)} in the budget</>}
          </p>
        </div>
        <div className="toolbar">
          <div className="input-icon" style={{ minWidth: 180 }}>
            <Search size={15} />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label={`Search ${list.name}`} />
          </div>
          <button className="btn" onClick={() => setSettings(true)}><Settings2 size={15} /> <span className="hide-phone">Fields</span></button>
        </div>
      </div>
      {progress && progress.total > 0 && <div className="progress" style={{ marginBottom: "1rem" }}><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>}

      {canEdit && (
        <form className="quick-add" style={{ marginBottom: "0.9rem" }} onSubmit={add}>
          <input className="input" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={`Add a ${titleLabel.toLowerCase()}…`} aria-label={`New ${titleLabel}`} />
          <button className="btn btn-primary" disabled={!quick.trim()}><Plus size={16} /> Add</button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<ListPlus />} title={q ? "Nothing matches" : `No ${list.name.toLowerCase()} yet`}>
            {q ? "Try a different search." : `Add your first ${titleLabel.toLowerCase()} above. Tap it to fill in the details.`}
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Big screens: a table. */}
          <div className="card hide-phone table-wrap" style={{ padding: 0 }}>
            <table className="list-table">
              <thead>
                <tr>
                  <th>{titleLabel}</th>
                  {columns.map((f) => <th key={f.id}>{f.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="item-row" onClick={() => setOpen(i.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(i.id)}>
                    <td className="title-cell">{i.title || <span className="muted">Untitled</span>}</td>
                    {columns.map((f) => <td key={f.id}><FieldValue field={f} item={i} list={list} compact /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Phones: cards. */}
          <div className="item-cards show-phone">
            {items.map((i) => <ItemCard key={i.id} item={i} fields={cardFields} status={sf} onOpen={() => setOpen(i.id)} />)}
          </div>
        </>
      )}

      {openItem && <ListItemModal list={list} item={openItem} onClose={() => setOpen(null)} />}
      <ListSettings list={list} open={settings} onClose={() => setSettings(false)} />
    </div>
  );

  function ItemCard({ item, fields, status, onOpen }: { item: ListItem; fields: FieldDef[]; status?: FieldDef; onOpen: () => void }) {
    const feeds = itemFeeds(item, list!);
    return (
      <button className="card item-card" onClick={onOpen}>
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <strong>{item.title || "Untitled"}</strong>
          {status && <FieldValue field={status} item={item} list={list!} compact />}
        </div>
        <div className="meta">
          {fields.map((f) => (
            <span key={f.id} className="row" style={{ gap: 4 }}>
              <FieldValue field={f} item={item} list={list!} compact />
            </span>
          ))}
        </div>
        {feeds.length > 0 && <div className="feeds-row">{feeds.map((f) => <span key={f} className="feed-chip">{f}</span>)}</div>}
      </button>
    );
  }
}
