"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, BedDouble, MapPin, ExternalLink, Trash2, CalendarDays, Clock, MessageCircle, Pencil, Undo2 } from "lucide-react";
import clsx from "clsx";
import { LinkedMemories } from "../memories/Memories";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Modal } from "../ui/Modal";
import { Avatar, EmptyState, Field, PersonPicker, PlaceSearch, Segmented } from "../ui/Fields";
import { CostEditor, costColumns, costValueFrom, type CostValue } from "../ui/CostEditor";
import { PaymentPanel, PayStatus } from "./Payments";
import { ScheduleModal, useBackToIdeas, useIdeaScores, useScheduleIdea } from "./Ideas";
import { Lightbulb, ThumbsUp } from "lucide-react";
import type { Idea } from "@/lib/types";
import { useMoney } from "./money";
import { CommentThread, useCommentCount } from "./Comments";
import { categoryOf } from "@/lib/categories";
import { addDays, daysBetween, formatDay, formatMoney, formatTime, hostname, normalizeUrl, splitLocal, todayString, tripDays } from "@/lib/format";
import { mapsLink } from "@/lib/services";
import type { ItineraryItem, Place } from "@/lib/types";

const UNSCHEDULED = "unscheduled";

export { itemsForDay, orderForTime } from "./itinerary-order";
import { itemsForDay, orderForTime } from "./itinerary-order";
import { calendarEntries } from "@/lib/fields";
import { pageTasks } from "@/lib/pages";
import { useTravel } from "../travel/useTravel";
import { CardOptions, useCardChoice, useCardParts } from "../ui/CardOptions";
import { connects, dropOff, formatWait, layovers, modeOf, routeText } from "@/lib/transport";
import { ModeIcon } from "../travel/ModeIcon";

interface FixedEvent {
  key: string;
  kind: "flight" | "stay" | "list";
  /** For travel: flight, train, rental car… */
  mode?: string;
  time: string | null;
  title: string;
  sub: string;
  /** For list items: where tapping goes. */
  href?: string;
  icon?: string;
}

/** Flights and stay check-ins/outs that land on each day. */
export function useFixedEvents() {
  const { rows, tripId } = useTrip();
  return useMemo(() => {
    const byDay: Record<string, FixedEvent[]> = {};
    const add = (day: string | null, e: FixedEvent) => {
      if (!day) return;
      (byDay[day] ??= []).push(e);
    };
    // Same for travel: only what's booked (or planned) shows, not options you're still comparing.
    for (const f of rows.flights) {
      if (f.status !== "booked") continue;
      const dep = splitLocal(f.depart_local);
      const arr = splitLocal(f.arrive_local);
      const m = modeOf(f);
      const label = [f.airline, m.number ? f.flight_number : ""].filter(Boolean).join(" ") || m.label;
      const route = routeText(f);
      const sub = m.depart;
      add(dep.day, { key: `f-${f.id}-d`, kind: "flight", mode: m.id, time: dep.time, title: route ? `${label}${route.startsWith("at ") ? " " : ": "}${route}` : label, sub });
      // Layovers and stops along the way.
      for (const l of layovers(f)) {
        const at = l.stop.code?.trim() || l.stop.name.split(",")[0].trim() || "a stop";
        const a = splitLocal(l.stop.arrive_local ?? null);
        const d = splitLocal(l.stop.depart_local ?? null);
        const wait = l.minutes != null && !l.overnight ? ` · ${formatWait(l.minutes)}` : "";
        const title = connects(m.id) ? `Layover in ${at}${wait}` : `Stop: ${at}${l.overnight ? " (overnight)" : wait}`;
        const warn = l.warn === "tight" ? "Tight connection" : l.warn === "short" ? "Cutting it close" : "";
        add(a.day ?? d.day, { key: `f-${f.id}-s${l.index}`, kind: "flight", mode: m.id, time: a.time ?? d.time, title, sub: warn || label });
        if (l.overnight && d.day && d.day !== a.day) add(d.day, { key: `f-${f.id}-s${l.index}-d`, kind: "flight", mode: m.id, time: d.time, title: `Leave ${at}`, sub: label });
      }
      if (arr.day && arr.day !== dep.day) add(arr.day, { key: `f-${f.id}-a`, kind: "flight", mode: m.id, time: arr.time, title: `${label} ${m.arrivesIn} ${dropOff(f) || "?"}`, sub: m.arrive });
    }
    // Only booked stays are on the calendar; options you're comparing live on the Stays page.
    for (const s of rows.stays) {
      if (s.status !== "booked") continue;
      add(s.check_in, { key: `s-${s.id}-in`, kind: "stay", time: s.check_in_time, title: `Check in: ${s.name}`, sub: "Stay" });
      add(s.check_out, { key: `s-${s.id}-out`, kind: "stay", time: s.check_out_time, title: `Check out: ${s.name}`, sub: "Stay" });
    }
    // Dates from any custom list (deposit due, recording, bill due…) show up too.
    for (const c of calendarEntries({ lists: rows.lists, items: rows.list_items })) {
      add(c.day, {
        key: `l-${c.item.id}-${c.field.id}`,
        kind: "list",
        time: c.time,
        title: c.item.title || "Untitled",
        sub: `${c.list.name} · ${c.field.name}`,
        href: `/trips/${tripId}/lists/${c.list.id}?item=${c.item.id}`,
        icon: c.list.icon,
      });
    }
    // So do dated to-dos written on pages.
    for (const t of pageTasks(rows.pages)) {
      if (!t.due) continue;
      add(t.due, {
        key: `p-${t.block.id}`,
        kind: "list",
        time: null,
        title: `${t.done ? "✓ " : ""}${t.text}`,
        sub: `${t.page.title || "Page"} · To-do`,
        href: `/trips/${tripId}/pages/${t.page.id}`,
        icon: t.page.icon,
      });
    }
    Object.values(byDay).forEach((l) => l.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99")));
    return byDay;
  }, [rows.flights, rows.stays, rows.lists, rows.list_items, rows.pages, tripId]);
}

export function ItinerarySection({ compact = false }: { compact?: boolean }) {
  const { rows, trip, canEdit, update, tripId } = useTrip();
  const planChoice = useCardChoice("plans");
  const showPlanPart = useCardParts("plans");
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

  const { voice } = useTrip();
  const [showPast, setShowPast] = useState(false);
  const today0 = todayString();
  // Ongoing spaces (a show, a home) without dates get a rolling two weeks from today.
  const rolling = voice.ongoing && !trip?.start_date;
  const days = rolling ? Array.from({ length: 14 }, (_, i) => addDays(today0, i)) : tripDays(trip?.start_date ?? null, trip?.end_date ?? null);
  // Days outside the space's range that still have something on them (plans, flights, list dates…).
  const contentDays = [...new Set([...rows.itinerary_items.map((i) => i.day), ...Object.keys(fixed)].filter((d): d is string => !!d && !days.includes(d)))].sort();
  const pastCount = rolling ? contentDays.filter((d) => d < today0).length : 0;
  const outside = rolling && !showPast ? contentDays.filter((d) => d >= today0) : contentDays;
  // Trip-style spaces show every day in their range; any other dated plans slot in chronologically.
  const allDays = [...days, ...outside].sort();
  const unscheduled = itemsForDay(rows.itinerary_items, null);
  const today = todayString();

  // Compact block: today (if during trip) or the first days with plans.
  const visibleDays = compact
    ? (() => {
        const withStuff = allDays.filter((d) => itemsForDay(rows.itinerary_items, d).length || fixed[d]?.length);
        const fromToday = withStuff.filter((d) => d >= today);
        const pool = fromToday.length ? fromToday : withStuff;
        const n = planChoice("days");
        return n === "all" ? pool : pool.slice(0, Number(n) || 3);
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
            <ModuleTitle id="itinerary" fallback="Itinerary" />
            <p>
              <span className="hide-phone">{voice.calendar.hint}</span>
              <span className="show-phone">{voice.calendar.hint.replace(/^Drag [^.]*\. ?/, "")} Tap anything to open it.</span>
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
            <CardOptions kind="plans" title="Plan cards" />
            {canEdit && (
              <button className="btn btn-primary" onClick={() => setEditing({ day: null })}>
                <Plus size={16} /> {voice.calendar.add}
              </button>
            )}
          </div>
        </div>
      )}

      {!days.length && !compact && voice.calendar.noDates && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <p>
            {voice.calendar.noDates}{" "}
            <Link href={`/trips/${tripId}/settings`} style={{ color: "var(--accent)" }}>Settings →</Link>
          </p>
        </div>
      )}
      {rolling && !compact && pastCount > 0 && (
        <button className="btn btn-sm btn-ghost" style={{ marginBottom: "0.8rem" }} onClick={() => setShowPast((v) => !v)}>
          {showPast ? "Hide earlier days" : `Show ${pastCount} earlier day${pastCount === 1 ? "" : "s"}`}
        </button>
      )}

      {!compact && !rolling && days.length > 3 && (
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
        <EmptyState icon={<CalendarDays />} title={voice.calendar.empty}>
          <Link href={`/trips/${tripId}/itinerary`} style={{ color: "var(--accent)" }}>Open the calendar</Link>
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
                fixed={showPlanPart("fixed") ? fixed[d] ?? [] : []}
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
  const { canEdit, insert, voice, trip } = useTrip();
  const rolling = voice.ongoing && !trip?.start_date;
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
          <div className="day-num">{day ? (rolling ? relativeDay(day) : index >= 0 ? `Day ${index + 1}` : parseMonth(day)) : voice.calendar.unscheduledKicker}{isToday && !rolling && " · Today"}</div>
          <h3>{day ? formatDay(day, { weekday: "long" }) : voice.calendar.unscheduledTitle}</h3>
        </div>
        {canEdit && !compact && (
          <button className="icon-btn" onClick={onAdd} aria-label={`Add to this day`}>
            <Plus size={18} />
          </button>
        )}
      </div>
      <div ref={setNodeRef} className={clsx("day-drop", isOver && "over")}>
        {merged.map((m) =>
          "fixed" in m ? (
            <FixedRow key={m.fixed.key} e={m.fixed} />
          ) : (
            <ItemRow key={m.item.id} item={m.item} onOpen={() => onOpen(m.item)} draggable={canEdit} />
          ),
        )}
        {!merged.length && <p className="tiny muted" style={{ padding: "0.6rem" }}>{canEdit ? voice.calendar.drop : "Nothing yet"}</p>}
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
  const fromStay = useTravel().fromStay(item);
  const show = useCardParts("plans");
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
          {show("place") && item.location?.name && <span className="row" style={{ gap: 2 }}><MapPin size={11} />{item.location.name}</span>}
          {show("distance") && fromStay && <span className="row" style={{ gap: 2 }} title={`From ${fromStay.stay.name}`}>🏨 {fromStay.label.split(" · ")[0]}</span>}
          {show("price") && costed?.total != null && <span>{formatMoney(costed.total, trip?.currency)}</span>}
          {show("payment") && costed && costed.status !== "none" && costed.status !== "unpaid" && <PayStatus thing={costed} />}
          {show("comments") && comments > 0 && <span className="row" style={{ gap: 2 }}><MessageCircle size={11} />{comments}</span>}
          {show("link") && item.url && <span className="row" style={{ gap: 2 }}><ExternalLink size={11} />{hostname(item.url)}</span>}
        </div>
        {show("about") && item.notes && <span className="tiny muted itin-notes">{item.notes}</span>}
      </div>
    </div>
  );
}

const blank = {
  title: "", day: "", start_time: "", end_time: "", category: "activity", location: {} as Place, url: "", notes: "",
  cost: costValueFrom(null, null, "person") as CostValue, participants: [] as string[],
};

function ItemModal({ target, onClose }: { target: ItineraryItem | { day: string | null } | null; onClose: () => void }) {
  const { trip, rows, insert, update, remove, canEdit, goingIds, nameOf, colorOf, householdOf, voice } = useTrip();
  const existing = target && "id" in target ? target : null;
  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null);
  const [form, setForm] = useState(blank);
  const [pickDate, setPickDate] = useState(false);
  const [loadedFor, setLoadedFor] = useState<unknown>(null);
  const [editMode, setEditMode] = useState(false);
  const live = existing ? rows.itinerary_items.find((i) => i.id === existing.id) ?? existing : null;
  if (target !== loadedFor) {
    setLoadedFor(target);
    setPickDate(false);
    setEditMode(!(target && "id" in target));
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
    if (!ok) return;
    // Back to reading after an edit; a new plan just closes.
    if (existing) setEditMode(false);
    else onClose();
  }

  const link = existing ? mapsLink(existing.location) : null;
  const reading = !!live && (!editMode || !canEdit);

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={live ? live.title : `Add ${voice.calendar.thing === "item" ? "something" : `a ${voice.calendar.thing}`}`}
      variant="panel"
      actions={reading && canEdit ? <button className="btn btn-sm" onClick={() => setEditMode(true)}><Pencil size={14} /> Edit</button> : undefined}
      footer={
        canEdit && !reading && (
          <>
            {existing && (
              <button
                className="btn btn-danger"
                type="button"
                onClick={async () => {
                  if (confirm(`Remove "${existing.title}" from the calendar?`)) {
                    await remove("itinerary_items", existing.id);
                    onClose();
                  }
                }}
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
            <span className="spacer" />
            <button className="btn" type="button" onClick={() => (existing ? setEditMode(false) : onClose())}>Cancel</button>
            <button className="btn btn-primary" form="itin-form" disabled={!form.title.trim()}>{existing ? "Save" : "Add"}</button>
          </>
        )
      }
    >
      {reading && live ? (
        <PlanDetails item={live} onClose={onClose} />
      ) : (
        <form id="itin-form" className="form-grid" onSubmit={save}>
          <fieldset disabled={!canEdit} style={{ display: "contents" }}>
            <Field label="What" full>
              <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={voice.calendar.titlePlaceholder} required maxLength={200} />
            </Field>
            <Field label="Day">
              {days.length && !pickDate ? (
                <select
                  className="input"
                  value={form.day}
                  onChange={(e) => (e.target.value === "__pick" ? setPickDate(true) : set("day", e.target.value))}
                >
                  <option value="">{voice.calendar.unscheduledTitle}</option>
                  {days.map((d, i) => <option key={d} value={d}>Day {i + 1} · {formatDay(d)}</option>)}
                  {form.day && !days.includes(form.day) && <option value={form.day}>{formatDay(form.day)}</option>}
                  <option value="__pick">Another date…</option>
                </select>
              ) : (
                <input className="input" type="date" value={form.day} onChange={(e) => set("day", e.target.value)} />
              )}
            </Field>
            <Field label="Category">
              <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {voice.ideaCategories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
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
            <Field label="Who's doing this" hint="Everyone is selected by default. Costs and splits follow this." full>
              <PersonPicker people={rows.trip_members.map((m) => m.user_id)} value={form.participants} onChange={(v) => set("participants", v)} nameOf={nameOf} colorOf={colorOf} />
            </Field>
            <CostEditor value={form.cost} onChange={(v) => set("cost", v)} participants={form.participants} currency={trip?.currency ?? "USD"} householdOf={householdOf} />
            <Field label="Link / tickets" full>
              <input className="input" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Notes" full>
              <textarea className="input textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={voice.calendar.notesPlaceholder} />
            </Field>
          </fieldset>
          {existing && (link || existing.url) && (
            <div className="row field-full">
              {link && <a className="btn btn-sm" href={link} target="_blank" rel="noopener noreferrer"><MapPin size={14} /> Directions</a>}
              {existing.url && <a className="btn btn-sm" href={existing.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open link</a>}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

function PlanDetails({ item, onClose }: { item: ItineraryItem; onClose?: () => void }) {
  const { canEdit, hasModule, voice } = useTrip();
  const backToIdeas = useBackToIdeas();
  const { trip, nameOf, colorOf, goingIds } = useTrip();
  const travel = useTravel();
  const money = useMoney();
  const cat = categoryOf(item.category);
  const costed = money.byKey[`itinerary:${item.id}`];
  const fromStay = travel.fromStay(item);
  const where = mapsLink(item.location);
  const people = item.participants?.length ? item.participants : goingIds;
  return (
    <div className="detail">
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="chip">{cat.emoji} {cat.label}</span>
      </div>
      <div className="detail-grid">
        <div><small>When</small>{item.day ? formatDay(item.day) : "Not scheduled yet"}{item.start_time && <> · {formatTime(item.start_time)}{item.end_time && `–${formatTime(item.end_time)}`}</>}</div>
        <div><small>Cost</small>{costed?.total != null ? formatMoney(costed.total, trip?.currency) : "—"}</div>
      </div>
      {(item.location?.name || item.url) && (
        <div className="row wrap" style={{ gap: 6 }}>
          {item.location?.name && (where ? <a className="chip chip-2" href={where} target="_blank" rel="noopener noreferrer"><MapPin size={12} /> {item.location.name}</a> : <span className="chip chip-muted"><MapPin size={12} /> {item.location.name}</span>)}
          {item.url && <a className="chip chip-2" href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> {hostname(item.url)}</a>}
        </div>
      )}
      {fromStay && (
        <div className="detail-section">
          <h3>Getting there</h3>
          <a className="dist-row" href={fromStay.href} target="_blank" rel="noopener noreferrer">
            <MapPin size={16} />
            <span className="grow"><strong className="small">From {fromStay.stay.name}</strong><span className="tiny muted" style={{ display: "block" }}>{fromStay.label}</span></span>
            <span className="tiny">Directions</span>
          </a>
        </div>
      )}
      {people.length > 0 && (
        <div className="detail-section">
          <h3>Who&apos;s doing this</h3>
          <div className="row wrap" style={{ gap: 8 }}>
            {people.map((id) => <span key={id} className="row small" style={{ gap: 5 }}><Avatar name={nameOf(id)} color={colorOf(id)} size={22} /> {nameOf(id)}</span>)}
          </div>
        </div>
      )}
      {item.notes && <div className="detail-section"><h3>Notes</h3><p className="detail-notes small">{item.notes}</p></div>}
      {canEdit && hasModule("ideas") && (
        <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => void backToIdeas(item).then((ok) => ok && onClose?.())}>
          <Undo2 size={14} /> Back to {voice.ideas.thing === "idea" ? "ideas" : `${voice.ideas.thing}s`}
        </button>
      )}
      <LinkedMemories type="itinerary" id={item.id} />
      <PaymentPanel type="itinerary" id={item.id} category="activities" />
      <div className="detail-section">
        <h3 className="row" style={{ gap: 6 }}><Clock size={13} /> Comments</h3>
        <CommentThread entity="itinerary" id={item.id} />
      </div>
    </div>
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

/** "Today", "Tomorrow", "This week" or "Next week": for ongoing calendars. */
function relativeDay(day: string): string {
  const diff = daysBetween(todayString(), day);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return diff === -1 ? "Yesterday" : parseMonth(day);
  if (diff < 7) return "This week";
  if (diff < 14) return "Next week";
  return parseMonth(day);
}

function parseMonth(day: string) {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function FixedRow({ e }: { e: FixedEvent }) {
  const inner = (
    <>
      <span className="itin-time">{formatTime(e.time) || "—"}</span>
      <span className="cat-dot" style={{ background: "var(--surface)" }}>
        {e.kind === "flight" ? <ModeIcon mode={e.mode} size={15} /> : e.kind === "stay" ? <BedDouble size={15} /> : <span aria-hidden>{e.icon}</span>}
      </span>
      <div className="grow">
        <strong className="small">{e.title}</strong>
        <div className="tiny muted">{e.sub}</div>
      </div>
    </>
  );
  return e.href ? (
    <Link href={e.href} className="itin-item itin-fixed" style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}>{inner}</Link>
  ) : (
    <div className="itin-item itin-fixed">{inner}</div>
  );
}
