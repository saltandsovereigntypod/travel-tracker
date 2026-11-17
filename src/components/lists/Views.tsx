"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { EmptyState } from "../ui/Fields";
import { FieldValue } from "./FieldValue";
import { asPlace, isDone, itemFeeds, statusField, type FieldDef, type ListDef, type ListItem } from "@/lib/fields";
import { boardColumns, itemsByDay, monthGrid } from "@/lib/views";
import { formatDayLong, todayString } from "@/lib/format";

interface ViewProps {
  list: ListDef;
  items: ListItem[];
  onOpen: (id: string) => void;
}

const titleLabel = (list: ListDef) => (list.settings as { titleLabel?: string })?.titleLabel ?? "Name";

// ---------------------------------------------------------------- table
export function TableView({ list, items, onOpen, sortField, sortDir, onSort }: ViewProps & { sortField?: string; sortDir?: "asc" | "desc"; onSort: (field: string) => void }) {
  const columns = list.fields.filter((f) => f.type !== "longtext").slice(0, 7);
  const arrow = (id: string) => (sortField === id ? (sortDir === "desc" ? " ↓" : " ↑") : "");
  return (
    <div className="card table-wrap" style={{ padding: 0 }}>
      <table className="list-table">
        <thead>
          <tr>
            <th><button className="th-btn" onClick={() => onSort("title")}>{titleLabel(list)}{arrow("title")}</button></th>
            {columns.map((f) => <th key={f.id}><button className="th-btn" onClick={() => onSort(f.id)}>{f.name}{arrow(f.id)}</button></th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="item-row" onClick={() => onOpen(i.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(i.id)}>
              <td className="title-cell">{i.title || <span className="muted">Untitled</span>}</td>
              {columns.map((f) => <td key={f.id}><FieldValue field={f} item={i} list={list} compact /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- cards
export function CardsView({ list, items, onOpen }: ViewProps) {
  const sf = statusField(list);
  const fields = list.fields
    .filter((f) => f !== sf && ["date", "datetime", "money", "person", "people", "place", "relation", "rollup", "select", "number", "checkbox", "rating", "multiselect"].includes(f.type))
    .slice(0, 5);
  return (
    <div className="item-cards">
      {items.map((i) => <ItemCard key={i.id} list={list} item={i} fields={fields} status={sf} onOpen={() => onOpen(i.id)} />)}
    </div>
  );
}

function ItemCard({ list, item, fields, status, onOpen, dragHandle }: { list: ListDef; item: ListItem; fields: FieldDef[]; status?: FieldDef; onOpen: () => void; dragHandle?: React.ReactNode }) {
  const feeds = itemFeeds(item, list);
  return (
    <div className="card item-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <strong>{item.title || "Untitled"}</strong>
        {status && <FieldValue field={status} item={item} list={list} compact />}
        {dragHandle}
      </div>
      <div className="meta">
        {fields.map((f) => (
          <span key={f.id} className="row" style={{ gap: 4 }}>
            <FieldValue field={f} item={item} list={list} compact />
          </span>
        ))}
      </div>
      {feeds.length > 0 && <div className="feeds-row">{feeds.map((f) => <span key={f} className="feed-chip">{f}</span>)}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- board
export function BoardView({ list, items, onOpen, groupField, canEdit, onMove }: ViewProps & { groupField?: FieldDef; canEdit: boolean; onMove: (itemId: string, value: unknown) => void }) {
  const { rows, nameOf, colorOf } = useTrip();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }));
  if (!groupField) {
    return <EmptyState title="Nothing to group by">Add a Status, Dropdown, Person or Checkbox field to see this list as a board.</EmptyState>;
  }
  const people = rows.trip_members.map((m) => ({ id: m.user_id, name: nameOf(m.user_id), color: colorOf(m.user_id) }));
  const cols = boardColumns(items, groupField, people);
  const fields = list.fields.filter((f) => f.id !== groupField.id && ["date", "datetime", "money", "person", "people", "relation"].includes(f.type)).slice(0, 3);

  function end(e: DragEndEvent) {
    const col = cols.find((c) => `col:${c.key}` === e.over?.id);
    const id = String(e.active.id);
    if (!col) return;
    const current = cols.find((c) => c.items.some((i) => i.id === id));
    if (current?.key !== col.key) onMove(id, groupField!.type === "person" ? col.value : col.value);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={end}>
      <div className="list-board">
        {cols.map((c) => <BoardCol key={c.key} col={c} list={list} fields={fields} onOpen={onOpen} canEdit={canEdit} />)}
      </div>
    </DndContext>
  );
}

function BoardCol({ col, list, fields, onOpen, canEdit }: { col: ReturnType<typeof boardColumns>[number]; list: ListDef; fields: FieldDef[]; onOpen: (id: string) => void; canEdit: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.key}` });
  return (
    <section ref={setNodeRef} className={clsx("board-col", isOver && "over")}>
      <header className="row-between">
        <span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: col.color }} /> <strong className="small">{col.label}</strong></span>
        <span className="tiny muted">{col.items.length}</span>
      </header>
      <div className="stack" style={{ gap: 8 }}>
        {col.items.map((i) => <DraggableCard key={i.id} item={i} list={list} fields={fields} onOpen={() => onOpen(i.id)} disabled={!canEdit} />)}
        {!col.items.length && <p className="tiny muted" style={{ padding: "0.6rem" }}>{canEdit ? "Drop here" : "Empty"}</p>}
      </div>
    </section>
  );
}

function DraggableCard({ item, list, fields, onOpen, disabled }: { item: ListItem; list: ListDef; fields: FieldDef[]; onOpen: () => void; disabled: boolean }) {
  const { setNodeRef, attributes, listeners, isDragging, transform } = useDraggable({ id: item.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, zIndex: isDragging ? 30 : undefined, opacity: isDragging ? 0.85 : 1, touchAction: "manipulation" }}
    >
      <ItemCard list={list} item={item} fields={fields} onOpen={onOpen} />
    </div>
  );
}

// ---------------------------------------------------------------- calendar
export function CalendarView({ list, items, onOpen, dateField }: ViewProps & { dateField?: FieldDef }) {
  const today = todayString();
  const byDay = useMemo(() => (dateField ? itemsByDay(items, dateField) : {}), [items, dateField]);
  // Open on this month, or jump ahead to the next month that has something in it.
  const [cursor, setCursor] = useState(() => {
    const next = Object.keys(byDay).sort().find((d) => d >= today.slice(0, 8) + "01") ?? today;
    const start = next.slice(0, 7) > today.slice(0, 7) && !Object.keys(byDay).some((d) => d.startsWith(today.slice(0, 7))) ? next : today;
    return { y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 };
  });
  if (!dateField) return <EmptyState title="No dates to show">Add a Date field to see this list on a calendar.</EmptyState>;
  const grid = monthGrid(cursor.y, cursor.m);
  const monthName = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const step = (d: number) => setCursor(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const upcoming = Object.keys(byDay).sort().filter((d) => d >= today);
  const undated = items.filter((i) => !Object.values(byDay).some((l) => l.includes(i)));
  return (
    <div className="stack">
      {/* Big screens: month grid. */}
      <div className="card hide-phone" style={{ padding: "0.8rem" }}>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <strong>{monthName}</strong>
          <button className="icon-btn" onClick={() => step(1)} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
        <div className="month-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="month-dow">{d}</div>)}
          {grid.map((d) => (
            <div key={d} className={clsx("month-cell", Number(d.slice(5, 7)) - 1 !== cursor.m && "other", d === today && "today")}>
              <span className="month-num">{Number(d.slice(8))}</span>
              {(byDay[d] ?? []).slice(0, 3).map((i) => (
                <button key={i.id} className="month-chip" onClick={() => onOpen(i.id)} title={i.title}>{i.title || "Untitled"}</button>
              ))}
              {(byDay[d]?.length ?? 0) > 3 && <span className="tiny muted">+{byDay[d].length - 3} more</span>}
            </div>
          ))}
        </div>
      </div>
      {/* Phones: an agenda of what's coming. */}
      <div className="show-phone stack">
        {upcoming.length === 0 && <EmptyState title="Nothing coming up">Items with a {dateField.name.toLowerCase()} show here.</EmptyState>}
        {upcoming.map((d) => (
          <div key={d} className="card card-tight">
            <div className="day-num">{formatDayLong(d)}</div>
            {byDay[d].map((i) => (
              <button key={i.id} className="check-row" style={{ width: "100%", border: 0, background: "none", textAlign: "left", color: "inherit", cursor: "pointer" }} onClick={() => onOpen(i.id)}>
                <span className="grow">{i.title || "Untitled"}</span>
                {statusField(list) && <FieldValue field={statusField(list)!} item={i} list={list} compact />}
              </button>
            ))}
          </div>
        ))}
      </div>
      {undated.length > 0 && <p className="tiny muted">{undated.length} item{undated.length === 1 ? "" : "s"} without a {dateField.name.toLowerCase()} aren&apos;t shown.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- map
export function MapListView({ list, items, onOpen, placeField }: ViewProps & { placeField?: FieldDef }) {
  const { trip } = useTrip();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const pins = useMemo(
    () =>
      placeField
        ? items.flatMap((i) => {
            const p = asPlace(i.values[placeField.id]);
            return p?.lat != null && p.lng != null ? [{ item: i, lat: p.lat, lng: p.lng }] : [];
          })
        : [],
    [items, placeField],
  );

  useEffect(() => {
    if (!placeField) return;
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      if (cancelled || !box.current || map.current) return;
      const center: [number, number] = trip?.lng != null && trip?.lat != null ? [trip.lng, trip.lat] : [-98.5, 39.8];
      const m = new maplibre.Map({ container: box.current, style: "https://tiles.openfreemap.org/styles/liberty", center, zoom: trip?.lat != null ? 11 : 3, attributionControl: { compact: true } });
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => !cancelled && setReady(true));
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [placeField, trip?.lat, trip?.lng]);

  useEffect(() => {
    if (!ready || !map.current) return;
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !map.current) return;
      markers.current.forEach((mk) => mk.remove());
      markers.current = pins.map((p) => {
        const el = document.createElement("button");
        el.className = "map-pin";
        el.style.background = getComputedStyle(box.current!).getPropertyValue("--accent").trim() || "#E07A5F";
        el.innerHTML = `<span>${list.icon}</span>`;
        el.setAttribute("aria-label", p.item.title);
        el.onclick = () => onOpen(p.item.id);
        return new maplibre.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(map.current!);
      });
      if (pins.length) {
        const b = new maplibre.LngLatBounds();
        pins.forEach((p) => b.extend([p.lng, p.lat]));
        map.current.fitBounds(b, { padding: 60, maxZoom: 15, duration: 500 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pins, ready, list.icon, onOpen]);

  if (!placeField) return <EmptyState title="No places to show">Add a Place field to see this list on a map.</EmptyState>;
  return (
    <div className="stack">
      <div ref={box} className="map-box" style={{ height: "min(70dvh, 560px)" }} />
      <p className="tiny muted">{pins.length} of {items.length} have a {placeField.name.toLowerCase()} pinned. Tap a pin to open it.</p>
    </div>
  );
}

// ---------------------------------------------------------------- checklist
export function ChecklistView({ list, items, onOpen, canEdit, onToggle }: ViewProps & { canEdit: boolean; onToggle: (item: ListItem, done: boolean) => void }) {
  const sf = statusField(list);
  const cb = list.fields.find((f) => f.type === "checkbox");
  if (!sf && !cb) return <EmptyState title="Nothing to check off">Add a Status or Checkbox field to use this list as a checklist.</EmptyState>;
  const extra = list.fields.filter((f) => ["person", "date", "datetime", "money"].includes(f.type)).slice(0, 2);
  return (
    <div className="card" style={{ padding: "0.4rem" }}>
      {items.map((i) => {
        const done = isDone(i, list);
        return (
          <div key={i.id} className={clsx("check-row", done && "done")}>
            <input type="checkbox" checked={done} disabled={!canEdit} onChange={(e) => onToggle(i, e.target.checked)} aria-label={`Done: ${i.title}`} />
            <button className="check-title" style={{ border: 0, background: "none", textAlign: "left", color: "inherit", cursor: "pointer", padding: 0, font: "inherit" }} onClick={() => onOpen(i.id)}>
              {i.title || "Untitled"}
            </button>
            {extra.map((f) => <span key={f.id} className="tiny muted"><FieldValue field={f} item={i} list={list} compact /></span>)}
          </div>
        );
      })}
    </div>
  );
}
