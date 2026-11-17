"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Plane, BedDouble, MapPin, ExternalLink, Trash2, CalendarDays, Clock, MessageCircle } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { Modal } from "../ui/Modal";
import { EmptyState, Field, PersonPicker, PlaceSearch, Segmented } from "../ui/Fields";
import { CostEditor, costColumns, costValueFrom, type CostValue } from "../ui/CostEditor";
import { PaymentPanel, PayStatus } from "./Payments";
import { ScheduleModal, useIdeaScores, useScheduleIdea } from "./Ideas";
import { Lightbulb, ThumbsUp } from "lucide-react";
import type { Idea } from "@/lib/types";
import { useMoney } from "./money";
import { CommentThread, useCommentCount } from "./Comments";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { formatDay, formatMoney, formatTime, normalizeUrl, splitLocal, todayString, tripDays } from "@/lib/format";
import { mapsLink } from "@/lib/services";
import type { ItineraryItem, Place } from "@/lib/types";

const UNSCHEDULED = "unscheduled";

export { itemsForDay, orderForTime } from "./itinerary-order";
import { itemsForDay, orderForTime } from "./itinerary-order";

interface FixedEvent {
  key: string;
  kind: "flight" | "stay";
  time: string | null;
  title: string;
  sub: string;
}

/** Flights and stay check-ins/outs that land on each day. */
export function useFixedEvents() {
  const { rows } = useTrip();
  return useMemo(() => {
    const byDay: Record<string, FixedEvent[]> = {};
    const add = (day: string | null, e: FixedEvent) => {
      if (!day) return;
      (byDay[day] ??= []).push(e);
    };
    for (const f of rows.flights) {
      if (f.status === "cancelled") continue;
      const dep = splitLocal(f.depart_local);
      const arr = splitLocal(f.arrive_local);
      const label = [f.airline, f.flight_number].filter(Boolean).join(" ") || "Flight";
      add(dep.day, { key: `f-${f.id}-d`, kind: "flight", time: dep.time, title: `${label}: ${f.from_code || f.from_name} → ${f.to_code || f.to_name}`, sub: "Departs" });
      if (arr.day && arr.day !== dep.day) add(arr.day, { key: `f-${f.id}-a`, kind: "flight", time: arr.time, title: `${label} lands in ${f.to_code || f.to_name}`, sub: "Arrives" });
    }
    for (const s of rows.stays) {
      if (s.status === "cancelled") continue;
      add(s.check_in, { key: `s-${s.id}-in`, kind: "stay", time: s.check_in_time, title: `Check in: ${s.name}`, sub: s.status === "idea" ? "Not booked yet" : "Stay" });
      add(s.check_out, { key: `s-${s.id}-out`, kind: "stay", time: s.check_out_time, title: `Check out: ${s.name}`, sub: "Stay" });
    }
    Object.values(byDay).forEach((l) => l.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99")));
    return byDay;
  }, [rows.flights, rows.stays]);
}

export function ItinerarySection({ compact = false }: { compact?: boolean }) {
  const { rows, trip, canEdit, update, tripId } = useTrip();
  const fixed = useFixedEvents();
  const [layout, setLayout] = useState<"list" | "board">("list");
  const [editing, setEditing] = useState<ItineraryItem | { day: string | null } | null>(null);
  const [dragging, setDragging] = useState<ItineraryItem | null>(null);
  const [draggingIdea, setDraggingIdea] = useState<Idea | null>(null);
  const [showTray, setShowTray] = useState(true);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const scheduleIdea = useScheduleIdea();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null);
  const outside = [...new Set(rows.itinerary_items.map((i) => i.day).filter((d): d is string => !!d && !days.includes(d)))].sort();
  const allDays = [...days, ...outside];
  const unscheduled = itemsForDay(rows.itinerary_items, null);
  const today = todayString();

  // Compact block: today (if during trip) or the first days with plans.
  const visibleDays = compact
    ? (() => {
        const withStuff = allDays.filter((d) => itemsForDay(rows.itinerary_items, d).length || fixed[d]?.length);
        const fromToday = withStuff.filter((d) => d >= today);
        return (fromToday.length ? fromToday : withStuff).slice(0, 3);
      })()
    : allDays;

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith("idea:")) setDraggingIdea(rows.ideas.find((i) => `idea:${i.id}` === id) ?? null);
    else setDragging(rows.itinerary_items.find((i) => i.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    setDraggingIdea(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    // An idea dropped from the tray becomes a plan on that day.
    const activeId = String(e.active.id);
    if (activeId.startsWith("idea:")) {
      const idea = rows.ideas.find((i) => `idea:${i.id}` === activeId);
      if (!idea || !overId) return;
      const day = overId.startsWith("day:")
        ? (overId.slice(4) === UNSCHEDULED ? null : overId.slice(4))
        : rows.itinerary_items.find((i) => `item:${i.id}` === overId)?.day ?? null;
      void scheduleIdea(idea, day, null);
      return;
    }
    const item = rows.itinerary_items.find((i) => i.id === e.active.id);
    if (!item || !overId) return;
    if (overId.startsWith("day:")) {
      const raw = overId.slice(4);
      const day = raw === UNSCHEDULED ? null : raw;
      const list = itemsForDay(rows.itinerary_items, day).filter((i) => i.id !== item.id);
      const order = list.length ? list[list.length - 1].sort_order + 1 : 0;
      if (item.day !== day || list.length) void update("itinerary_items", item.id, { day, sort_order: order });
      return;
    }
    if (overId.startsWith("item:")) {
      const target = rows.itinerary_items.find((i) => i.id === overId.slice(5));
      if (!target || target.id === item.id) return;
      const list = itemsForDay(rows.itinerary_items, target.day).filter((i) => i.id !== item.id);
      const idx = list.findIndex((i) => i.id === target.id);
      const prev = list[idx - 1];
      const order = prev ? (prev.sort_order + target.sort_order) / 2 : target.sort_order - 1;
      void update("itinerary_items", item.id, { day: target.day, sort_order: order });
    }
  }

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <h1>Itinerary</h1>
            <p>
              <span className="hide-phone">Drag plans between days. </span>
              <span className="show-phone">Tap a plan to edit it or change its day. </span>
              Flights and stays appear on their dates automatically.
            </p>
          </div>
          <div className="toolbar">
            <span className="hide-phone"><Segmented size="sm" value={layout} onChange={setLayout} options={[{ value: "list", label: "Days" }, { value: "board", label: "Columns" }]} /></span>
            {canEdit && (
              <button className="btn btn-sm show-tablet" onClick={() => setIdeasOpen(true)}>
                <Lightbulb size={14} /> Ideas
              </button>
            )}
            {canEdit && (
              <button className={clsx("btn btn-sm hide-tablet", showTray && "btn-primary")} onClick={() => setShowTray((t) => !t)} title="Drag ideas onto days">
                <Lightbulb size={14} /> Ideas
              </button>
            )}
            {canEdit && (
              <button className="btn btn-primary" onClick={() => setEditing({ day: null })}>
                <Plus size={16} /> Add plan
              </button>
            )}
          </div>
        </div>
      )}

      {!days.length && !compact && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <p>
            <strong>Set your trip dates</strong> to get a day-by-day plan.{" "}
            <Link href={`/trips/${tripId}/settings`} style={{ color: "var(--accent)" }}>Trip settings →</Link>
          </p>
        </div>
      )}

      {!compact && days.length > 3 && (
        <nav className="day-jump" aria-label="Jump to day">
          {days.map((d, i) => (
            <button
              key={d}
              className={clsx(d === today && "today")}
              onClick={() => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {formatDay(d, { weekday: "short", month: undefined, day: undefined })} {formatDay(d, { weekday: undefined, month: undefined })}
              <small>Day {i + 1}</small>
            </button>
          ))}
        </nav>
      )}

      {compact && visibleDays.length === 0 && unscheduled.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="Nothing planned yet">
          <Link href={`/trips/${tripId}/itinerary`} style={{ color: "var(--accent)" }}>Open the itinerary</Link>
        </EmptyState>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className={!compact && canEdit && showTray ? "itin-with-tray" : undefined}>
          <div className={layout === "board" && !compact ? "itin-board" : "itin-list"}>
            {visibleDays.map((d) => (
              <DayColumn
                key={d}
                day={d}
                index={days.indexOf(d)}
                items={itemsForDay(rows.itinerary_items, d)}
                fixed={fixed[d] ?? []}
                isToday={d === today}
                compact={compact}
                onOpen={setEditing}
                onAdd={() => setEditing({ day: d })}
              />
            ))}
            {(!compact || !visibleDays.length) && (unscheduled.length > 0 || !compact) && (
              <DayColumn day={null} index={-1} items={unscheduled} fixed={[]} compact={compact} onOpen={setEditing} onAdd={() => setEditing({ day: null })} />
            )}
          </div>
          {!compact && canEdit && showTray && <IdeasTray />}
          </div>
          <DragOverlay>
            {dragging && <ItemRow item={dragging} overlay />}
            {draggingIdea && <div className="tray-idea" style={{ boxShadow: "var(--shadow-lg)" }}>{categoryOf(draggingIdea.category).emoji} {draggingIdea.title}</div>}
          </DragOverlay>
        </DndContext>
      )}
      {compact && (
        <Link className="btn btn-sm btn-ghost" style={{ marginTop: "0.6rem" }} href={`/trips/${tripId}/itinerary`}>Full itinerary →</Link>
      )}
      <ItemModal target={editing} onClose={() => setEditing(null)} />
      <Modal open={ideasOpen} onClose={() => setIdeasOpen(false)} title="Schedule an idea">
        <IdeasTray bare />
      </Modal>
    </div>
  );
}

function DayColumn({
  day, index, items, fixed, isToday, compact, onOpen, onAdd,
}: {
  day: string | null;
  index: number;
  items: ItineraryItem[];
  fixed: FixedEvent[];
  isToday?: boolean;
  compact?: boolean;
  onOpen: (i: ItineraryItem) => void;
  onAdd: () => void;
}) {
  const { canEdit, insert } = useTrip();
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day ?? UNSCHEDULED}` });
  const [quick, setQuick] = useState("");

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setQuick("");
    await insert("itinerary_items", { title, day, sort_order: items.length ? items[items.length - 1].sort_order + 1 : 0 });
  }

  const merged: ({ fixed: FixedEvent } | { item: ItineraryItem })[] = [
    ...fixed.filter((f) => !f.time || f.time < "12:00").map((f) => ({ fixed: f })),
    ...items.map((i) => ({ item: i })),
    ...fixed.filter((f) => f.time && f.time >= "12:00").map((f) => ({ fixed: f })),
  ];

  return (
    <section id={day ? `day-${day}` : "day-unscheduled"} className={clsx("card day-col", compact && "card-tight")} style={isToday ? { outline: "2px solid var(--accent)" } : undefined}>
      <div className="day-head">
        <div>
          <div className="day-num">{day ? (index >= 0 ? `Day ${index + 1}` : "Outside trip dates") : "Unscheduled"}{isToday && " · Today"}</div>
          <h3>{day ? formatDay(day, { weekday: "long" }) : "Someday / not sure yet"}</h3>
        </div>
        {canEdit && !compact && (
          <button className="icon-btn" onClick={onAdd} aria-label="Add plan to this day">
            <Plus size={18} />
          </button>
        )}
      </div>
      <div ref={setNodeRef} className={clsx("day-drop", isOver && "over")}>
        {merged.map((m) =>
          "fixed" in m ? (
            <div key={m.fixed.key} className="itin-item itin-fixed">
              <span className="itin-time">{formatTime(m.fixed.time) || "—"}</span>
              <span className="cat-dot" style={{ background: "var(--surface)" }}>
                {m.fixed.kind === "flight" ? <Plane size={15} /> : <BedDouble size={15} />}
              </span>
              <div className="grow">
                <strong className="small">{m.fixed.title}</strong>
                <div className="tiny muted">{m.fixed.sub}</div>
              </div>
            </div>
          ) : (
            <ItemRow key={m.item.id} item={m.item} onOpen={() => onOpen(m.item)} draggable={canEdit} />
          ),
        )}
        {!merged.length && <p className="tiny muted" style={{ padding: "0.6rem" }}>{canEdit ? "Drop plans here" : "Nothing yet"}</p>}
      </div>
      {canEdit && !compact && (
        <form className="quick-add" onSubmit={quickAdd}>
          <input className="input" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={day ? "Quick add to this day…" : "Quick add…"} />
          <button className="btn btn-sm" disabled={!quick.trim()} aria-label="Add">
            <Plus size={14} />
          </button>
        </form>
      )}
    </section>
  );
}

function ItemRow({ item, onOpen, draggable, overlay }: { item: ItineraryItem; onOpen?: () => void; draggable?: boolean; overlay?: boolean }) {
  const { trip } = useTrip();
  const money = useMoney();
  const costed = money.byKey[`itinerary:${item.id}`];
  const drag = useDraggable({ id: item.id, disabled: !draggable || overlay });
  const drop = useDroppable({ id: `item:${item.id}`, disabled: overlay });
  const cat = categoryOf(item.category);
  const comments = useCommentCount("itinerary", item.id);
  return (
    <div
      ref={(n) => {
        drag.setNodeRef(n);
        drop.setNodeRef(n);
      }}
      {...drag.attributes}
      {...drag.listeners}
      className={clsx("itin-item", drag.isDragging && "dragging")}
      style={{ ...(drop.isOver && !drag.isDragging ? { boxShadow: "0 -3px 0 var(--accent)" } : {}), ...(overlay ? { boxShadow: "var(--shadow-lg)" } : {}), ...(!draggable ? { cursor: "pointer" } : {}) }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen?.()}
    >
      <span className="itin-time">
        {item.start_time ? formatTime(item.start_time) : "Any time"}
        {item.end_time && <span className="tiny muted" style={{ display: "block", fontWeight: 500 }}>to {formatTime(item.end_time)}</span>}
      </span>
      <span className="cat-dot">{cat.emoji}</span>
      <div className="grow">
        <strong style={{ display: "block" }}>{item.title}</strong>
        <div className="row tiny muted wrap" style={{ gap: "0.5rem" }}>
          {item.location?.name && <span className="row" style={{ gap: 2 }}><MapPin size={11} />{item.location.name}</span>}
          {costed?.total != null && <span>{formatMoney(costed.total, trip?.currency)}</span>}
          {costed && costed.status !== "none" && costed.status !== "unpaid" && <PayStatus thing={costed} />}
          {comments > 0 && <span className="row" style={{ gap: 2 }}><MessageCircle size={11} />{comments}</span>}
        </div>
      </div>
    </div>
  );
}

const blank = {
  title: "", day: "", start_time: "", end_time: "", category: "activity", location: {} as Place, url: "", notes: "",
  cost: costValueFrom(null, null, "person") as CostValue, participants: [] as string[],
};

function ItemModal({ target, onClose }: { target: ItineraryItem | { day: string | null } | null; onClose: () => void }) {
  const { trip, rows, insert, update, remove, canEdit, goingIds, nameOf, colorOf, householdOf } = useTrip();
  const existing = target && "id" in target ? target : null;
  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null);
  const [form, setForm] = useState(blank);
  const [loadedFor, setLoadedFor] = useState<unknown>(null);
  if (target !== loadedFor) {
    setLoadedFor(target);
    if (existing) {
      setForm({
        title: existing.title,
        day: existing.day ?? "",
        start_time: existing.start_time?.slice(0, 5) ?? "",
        end_time: existing.end_time?.slice(0, 5) ?? "",
        category: existing.category,
        location: existing.location ?? {},
        url: existing.url ?? "",
        cost: costValueFrom(existing.cost, existing),
        notes: existing.notes,
        participants: existing.participants?.length ? existing.participants : goingIds,
      });
    } else if (target) {
      setForm({ ...blank, day: (target as { day: string | null }).day ?? "", participants: goingIds });
    }
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const near = trip?.lat != null && trip?.lng != null ? { lat: trip.lat, lng: trip.lng } : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const day = form.day || null;
    const start = form.start_time ? `${form.start_time}:00` : null;
    const row = {
      title: form.title.trim(),
      day,
      start_time: start,
      end_time: form.end_time ? `${form.end_time}:00` : null,
      category: form.category,
      location: form.location,
      url: normalizeUrl(form.url),
      ...costColumns(form.cost),
      notes: form.notes,
      // Store "everyone going" as an empty list so new travelers are included automatically.
      participants: sameSet(form.participants, goingIds) ? [] : form.participants,
    };
    const dayItems = itemsForDay(rows.itinerary_items, day);
    let ok: boolean;
    if (existing) {
      const moved = existing.day !== day || existing.start_time !== start;
      ok = await update("itinerary_items", existing.id, moved ? { ...row, sort_order: orderForTime(dayItems, start, existing.id) } : row);
    } else {
      ok = !!(await insert("itinerary_items", { ...row, sort_order: orderForTime(dayItems, start) }));
    }
    if (ok) onClose();
  }

  const link = existing ? mapsLink(existing.location) : null;

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={existing ? (canEdit ? "Edit plan" : existing.title) : "Add a plan"}
      size="lg"
      footer={
        canEdit && (
          <>
            {existing && (
              <button
                className="btn btn-danger"
                type="button"
                onClick={async () => {
                  if (confirm(`Remove "${existing.title}" from the itinerary?`)) {
                    await remove("itinerary_items", existing.id);
                    onClose();
                  }
                }}
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
            <span className="spacer" />
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" form="itin-form" disabled={!form.title.trim()}>{existing ? "Save" : "Add"}</button>
          </>
        )
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: existing ? "minmax(0, 1.4fr) minmax(0, 1fr)" : "1fr", gap: "1.4rem" }} className="idea-modal-grid">
        <form id="itin-form" className="form-grid" onSubmit={save}>
          <fieldset disabled={!canEdit} style={{ display: "contents" }}>
            <Field label="What" full>
              <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Dinner at Turner's Seafood" required maxLength={200} />
            </Field>
            <Field label="Day">
              <select className="input" value={form.day} onChange={(e) => set("day", e.target.value)}>
                <option value="">Unscheduled</option>
                {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {formatDay(d)}</option>)}
                {form.day && !days.includes(form.day) && <option value={form.day}>{formatDay(form.day)}</option>}
              </select>
            </Field>
            <Field label="Category">
              <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </Field>
            <Field label="Starts">
              <input className="input" type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </Field>
            <Field label="Ends">
              <input className="input" type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </Field>
            <Field label="Where" full>
              <PlaceSearch value={form.location} onChange={(p) => set("location", p)} near={near} />
            </Field>
            <Field label="Who's doing this" hint="Everyone going is selected by default. Costs and splits follow this." full>
              <PersonPicker people={rows.trip_members.map((m) => m.user_id)} value={form.participants} onChange={(v) => set("participants", v)} nameOf={nameOf} colorOf={colorOf} />
            </Field>
            <CostEditor value={form.cost} onChange={(v) => set("cost", v)} participants={form.participants} currency={trip?.currency ?? "USD"} householdOf={householdOf} />
            <Field label="Link / tickets" full>
              <input className="input" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Notes" full>
              <textarea className="input textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Booking details, what to bring…" />
            </Field>
          </fieldset>
          {existing && (link || existing.url) && (
            <div className="row field-full">
              {link && <a className="btn btn-sm" href={link} target="_blank" rel="noopener noreferrer"><MapPin size={14} /> Directions</a>}
              {existing.url && <a className="btn btn-sm" href={existing.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open link</a>}
            </div>
          )}
        </form>
        {existing && (
          <div className="stack">
            <PaymentPanel type="itinerary" id={existing.id} category="activities" />
            <h3 style={{ marginTop: "0.4rem" }} className="row"><Clock size={16} /> Comments</h3>
            <CommentThread entity="itinerary" id={existing.id} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Unscheduled ideas, most-wanted first. Drag one onto a day, or tap to pick a day. */
function IdeasTray({ bare = false }: { bare?: boolean }) {
  const { rows } = useTrip();
  const scores = useIdeaScores();
  const [picking, setPicking] = useState<Idea | null>(null);
  const ideas = rows.ideas
    .filter((i) => i.status === "open" || i.status === "maybe")
    .sort((a, b) => (scores[b.id]?.score ?? 0) - (scores[a.id]?.score ?? 0));
  return (
    <aside className={bare ? "stack" : "card ideas-tray"} style={bare ? { gap: "0.5rem" } : undefined} aria-label="Ideas to schedule">
      {!bare && (
        <div>
          <h3 className="row"><Lightbulb size={16} /> Ideas</h3>
          <p className="tiny muted">Drag onto a day, or tap to choose one.</p>
        </div>
      )}
      {bare && <p className="small muted">Most-wanted first. Tap one to pick its day.</p>}
      {ideas.length === 0 && <p className="small muted">Nothing waiting. Add ideas on the Ideas page.</p>}
      {ideas.map((i) => <TrayIdea key={i.id} idea={i} up={scores[i.id]?.up ?? 0} onTap={() => setPicking(i)} />)}
      <ScheduleModal idea={picking} onClose={() => setPicking(null)} />
    </aside>
  );
}

function TrayIdea({ idea, up, onTap }: { idea: Idea; up: number; onTap: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `idea:${idea.id}` });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="tray-idea"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={onTap}
      role="button"
      tabIndex={0}
    >
      <span>{categoryOf(idea.category).emoji}</span>
      <span className="grow">{idea.title}</span>
      {up > 0 && <span className="tiny muted row" style={{ gap: 2 }}><ThumbsUp size={11} />{up}</span>}
    </div>
  );
}
