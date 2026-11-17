"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Settings2, Search, ListPlus, Table2, LayoutGrid, Columns3, CalendarDays, Map as MapIcon, CheckSquare } from "lucide-react";
import { useTrip } from "../TripProvider";
import { EmptyState, Segmented } from "../ui/Fields";
import { ListItemModal } from "./ItemModal";
import { ListSettings } from "./ListSettings";
import { BoardView, CalendarView, CardsView, ChecklistView, MapListView, TableView, cardFieldChoices } from "./Views";
import { CardOptions, useCardParts } from "../ui/CardOptions";
import { useEngine } from "./engine";
import { useIsPhone } from "../ui/hooks";
import { useCommitItem } from "./automation";
import { itemMoneyTotal, listProgress, statusField, type ListItem } from "@/lib/fields";
import { dateFields, defaultGroupField, filterItems, groupableFields, placeFields, sortItems } from "@/lib/views";
import { formatMoney } from "@/lib/format";
import type { ListPrefs, ListViewType } from "@/lib/types";

const VIEWS: { value: ListViewType; label: string; icon: typeof Table2 }[] = [
  { value: "table", label: "Table", icon: Table2 },
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "map", label: "Map", icon: MapIcon },
  { value: "checklist", label: "Checklist", icon: CheckSquare },
];

/** A custom list, shown however each person prefers (their choice is private to them). */
export function ListPage({ listId }: { listId: string }) {
  return (
    <Suspense>
      <ListPageInner listId={listId} />
    </Suspense>
  );
}

function ListPageInner({ listId }: { listId: string }) {
  const { rows, canEdit, insert, update, trip, tripId, loading, view, saveView, me } = useTrip();
  const { money } = useEngine();
  const commit = useCommitItem();
  const show = useCardParts("lists", listId);
  const params = useSearchParams();
  const router = useRouter();
  const phone = useIsPhone();
  const list = rows.lists.find((l) => l.id === listId);
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState("");
  const [settings, setSettings] = useState(false);
  const openId = params.get("item");
  const setOpen = useCallback(
    (id: string | null) => router.replace(`/trips/${tripId}/lists/${listId}${id ? `?item=${id}` : ""}`, { scroll: false }),
    [router, tripId, listId],
  );

  const prefs: ListPrefs = view.list_prefs?.[listId] ?? {};
  // Tables are cramped on phones, so default to cards there.
  const viewType: ListViewType = phone ? prefs.phoneView ?? "cards" : prefs.view ?? "table";
  const setPrefs = (p: Partial<ListPrefs>) => saveView({ list_prefs: { ...(view.list_prefs ?? {}), [listId]: { ...prefs, ...p } } });

  const all = useMemo(() => rows.list_items.filter((i) => i.list_id === listId), [rows.list_items, listId]);
  const items = useMemo(() => (list ? sortItems(filterItems(all, list, prefs, me, q), list, prefs.sort) : []), [all, list, prefs, me, q]);

  if (!list) {
    return loading ? null : <EmptyState title="This list doesn't exist anymore">It may have been deleted.</EmptyState>;
  }

  const choices = cardFieldChoices(list);
  const fieldOn = (f: { id: string }) => {
    const v = view.card_prefs?.[`lists:${listId}`]?.[`f:${f.id}`];
    return typeof v === "boolean" ? v : choices.defaults.has(f.id);
  };
  const progress = listProgress(list, all);
  const moneyTotal = all.reduce((n, i) => n + (itemMoneyTotal(i, list, money) ?? 0), 0);
  const titleLabel = (list.settings as { titleLabel?: string })?.titleLabel ?? "Name";
  const groupField = list.fields.find((f) => f.id === prefs.groupBy) ?? defaultGroupField(list);
  const dateField = list.fields.find((f) => f.id === prefs.dateField) ?? dateFields(list)[0];
  const placeField = list.fields.find((f) => f.id === prefs.placeField) ?? placeFields(list)[0];
  const hasPeople = list.fields.some((f) => f.type === "person" || f.type === "people");
  const canCheck = !!statusField(list) || list.fields.some((f) => f.type === "checkbox");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setQuick("");
    const last = all[all.length - 1];
    const values: Record<string, unknown> = {};
    // Adding from a board column or "only mine" view: pre-fill what's obvious.
    if (prefs.mine) {
      const pf = list!.fields.find((f) => f.type === "person" || f.type === "people");
      if (pf) values[pf.id] = pf.type === "people" ? [me] : me;
    }
    await insert("list_items", { list_id: listId, title, values, sort_order: (last?.sort_order ?? 0) + 1 });
  }

  function toggleDone(item: ListItem, done: boolean) {
    const sf = statusField(list!);
    if (sf) {
      const target = done ? sf.options?.find((o) => o.kind === "done") : sf.options?.find((o) => o.kind === "todo") ?? sf.options?.[0];
      void commit(list!, item, { ...item.values, [sf.id]: target?.id ?? null });
    } else {
      const cb = list!.fields.find((f) => f.type === "checkbox")!;
      void commit(list!, item, { ...item.values, [cb.id]: done });
    }
  }

  const openItem = openId ? all.find((i) => i.id === openId) ?? null : null;
  const views = VIEWS.filter((v) => v.value !== "map" || placeFields(list).length > 0).filter((v) => v.value !== "calendar" || dateFields(list).length > 0);

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
          <div className="input-icon" style={{ minWidth: 160, flex: "1 1 160px" }}>
            <Search size={15} />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label={`Search ${list.name}`} />
          </div>
          <button className="btn" onClick={() => setSettings(true)} aria-label="Fields and settings"><Settings2 size={15} /> <span className="hide-phone">Fields</span></button>
        </div>
      </div>
      {progress && progress.total > 0 && <div className="progress" style={{ marginBottom: "1rem" }}><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>}

      <div className="view-bar">
        <Segmented<ListViewType>
          size="sm"
          value={viewType}
          onChange={(v) => setPrefs(phone ? { phoneView: v } : { view: v })}
          options={views.map((v) => ({ value: v.value, label: <><v.icon size={14} /> <span className={phone ? "sr-only" : undefined}>{v.label}</span></> }))}
        />
        {viewType === "board" && groupableFields(list).length > 1 && (
          <select className="input" value={groupField?.id ?? ""} onChange={(e) => setPrefs({ groupBy: e.target.value })} aria-label="Group by">
            {groupableFields(list).map((f) => <option key={f.id} value={f.id}>By {f.name.toLowerCase()}</option>)}
          </select>
        )}
        {viewType === "calendar" && dateFields(list).length > 1 && (
          <select className="input" value={dateField?.id ?? ""} onChange={(e) => setPrefs({ dateField: e.target.value })} aria-label="Date to use">
            {dateFields(list).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        {viewType === "map" && placeFields(list).length > 1 && (
          <select className="input" value={placeField?.id ?? ""} onChange={(e) => setPrefs({ placeField: e.target.value })} aria-label="Place to use">
            {placeFields(list).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        {(viewType === "cards" || viewType === "checklist" || viewType === "board") && (
          <select
            className="input"
            value={prefs.sort ? `${prefs.sort.field}:${prefs.sort.dir}` : ""}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(":");
              setPrefs({ sort: field ? { field, dir: dir as "asc" | "desc" } : undefined });
            }}
            aria-label="Sort"
          >
            <option value="">Manual order</option>
            <option value="title:asc">{titleLabel} A→Z</option>
            {list.fields.filter((f) => ["date", "datetime", "money", "number", "rating", "status"].includes(f.type)).map((f) => (
              <option key={f.id} value={`${f.id}:${f.type === "money" || f.type === "rating" ? "desc" : "asc"}`}>{f.name}</option>
            ))}
          </select>
        )}
        <CardOptions
          kind="lists"
          scope={listId}
          title={`${list.name} cards`}
          extra={cardFieldChoices(list).all.map((f) => ({ id: `f:${f.id}`, label: f.name, on: fieldOn(f) }))}
        />
        {hasPeople && (
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={!!prefs.mine} onChange={(e) => setPrefs({ mine: e.target.checked })} /> Only mine
          </label>
        )}
        {canCheck && (
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={!!prefs.hideDone} onChange={(e) => setPrefs({ hideDone: e.target.checked })} /> Hide done
          </label>
        )}
      </div>

      {canEdit && (
        <form className="quick-add" style={{ marginBottom: "0.9rem" }} onSubmit={add}>
          <input className="input" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={`Add a ${titleLabel.toLowerCase()}…`} aria-label={`New ${titleLabel}`} />
          <button className="btn btn-primary" disabled={!quick.trim()}><Plus size={16} /> Add</button>
        </form>
      )}

      {items.length === 0 && viewType !== "calendar" && viewType !== "map" ? (
        <div className="card">
          <EmptyState icon={<ListPlus />} title={q || prefs.mine || prefs.hideDone ? "Nothing matches" : `No ${list.name.toLowerCase()} yet`}>
            {q || prefs.mine || prefs.hideDone ? "Try clearing the search or filters." : `Add your first ${titleLabel.toLowerCase()} above. Tap it to fill in the details.`}
          </EmptyState>
        </div>
      ) : viewType === "table" ? (
        <TableView
          list={list}
          items={items}
          onOpen={setOpen}
          sortField={prefs.sort?.field}
          sortDir={prefs.sort?.dir}
          onSort={(field) => setPrefs({ sort: prefs.sort?.field === field ? (prefs.sort.dir === "asc" ? { field, dir: "desc" } : undefined) : { field, dir: "asc" } })}
        />
      ) : viewType === "cards" ? (
        <CardsView list={list} items={items} onOpen={setOpen} look={{ field: fieldOn, feeds: show("feeds"), status: show("status") }} />
      ) : viewType === "board" ? (
        <BoardView list={list} items={items} onOpen={setOpen} groupField={groupField} canEdit={canEdit} onMove={(id, value) => {
          const it = all.find((x) => x.id === id);
          if (it && groupField) void commit(list, it, { ...it.values, [groupField.id]: groupField.type === "people" ? (value ? [value] : []) : value });
        }} />
      ) : viewType === "calendar" ? (
        <CalendarView list={list} items={items} onOpen={setOpen} dateField={dateField} />
      ) : viewType === "map" ? (
        <MapListView list={list} items={items} onOpen={setOpen} placeField={placeField} />
      ) : (
        <ChecklistView list={list} items={items} onOpen={setOpen} canEdit={canEdit} onToggle={toggleDone} />
      )}

      {openItem && <ListItemModal list={list} item={openItem} onClose={() => setOpen(null)} />}
      <ListSettings list={list} open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
