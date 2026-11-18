"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Copy, Pencil, Check, MapPin, Navigation, AlertTriangle, Moon } from "lucide-react";
import { LinkedMemories } from "../memories/Memories";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Modal } from "../ui/Modal";
import { Avatar, EmptyState, Field, PersonPicker, PlaceSearch, Segmented } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { CommentThread } from "./Comments";
import { CostEditor, costColumns, costValueFrom, type CostValue } from "../ui/CostEditor";
import { PaymentPanel, PayStatus } from "./Payments";
import { participantsForFlight, useMoney } from "./money";
import { AirportInput } from "../travel/AirportInput";
import { CardOptions, useCardChoice, useCardParts } from "../ui/CardOptions";
import { leg, useTravel } from "../travel/useTravel";
import { addDays, formatDay, formatMoney, formatTime, splitLocal } from "@/lib/format";
import { flightOptionKey, groupFlights, stayForDay } from "@/lib/travel";
import { MODE_LIST, connects, directionsThrough, dropOff, endLabel, endPoint, formatWait, journeyKm, journeyLegs, journeyPoints, layovers, modeOf, routeText, transportTitle, type Layover, type TransportMode } from "@/lib/transport";
import { ModeIcon } from "../travel/ModeIcon";
import { formatDistance, hasCoords, travelLabel } from "@/lib/geo";
import type { BookingStatus, Flight, Place, TransportStop } from "@/lib/types";

function duration(dep: string | null, arr: string | null, mode: TransportMode = "flight"): string {
  if (!dep || !arr) return "";
  const a = new Date(dep).getTime();
  const b = new Date(arr).getTime();
  if (!(b > a)) return "";
  // Rental cars: how many days you have it.
  if (mode === "rental") {
    const days = Math.max(1, Math.round((b - a) / 86_400_000));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  // Local times in two places can't give a true duration without time zones,
  // so only show it when arrival is later and within a day or so.
  if (b - a > 30 * 3600_000) return "";
  const mins = Math.round((b - a) / 60000);
  const h = Math.floor(mins / 60);
  return `${h ? `${h}h ` : ""}${mins % 60}m${mode === "flight" ? " (local times)" : ""}`;
}

/** Midnight means "time not known yet" (rough dates for flights you're still considering). */
const timeOf = (t: string | null) => (t && t.slice(0, 5) !== "00:00" ? formatTime(t) : "");

/** "Thu, Oct 21" or "Around Thu, Oct 21 (±3 days)". */
export function flightDay(f: Pick<Flight, "depart_local" | "date_flex">): string {
  const d = splitLocal(f.depart_local).day;
  if (!d) return "Date not set";
  return f.date_flex ? `Around ${formatDay(d)} (±${f.date_flex} day${f.date_flex === 1 ? "" : "s"})` : formatDay(d);
}

/** One end of the route, big: an airport code, or a place name in smaller type. */
function End({ f, side, align }: { f: Flight; side: "from" | "to"; align?: "right" }) {
  const code = (side === "from" ? f.from_code : f.to_code)?.trim();
  // A rental car returned where you got it.
  const sameSpot = side === "to" && f.mode === "rental" && dropOff(f) === endLabel(f, "from");
  const label = sameSpot ? "Same place" : side === "to" ? dropOff(f) : endLabel(f, "from");
  const full = sameSpot ? "" : side === "from" ? f.from_name : f.to_name;
  const sub = code ? full : full && full.split(",").slice(1).join(",").trim();
  return (
    <div style={{ textAlign: align, minWidth: 0 }}>
      <div className={code ? "pass-code" : "pass-code pass-place"} style={align ? { marginLeft: "auto" } : undefined}>{label || "—"}</div>
      {sub && <div className="tiny muted truncate" style={{ maxWidth: 140, marginLeft: align ? "auto" : undefined }}>{sub}</div>}
    </div>
  );
}

export function FlightsSection({ compact = false }: { compact?: boolean }) {
  const { rows, canEdit, tripId, trip } = useTrip();
  const currency = trip?.currency;
  const [open, setOpen] = useState<{ flight: Flight | "new"; edit: boolean } | null>(null);
  const flights = [...rows.flights].sort((a, b) => (a.depart_local ?? "9999").localeCompare(b.depart_local ?? "9999"));
  const settled = flights.filter((f) => f.status !== "idea");
  const travel = useTravel();
  const show = useCardParts("flights");
  const group = useCardChoice("flights")("group");
  const { nameOf } = useTrip();
  const deciding = show("options") ? travel.flightGroups.filter((g) => g.options.length > 0) : [];
  // On My view: the next few flights (grouped ones show them all so each group is complete).
  const live = flights.filter((f) => f.status !== "cancelled" && (show("options") || f.status !== "idea"));
  const shown = compact ? (group === "none" ? live.slice(0, 3) : live) : settled;
  const groups = groupFlights(shown, group, nameOf);

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <ModuleTitle id="flights" fallback="Getting around" />
            <p>Flights, trains, buses, ferries, rental cars, rides and drives: who&apos;s going when, with confirmation codes in one place. Add options you&apos;re still considering too, with a rough date and price.</p>
          </div>
          <div className="toolbar">
            <CardOptions kind="flights" title="Travel cards" />
            {canEdit && <button className="btn btn-primary" onClick={() => setOpen({ flight: "new", edit: true })}><Plus size={16} /> Add travel</button>}
          </div>
        </div>
      )}
      {flights.length === 0 ? (
        <EmptyState icon={<ModeIcon mode="flight" size={28} />} title="No travel added yet" action={canEdit && <button className="btn btn-sm" onClick={() => setOpen({ flight: "new", edit: true })}><Plus size={14} /> Add travel</button>}>
          Flights, trains, buses, ferries, rental cars, rideshares or a road trip. Not booked yet? Add the ones you&apos;re looking at with a rough date and price. They go into the budget as an estimate until you book.
        </EmptyState>
      ) : (
        <div className="stack">
          {!compact && deciding.length > 0 && (
            <div className="stack">
              {deciding.map((g) => (
                <section key={g.key} className="card options-card">
                  <div className="row-between wrap" style={{ gap: 6 }}>
                    <div>
                      <span className="tiny muted options-kicker">{g.booked.length ? "Other options (one's booked)" : "Still deciding"}</span>
                      <h3 className="row" style={{ gap: 6 }}><ModeIcon mode={g.options[0]?.mode} /> {g.key === "? → ?" ? `${modeOf(g.options[0] ?? {}).label} options` : g.key}</h3>
                    </div>
                    {g.cheapestTotal != null && <span className="chip chip-2">{g.options.length} option{g.options.length === 1 ? "" : "s"} · from {formatMoney(g.cheapestTotal, currency)}</span>}
                  </div>
                  <div className="stack" style={{ gap: 6, marginTop: 10 }}>
                    {g.options.map((f) => (
                      <OptionRow key={f.id} flight={f} cheapest={g.options.length > 1 && g.cheapest?.id === f.id} others={g.options.filter((o) => o.id !== f.id)} onOpen={() => setOpen({ flight: f, edit: false })} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.key} className="card-group stack">
              {g.title && <h3 className="card-group-title">{g.title} <span className="tiny muted">{g.flights.length}</span></h3>}
              {g.flights.map((f) => <BoardingPass key={`${g.key}${f.id}`} flight={f} compact={compact} onOpen={() => setOpen({ flight: f, edit: false })} />)}
            </div>
          ))}
        </div>
      )}
      {compact && live.length > shown.length && (
        <Link className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} href={`/trips/${tripId}/flights`}>All travel →</Link>
      )}
      <FlightPanel open={open} onClose={() => setOpen(null)} onEdit={(f) => setOpen({ flight: f, edit: true })} onView={(f) => setOpen({ flight: f, edit: false })} />
    </div>
  );
}

/** Book one option; offer to set the others aside. */
function useBook() {
  const { update } = useTrip();
  const toast = useToast();
  return async (f: Flight, others: Flight[]) => {
    if (!(await update("flights", f.id, { status: "booked", date_flex: 0 }))) return false;
    if (others.length && window.confirm(`Booked! Set the other ${others.length} option${others.length === 1 ? "" : "s"} aside? (They're kept as "cancelled" so you can look back.)`)) {
      await Promise.all(others.map((o) => update("flights", o.id, { status: "cancelled" })));
    }
    toast.success("Booked. Add the confirmation code and exact times when you have them.");
    return true;
  };
}

function OptionRow({ flight: f, cheapest, others, onOpen }: { flight: Flight; cheapest: boolean; others: Flight[]; onOpen: () => void }) {
  const { trip, canEdit } = useTrip();
  const travel = useTravel();
  const book = useBook();
  const total = travel.flightTotal(f);
  const people = Math.max(1, f.travelers.length || 1);
  const dep = splitLocal(f.depart_local);
  return (
    <div className="option-row" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div className="grow" style={{ minWidth: 0 }}>
        <strong className="truncate row" style={{ gap: 6 }}><ModeIcon mode={f.mode} size={14} /> {[f.airline, modeOf(f).number ? f.flight_number : ""].filter(Boolean).join(" ") || `Any ${modeOf(f).carrier?.toLowerCase() ?? modeOf(f).noun}`}</strong>
        <span className="tiny muted">{flightDay(f)}{timeOf(dep.time) && ` · ${timeOf(dep.time)}`}</span>
      </div>
      <div style={{ textAlign: "right" }}>
        {total != null ? (
          <>
            <strong>{formatMoney(total, trip?.currency)}</strong>
            {people > 1 && <span className="tiny muted" style={{ display: "block" }}>{formatMoney(total / people, trip?.currency)} each</span>}
          </>
        ) : (
          <span className="tiny muted">No price yet</span>
        )}
      </div>
      {cheapest && <span className="chip chip-ok">Cheapest</span>}
      {canEdit && (
        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); void book(f, others); }}>
          <Check size={14} /> Book
        </button>
      )}
    </div>
  );
}

function BoardingPass({ flight: f, compact, onOpen }: { flight: Flight; compact?: boolean; onOpen: () => void }) {
  const { nameOf, colorOf } = useTrip();
  const show = useCardParts("flights");
  const toast = useToast();
  const dep = splitLocal(f.depart_local);
  const arr = splitLocal(f.arrive_local);
  const m = modeOf(f);
  return (
    <article className="card pass card-hover" style={{ cursor: "pointer", opacity: f.status === "cancelled" ? 0.5 : 1 }} onClick={onOpen}>
      <div className="pass-main">
        <div className="row-between">
          <span className="tiny muted" style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {m.emoji} {[f.airline, m.number ? f.flight_number : ""].filter(Boolean).join(" · ") || m.label}
          </span>
          {f.status === "idea" && <span className="chip chip-2">Not booked</span>}
          {f.status === "cancelled" && <span className="chip chip-muted">Not chosen</span>}
        </div>
        <div className="pass-route">
          <End f={f} side="from" />
          <div className="pass-line"><ModeIcon mode={f.mode} size={18} /></div>
          <End f={f} side="to" align="right" />
        </div>
        {show("stops") && <StopsLine flight={f} />}
        <div className="row-between small">
          <div>
            <strong>{timeOf(dep.time) || "—"}</strong>
            <div className="tiny muted">{f.date_flex ? flightDay(f) : formatDay(dep.day)}</div>
          </div>
          <span className="tiny muted hide-sm">{duration(f.depart_local, f.arrive_local, m.id)}</span>
          <div style={{ textAlign: "right" }}>
            <strong>{timeOf(arr.time) || "—"}</strong>
            <div className="tiny muted">{formatDay(arr.day)}</div>
          </div>
        </div>
        {show("travelers") && f.travelers.length > 0 && (
          <div className="row">
            <div className="avatar-stack">
              {f.travelers.map((id) => <Avatar key={id} name={nameOf(id)} color={colorOf(id)} size={24} />)}
            </div>
            <span className="tiny muted">{f.travelers.map(nameOf).join(", ")}</span>
          </div>
        )}
      </div>
      <div className="pass-stub">
        {show("confirmation") && m.confirmation && <><span className="tiny muted">Confirmation</span>
        {f.confirmation ? (
          <button
            className="btn btn-sm btn-ghost"
            style={{ fontFamily: "monospace", fontSize: "1rem", letterSpacing: "0.08em" }}
            onClick={(e) => {
              e.stopPropagation();
              void navigator.clipboard?.writeText(f.confirmation);
              toast.success("Confirmation code copied");
            }}
          >
            {f.confirmation} <Copy size={12} />
          </button>
        ) : (
          <span className="muted">—</span>
        )}</>}
        {show("seats") && f.seats && <span className="tiny">Seats {f.seats}</span>}
        {show("price") && <FlightMoney flight={f} />}
      </div>
    </article>
  );
}

function FlightMoney({ flight: f }: { flight: Flight }) {
  const { trip } = useTrip();
  const money = useMoney();
  const travel = useTravel();
  const c = money.byKey[`flight:${f.id}`];
  if (f.status === "idea") {
    const t = travel.flightTotal(f);
    return t != null ? <span className="tiny muted">≈ {formatMoney(t, trip?.currency)} (estimate)</span> : null;
  }
  if (!c?.total && !c?.paid) return null;
  return (
    <>
      {c.total != null && <span className="tiny muted">{formatMoney(c.total, trip?.currency)}</span>}
      <PayStatus thing={c} />
    </>
  );
}

// ---------------------------------------------------------------- panel

function FlightPanel({ open, onClose, onEdit, onView }: { open: { flight: Flight | "new"; edit: boolean } | null; onClose: () => void; onEdit: (f: Flight) => void; onView: (f: Flight) => void }) {
  const { canEdit, rows } = useTrip();
  // Always show the latest copy (someone else may have edited it).
  const live = open && open.flight !== "new" ? rows.flights.find((f) => f.id === (open.flight as Flight).id) ?? null : null;
  const editing = !!open && (open.edit || open.flight === "new");
  return (
    <Modal
      open={!!open && (open.flight === "new" || !!live)}
      onClose={onClose}
      variant="panel"
      title={open?.flight === "new" ? "Add travel" : live ? transportTitle(live) : ""}
      actions={!editing && live && canEdit ? <button className="btn btn-sm" onClick={() => onEdit(live)}><Pencil size={14} /> Edit</button> : undefined}
      footer={editing && canEdit ? <FormFooter flight={live} onClose={onClose} onCancel={live ? () => onView(live) : onClose} /> : undefined}
    >
      {editing ? <FlightForm key={live?.id ?? "new"} flight={live} onDone={live ? () => onView(live) : onClose} /> : live ? <FlightDetails flight={live} /> : null}
    </Modal>
  );
}

function FormFooter({ flight, onClose, onCancel }: { flight: Flight | null; onClose: () => void; onCancel: () => void }) {
  const { remove } = useTrip();
  return (
    <>
      {flight && (
        <button className="btn btn-danger" type="button" onClick={async () => { if (confirm(`Delete this ${modeOf(flight).noun}?`)) { await remove("flights", flight.id); onClose(); } }}>
          <Trash2 size={15} /> Delete
        </button>
      )}
      <span className="spacer" />
      <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary" form="flight-form">{flight ? "Save" : "Add"}</button>
    </>
  );
}

function FlightDetails({ flight: f }: { flight: Flight }) {
  const { trip, nameOf, colorOf, rows, canEdit } = useTrip();
  const travel = useTravel();
  const toast = useToast();
  const book = useBook();
  const money = useMoney();
  const dep = splitLocal(f.depart_local);
  const arr = splitLocal(f.arrive_local);
  const m = modeOf(f);
  const from = endPoint(f, "from", travel.airport);
  const to = endPoint(f, "to", travel.airport);
  const route = from && to && (from.lat !== to.lat || from.lng !== to.lng) ? leg(from, to) : null;
  const stops = f.stops ?? [];
  const km = stops.length ? journeyKm(f, travel.airport) : route?.km ?? null;
  const roadish = m.id === "drive" || m.id === "rideshare" || m.id === "rental";
  const fromAirport = m.airports ? travel.airport(f.from_code) : null;
  const toAirport = m.airports ? travel.airport(f.to_code) : null;
  const total = f.status === "idea" ? travel.flightTotal(f) : money.byKey[`flight:${f.id}`]?.total ?? null;
  const people = Math.max(1, f.travelers.length || 1);
  // Where you're headed after arriving.
  const landDay = arr.day ?? dep.day;
  const stay = landDay ? stayForDay(rows.stays, landDay) ?? stayForDay(rows.stays, addDays(landDay, 1)) : null;
  const toStay = stay && to && hasCoords(stay.location) ? leg(to, stay.location) : null;
  const others = travel.flightGroups.find((g) => g.key === flightOptionKey(f))?.options.filter((o) => o.id !== f.id) ?? [];

  return (
    <div className="detail">
      <div className="pass-route" style={{ padding: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div className={f.from_code ? "pass-code" : "pass-code pass-place"}>{endLabel(f, "from") || "—"}</div>
          <div className="tiny muted">{fromAirport?.name ?? (f.from_code ? f.from_name : f.from_name.split(",").slice(1).join(",").trim())}</div>
        </div>
        <div className="pass-line"><ModeIcon mode={f.mode} size={18} /></div>
        <div style={{ textAlign: "right", minWidth: 0 }}>
          {m.id === "rental" && dropOff(f) === endLabel(f, "from") ? (
            <div className="pass-code pass-place" style={{ marginLeft: "auto" }}>Same place</div>
          ) : (
            <>
              <div className={f.to_code ? "pass-code" : "pass-code pass-place"} style={{ marginLeft: "auto" }}>{dropOff(f) || "—"}</div>
              <div className="tiny muted">{toAirport?.name ?? (f.to_code ? f.to_name : (f.to_name || "").split(",").slice(1).join(",").trim())}</div>
            </>
          )}
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className={f.status === "booked" ? "chip chip-ok" : f.status === "idea" ? "chip chip-2" : "chip chip-muted"}>{f.status === "booked" ? "Booked" : f.status === "idea" ? "Considering" : "Not chosen"}</span>
        {f.option_group && <span className="chip chip-muted">{f.option_group}</span>}
        <span className="chip chip-muted">{m.emoji} {m.label}</span>
        {km != null && km > 0 && <span className="chip chip-muted">{formatDistance(km)} {m.noun}</span>}
        {stops.length > 0 && <span className="chip chip-muted">{stops.length} {connects(m.id) ? (stops.length === 1 ? "connection" : "connections") : stops.length === 1 ? "stop" : "stops"}</span>}
        {duration(f.depart_local, f.arrive_local, m.id) && <span className="chip chip-muted">{duration(f.depart_local, f.arrive_local, m.id)}</span>}
      </div>
      <div className="detail-grid">
        <div><small>{m.depart}</small>{f.date_flex ? flightDay(f) : formatDay(dep.day) || "—"}{timeOf(dep.time) && <> · {timeOf(dep.time)}</>}</div>
        <div><small>{m.arrive}</small>{formatDay(arr.day) || "—"}{timeOf(arr.time) && <> · {timeOf(arr.time)}</>}</div>
        {m.carrier && <div><small>{m.carrier}</small>{f.airline || "—"}</div>}
        {m.number && <div><small>{m.number}</small>{f.flight_number || "—"}</div>}
        {m.confirmation && <div>
          <small>Confirmation</small>
          {f.confirmation ? (
            <button className="link-btn" onClick={() => { void navigator.clipboard?.writeText(f.confirmation); toast.success("Copied"); }} style={{ fontFamily: "monospace", letterSpacing: "0.06em" }}>
              {f.confirmation} <Copy size={11} />
            </button>
          ) : "—"}
        </div>}
        {m.seats && f.seats && <div><small>{m.seats}</small>{f.seats}</div>}
        <div>
          <small>{f.status === "idea" ? "Estimated price" : "Price"}</small>
          {total != null ? <>{f.status === "idea" && "≈ "}{formatMoney(total, trip?.currency)}{people > 1 && <span className="tiny muted"> · {formatMoney(total / people, trip?.currency)} each</span>}</> : "—"}
        </div>
      </div>
      {f.travelers.length > 0 && (
        <div className="detail-section">
          <h3>{m.who}</h3>
          <div className="row wrap" style={{ gap: 8 }}>
            {f.travelers.map((id) => <span key={id} className="row small" style={{ gap: 5 }}><Avatar name={nameOf(id)} color={colorOf(id)} size={22} /> {nameOf(id)}</span>)}
          </div>
        </div>
      )}
      {stops.length > 0 && <JourneyTimeline flight={f} />}
      {!stops.length && route && (m.id === "drive" || m.id === "rideshare" || (m.id === "rental" && f.to_name && f.to_name !== f.from_name)) && (
        <div className="detail-section">
          <h3>Route</h3>
          <a className="dist-row" href={route.href} target="_blank" rel="noopener noreferrer">
            <Navigation size={16} />
            <span className="grow"><strong className="small">{routeText(f)}</strong><span className="tiny muted" style={{ display: "block" }}>{route.label}</span></span>
            <span className="tiny">Directions</span>
          </a>
        </div>
      )}
      {toStay && stay && m.id !== "rental" && (
        <div className="detail-section">
          <h3>After you {m.id === "flight" ? "land" : "arrive"}</h3>
          <a className="dist-row" href={toStay.href} target="_blank" rel="noopener noreferrer">
            <MapPin size={16} />
            <span className="grow"><strong className="small">{dropOff(f)} → {stay.name}</strong><span className="tiny muted" style={{ display: "block" }}>{toStay.label}</span></span>
            <span className="tiny">Directions</span>
          </a>
        </div>
      )}
      {f.status === "idea" && canEdit && (
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => void book(f, others)}><Check size={15} /> Book this one</button>
      )}
      {f.notes && <div className="detail-section"><h3>Notes</h3><p className="detail-notes small">{f.notes}</p></div>}
      <LinkedMemories type="flight" id={f.id} />
      {f.status === "booked" && <PaymentPanel type="flight" id={f.id} category={m.category} />}
      <div className="detail-section">
        <h3>Comments</h3>
        <CommentThread entity="flight" id={f.id} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- form

const FLEX = [0, 1, 2, 3, 7, 14];

function FlightForm({ flight: existing, onDone }: { flight: Flight | null; onDone: () => void }) {
  const { insert, update, rows, nameOf, colorOf, trip, me, goingIds, householdOf } = useTrip();
  const [form, setForm] = useState(() => {
    const dep = splitLocal(existing?.depart_local ?? null);
    const arr = splitLocal(existing?.arrive_local ?? null);
    const t = (x: string | null) => (x && x.slice(0, 5) !== "00:00" ? x.slice(0, 5) : "");
    const place = (name: string, lat?: number | null, lng?: number | null): Place => (lat != null && lng != null ? { name, lat, lng } : { name });
    return {
      mode: (existing?.mode ?? "flight") as TransportMode,
      airline: existing?.airline ?? "",
      flight_number: existing?.flight_number ?? "",
      from_code: existing?.from_code ?? "",
      from_name: existing?.from_name ?? "",
      to_code: existing?.to_code ?? "",
      to_name: existing?.to_name ?? "",
      from_place: place(existing?.from_name ?? "", existing?.from_lat, existing?.from_lng),
      to_place: place(existing?.to_name ?? "", existing?.to_lat, existing?.to_lng),
      dep_day: dep.day ?? "",
      dep_time: t(dep.time),
      arr_day: arr.day ?? "",
      arr_time: t(arr.time),
      date_flex: existing?.date_flex ?? 0,
      option_group: existing?.option_group ?? "",
      confirmation: existing?.confirmation ?? "",
      seats: existing?.seats ?? "",
      status: (existing?.status ?? "booked") as BookingStatus,
      travelers: existing?.travelers ?? (me ? [me] : []),
      cost: costValueFrom(existing?.cost ?? null, existing ?? null, perCar(existing?.mode) ? "group" : "person") as CostValue,
      notes: existing?.notes ?? "",
      stops: (existing?.stops ?? []) as TransportStop[],
    };
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const people = rows.trip_members.map((m) => m.user_id);
  const groups = [...new Set(rows.flights.map((f) => f.option_group).filter(Boolean))] as string[];
  const considering = form.status === "idea";
  const m = modeOf(form);
  const near = trip?.lat != null && trip?.lng != null ? { lat: trip.lat, lng: trip.lng } : null;
  const routeHint = routeText(m.airports ? form : { ...form, from_code: "", to_code: "", from_name: form.from_place.name ?? "", to_name: form.to_place.name ?? "" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const stamp = (d: string, t: string) => (d ? `${d}T${t || "00:00"}` : null);
    // Airports come from the airport list; everything else is a place search with a pin.
    const ends = m.airports
      ? {
          from_code: form.from_code.trim().toUpperCase(), from_name: form.from_name.trim(),
          to_code: form.to_code.trim().toUpperCase(), to_name: form.to_name.trim(),
          from_lat: null, from_lng: null, to_lat: null, to_lng: null,
        }
      : {
          from_code: "", from_name: (form.from_place.name ?? "").trim(),
          to_code: "", to_name: (form.to_place.name ?? "").trim(),
          from_lat: form.from_place.lat ?? null, from_lng: form.from_place.lng ?? null,
          to_lat: form.to_place.lat ?? null, to_lng: form.to_place.lng ?? null,
        };
    // Empty stops are dropped; dated ones are put in order.
    const dated = (t: string | null | undefined) => (!t ? null : t.startsWith("T") ? (form.dep_day ? `${form.dep_day}${t}` : null) : t);
    let stops = form.stops
      .map((st) => ({ ...st, arrive_local: dated(st.arrive_local), depart_local: dated(st.depart_local) }))
      .map((st) => (m.airports ? { ...st, code: (st.code ?? "").trim().toUpperCase(), name: st.name.trim(), lat: null, lng: null } : { ...st, code: "", name: st.name.trim() }))
      .filter((st) => st.name || st.code);
    const key = (st: TransportStop) => st.arrive_local || st.depart_local || "";
    if (stops.every(key)) stops = [...stops].sort((a, b) => key(a).localeCompare(key(b)));
    if (m.id === "rental") stops = [];
    const row = {
      mode: form.mode,
      stops,
      airline: m.carrier ? form.airline.trim() : "",
      flight_number: m.number ? (m.airports ? form.flight_number.trim().toUpperCase() : form.flight_number.trim()) : "",
      ...ends,
      depart_local: stamp(form.dep_day, form.dep_time),
      arrive_local: stamp(form.arr_day, form.arr_time),
      date_flex: considering ? form.date_flex : 0,
      option_group: form.option_group.trim(),
      confirmation: m.confirmation ? form.confirmation.trim().toUpperCase() : "",
      seats: m.seats ? form.seats.trim() : "",
      status: form.status,
      travelers: form.travelers,
      ...costColumns(form.cost),
      notes: form.notes,
    };
    const ok = existing ? await update("flights", existing.id, row) : !!(await insert("flights", row));
    if (ok) onDone();
  }

  // Switching between airports and places carries the names across.
  const pickMode = (next: TransportMode) =>
    setForm((f) => {
      const was = modeOf(f).airports;
      const now = MODES_AIR.has(next);
      // Cars and rides are priced for the whole group; tickets per person (until a price is typed).
      if (!f.cost.price) f = { ...f, cost: { ...f.cost, cost_unit: perCar(next) ? "group" : "person" } };
      if (was === now) return { ...f, mode: next };
      const stops = f.stops.map((st) => (now ? { ...st, code: "", lat: null, lng: null } : { ...st, name: st.name || st.code || "", code: "" }));
      return now
        ? { ...f, mode: next, stops, from_name: f.from_place.name ?? "", to_name: f.to_place.name ?? "", from_code: "", to_code: "" }
        : { ...f, mode: next, stops, from_place: { name: f.from_name || f.from_code }, to_place: { name: f.to_name || f.to_code } };
    });

  return (
    <form id="flight-form" className="form-grid" onSubmit={save}>
      <Field label="How are you getting there?" full>
        <div className="mode-picker" role="radiogroup" aria-label="Type of travel">
          {MODE_LIST.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={form.mode === x.id} className={form.mode === x.id ? "on" : undefined} onClick={() => pickMode(x.id)}>
              <ModeIcon mode={x.id} size={18} />
              {x.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Status" full>
        <Segmented<BookingStatus> value={form.status} onChange={(v) => set("status", v)} options={[{ value: "idea", label: "Considering" }, { value: "booked", label: m.confirmation ? "Booked" : "Planned" }, { value: "cancelled", label: "Not chosen" }]} />
      </Field>
      {m.airports ? (
        <>
          <Field label={m.from}><AirportInput label="From airport" code={form.from_code} name={form.from_name} onChange={(c, n) => setForm((f) => ({ ...f, from_code: c, from_name: n }))} placeholder={m.fromPlaceholder} /></Field>
          <Field label={m.to}><AirportInput label="To airport" code={form.to_code} name={form.to_name} onChange={(c, n) => setForm((f) => ({ ...f, to_code: c, to_name: n }))} placeholder={m.toPlaceholder} /></Field>
        </>
      ) : (
        <>
          <Field label={m.from}><PlaceSearch key={`from-${form.mode}`} value={form.from_place} onChange={(p) => set("from_place", p)} near={near} placeholder={m.fromPlaceholder} /></Field>
          <Field label={m.to}><PlaceSearch key={`to-${form.mode}`} value={form.to_place} onChange={(p) => set("to_place", p)} near={near} placeholder={m.toPlaceholder} /></Field>
        </>
      )}
      {m.id !== "rental" && (
        <Field label={connects(m.id) ? "Connections" : "Stops on the way"} hint={form.stops.length ? undefined : connects(m.id) ? `Changing ${m.noun}s? Add each place you connect, and the layover time is worked out for you.` : "Lunch, a viewpoint, a town you're staying the night in…"} full>
          <div className="stack" style={{ gap: 8 }}>
            {form.stops.map((st, i) => (
              <StopEditor
                key={st.id}
                stop={st}
                index={i}
                mode={m}
                near={near}
                defaultDay={form.dep_day}
                carrierFallback={form.airline}
                onChange={(next) => set("stops", form.stops.map((x) => (x.id === st.id ? next : x)))}
                onRemove={() => set("stops", form.stops.filter((x) => x.id !== st.id))}
              />
            ))}
            <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => set("stops", [...form.stops, { id: crypto.randomUUID(), name: "", code: "" }])}>
              <Plus size={14} /> {connects(m.id) ? "Add a connection" : "Add a stop"}
            </button>
          </div>
        </Field>
      )}
      <Field label={considering ? `${m.depart} around` : m.depart}><input className="input" type="date" value={form.dep_day} onChange={(e) => set("dep_day", e.target.value)} /></Field>
      {considering ? (
        <Field label="How sure is the date?">
          <select className="input" value={form.date_flex} onChange={(e) => set("date_flex", Number(e.target.value))}>
            {FLEX.map((n) => <option key={n} value={n}>{n === 0 ? "This exact day" : `Give or take ${n} day${n === 1 ? "" : "s"}`}</option>)}
          </select>
        </Field>
      ) : (
        <Field label="Time (local)"><input className="input" type="time" value={form.dep_time} onChange={(e) => set("dep_time", e.target.value)} /></Field>
      )}
      {considering && <Field label="Time (if you know it)"><input className="input" type="time" value={form.dep_time} onChange={(e) => set("dep_time", e.target.value)} /></Field>}
      <Field label={m.arrive}><input className="input" type="date" min={form.dep_day || undefined} value={form.arr_day} onChange={(e) => set("arr_day", e.target.value)} /></Field>
      <Field label="Time (local)"><input className="input" type="time" value={form.arr_time} onChange={(e) => set("arr_time", e.target.value)} /></Field>
      {m.carrier && <Field label={m.carrier}><input className="input" value={form.airline} onChange={(e) => set("airline", e.target.value)} placeholder={m.carrierPlaceholder} /></Field>}
      {m.number && <Field label={m.number}><input className="input" value={form.flight_number} onChange={(e) => set("flight_number", e.target.value)} placeholder={m.numberPlaceholder} /></Field>}
      {!considering && (m.confirmation || m.seats) && (
        <>
          {m.confirmation && <Field label="Confirmation code"><input className="input" value={form.confirmation} onChange={(e) => set("confirmation", e.target.value)} placeholder="ABC123" /></Field>}
          {m.seats && <Field label={m.seats}><input className="input" value={form.seats} onChange={(e) => set("seats", e.target.value)} placeholder={m.seatsPlaceholder} /></Field>}
        </>
      )}
      <Field label="Compare with" hint={`Options with the same name are compared, and only the cheapest counts toward the budget. Leave empty to compare by route${routeHint && !routeHint.startsWith("at ") ? ` (${routeHint})` : ""}.`} full>
        <input className="input" list="flight-groups" value={form.option_group} onChange={(e) => set("option_group", e.target.value)} placeholder="e.g. Getting there, Airport to hotel, Lizza's ride" maxLength={80} />
        <datalist id="flight-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      </Field>
      <Field label={m.who} full>
        <PersonPicker people={people} value={form.travelers} onChange={(v) => set("travelers", v)} nameOf={nameOf} colorOf={colorOf} />
      </Field>
      <CostEditor value={form.cost} onChange={(v) => set("cost", v)} participants={participantsForFlight(form, goingIds)} currency={trip?.currency ?? "USD"} householdOf={householdOf} label={considering ? "Rough price" : m.price} />
      <Field label="Notes" full><textarea className="input textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={m.notesPlaceholder} /></Field>
    </form>
  );
}

const perCar = (mode?: string | null) => mode === "rental" || mode === "drive" || mode === "rideshare";

const MODES_AIR = new Set<TransportMode>(MODE_LIST.filter((x) => x.airports).map((x) => x.id));

// ---------------------------------------------------------------- stops

function waitLabel(l: Layover, mode: string): string {
  if (l.overnight) return l.minutes != null && l.minutes >= 60 ? `Overnight · ${formatWait(l.minutes)}` : "Overnight";
  if (l.minutes == null) return "";
  return `${formatWait(l.minutes)}${connects(mode) ? " layover" : " stop"}`;
}

const WARN: Record<NonNullable<Layover["warn"]>, string> = {
  tight: "Tight connection",
  short: "Cutting it close",
  long: "Long wait",
};

/** "via ORD · 1h 45m" chips on a card. */
function StopsLine({ flight: f }: { flight: Flight }) {
  const stops = layovers(f);
  if (!stops.length) return null;
  return (
    <div className="stops-line">
      <span className="tiny muted">{connects(f.mode) ? "via" : "stops"}</span>
      {stops.map((l) => {
        const label = l.stop.code?.trim() || l.stop.name.split(",")[0].trim() || "Stop";
        const wait = waitLabel(l, f.mode);
        return (
          <span key={l.stop.id} className={`stop-chip${l.warn === "tight" ? " warn-bad" : l.warn === "short" ? " warn-soft" : ""}`} title={l.warn ? WARN[l.warn] : undefined}>
            {l.overnight && <Moon size={11} />}
            {(l.warn === "tight" || l.warn === "short") && <AlertTriangle size={11} />}
            <strong>{label}</strong>
            {wait && <span>· {wait.replace(" layover", "").replace(" stop", "")}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Every leg and stop in order, with layovers, distances and directions. */
function JourneyTimeline({ flight: f }: { flight: Flight }) {
  const travel = useTravel();
  const m = modeOf(f);
  const points = journeyPoints(f, travel.airport);
  const legs = journeyLegs(f, travel.airport);
  const waits = layovers(f);
  const road = m.id === "drive" || m.id === "rideshare" || m.id === "rental" || m.id === "other";
  const href = road ? directionsThrough(points.map((p) => p.at)) : null;
  const when = (t: string | null) => {
    const x = splitLocal(t);
    return [formatDay(x.day), timeOf(x.time)].filter(Boolean).join(" · ");
  };
  return (
    <div className="detail-section">
      <h3>{connects(m.id) ? "Legs & layovers" : "Stops on the way"}</h3>
      <ol className="journey">
        {points.map((p, i) => {
          const l = p.stop >= 0 ? waits[p.stop] : null;
          const next = legs[i];
          return (
            <li key={`${p.stop}-${i}`}>
              <div className={`journey-point${p.stop >= 0 ? " is-stop" : ""}`}>
                <span className="journey-dot" aria-hidden />
                <div className="grow" style={{ minWidth: 0 }}>
                  <strong className="small">{p.label || "—"}</strong>
                  {p.name && p.name !== p.label && <span className="tiny muted" style={{ display: "block" }}>{p.name}</span>}
                  <span className="tiny muted" style={{ display: "block" }}>
                    {p.stop === -1 ? when(p.depart) && `${m.depart} ${when(p.depart)}` : p.stop === -2 ? when(p.arrive) && `${m.arrive} ${when(p.arrive)}` : [p.arrive && `Arrive ${when(p.arrive)}`, p.depart && `leave ${when(p.depart)}`].filter(Boolean).join(", ")}
                  </span>
                  {l && (waitLabel(l, m.id) || l.warn) && (
                    <span className={`stop-chip${l.warn === "tight" ? " warn-bad" : l.warn === "short" ? " warn-soft" : ""}`} style={{ marginTop: 4 }}>
                      {l.overnight ? <Moon size={11} /> : l.warn && l.warn !== "long" ? <AlertTriangle size={11} /> : null}
                      {waitLabel(l, m.id)}{l.warn && ` · ${WARN[l.warn]}`}
                    </span>
                  )}
                  {p.stop >= 0 && f.stops?.[p.stop]?.note && <span className="tiny" style={{ display: "block", marginTop: 2 }}>{f.stops[p.stop].note}</span>}
                </div>
              </div>
              {next && (
                <div className="journey-leg tiny muted">
                  <ModeIcon mode={m.id} size={12} />
                  {connects(m.id) && [next.carrier, next.number].filter(Boolean).join(" ")}
                  {connects(m.id) && (next.carrier || next.number) && next.km != null && " · "}
                  {next.km != null && (road ? travelLabel(next.km) : formatDistance(next.km))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {href && (
        <a className="dist-row" href={href} target="_blank" rel="noopener noreferrer" style={{ marginTop: 8 }}>
          <Navigation size={16} />
          <span className="grow"><strong className="small">Directions through every stop</strong></span>
          <span className="tiny">Open map</span>
        </a>
      )}
    </div>
  );
}

function StopEditor({ stop, index, mode: m, near, defaultDay, carrierFallback, onChange, onRemove }: {
  stop: TransportStop;
  index: number;
  mode: ReturnType<typeof modeOf>;
  near: { lat: number; lng: number } | null;
  defaultDay: string;
  carrierFallback: string;
  onChange: (s: TransportStop) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<TransportStop>) => onChange({ ...stop, ...patch });
  const arr = splitLocal(stop.arrive_local ?? null);
  const dep = splitLocal(stop.depart_local ?? null);
  const t = (x: string | null) => (x && x.slice(0, 5) !== "00:00" ? x.slice(0, 5) : "");
  // A time with no date yet is kept as "T10:00" and gets the day you set off when saved.
  const stamp = (d: string | null | undefined, time: string) => {
    const day = d || defaultDay || "";
    return day || time ? `${day}T${time || "00:00"}` : null;
  };
  const connecting = connects(m.id);
  return (
    <div className="journey-stop-editor">
      <div className="row-between">
        <strong className="small">{connecting ? `Connection ${index + 1}` : `Stop ${index + 1}`}</strong>
        <button type="button" className="icon-btn" aria-label="Remove this stop" onClick={onRemove}><Trash2 size={14} /></button>
      </div>
      {m.airports ? (
        <AirportInput label={`Connection ${index + 1} airport`} code={stop.code ?? ""} name={stop.name} onChange={(c, n) => set({ code: c, name: n })} placeholder="ORD or Chicago" />
      ) : (
        <PlaceSearch value={stop.lat != null && stop.lng != null ? { name: stop.name, lat: stop.lat, lng: stop.lng } : { name: stop.name }} onChange={(p) => set({ name: p.name ?? "", lat: p.lat ?? null, lng: p.lng ?? null })} near={near} placeholder={connecting ? "Where you change" : "Where you're stopping"} />
      )}
      <div className="journey-times">
        <Field label="Arrive">
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type="date" aria-label="Arrive date" value={arr.day ?? ""} onChange={(e) => set({ arrive_local: stamp(e.target.value, t(arr.time)) })} />
            <input className="input" type="time" aria-label="Arrive time" value={t(arr.time)} onChange={(e) => set({ arrive_local: stamp(arr.day, e.target.value) })} />
          </div>
        </Field>
        <Field label={connecting ? "Next departs" : "Leave"}>
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type="date" aria-label="Leave date" value={dep.day ?? ""} onChange={(e) => set({ depart_local: stamp(e.target.value, t(dep.time)) })} />
            <input className="input" type="time" aria-label="Leave time" value={t(dep.time)} onChange={(e) => set({ depart_local: stamp(dep.day, e.target.value) })} />
          </div>
        </Field>
      </div>
      <div className="form-grid" style={{ gap: 8 }}>
        {connecting && m.carrier && (
          <Field label={`Next ${m.carrier.toLowerCase()}`}><input className="input" value={stop.carrier ?? ""} onChange={(e) => set({ carrier: e.target.value })} placeholder={carrierFallback || m.carrierPlaceholder} /></Field>
        )}
        {connecting && m.number && (
          <Field label={`Next ${m.number.toLowerCase()}`}><input className="input" value={stop.number ?? ""} onChange={(e) => set({ number: e.target.value })} placeholder={m.numberPlaceholder} /></Field>
        )}
      </div>
      {!connecting && (
        <label className="row small" style={{ gap: 8 }}>
          <input type="checkbox" className="switch" checked={!!stop.overnight} onChange={(e) => set({ overnight: e.target.checked })} /> Staying the night here
        </label>
      )}
      <input className="input" value={stop.note ?? ""} onChange={(e) => set({ note: e.target.value })} placeholder={connecting ? "Terminal, gate, platform…" : "Why you're stopping, what to see…"} maxLength={300} />
    </div>
  );
}
