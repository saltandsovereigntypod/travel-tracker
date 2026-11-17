"use client";

import { useState } from "react";
import Link from "next/link";
import { BedDouble, Plus, Trash2, MapPin, Phone, ExternalLink, Copy, Moon, Pencil, Check, Plane, Sparkles, Map as MapIcon } from "lucide-react";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Modal } from "../ui/Modal";
import { Avatar, EmptyState, Field, PersonPicker, PlaceSearch, Segmented } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { CommentThread } from "./Comments";
import { CostEditor, costColumns, costValueFrom, type CostValue } from "../ui/CostEditor";
import { PaymentPanel, PayStatus } from "./Payments";
import { participantsForStay, stayNights, useMoney } from "./money";
import { useTravel } from "../travel/useTravel";
import { STAY_KINDS, stayKindOf } from "@/lib/categories";
import { daysBetween, formatDay, formatMoney, formatRange, formatTime, normalizeUrl, hostname } from "@/lib/format";
import { distanceKm, formatDistance } from "@/lib/geo";
import { mapsLink } from "@/lib/services";
import { stayOptionKey, staySearchLinks } from "@/lib/travel";
import type { BookingStatus, Place, Stay, StayKind } from "@/lib/types";

type Open = { stay: Stay | "new"; edit: boolean; init?: Partial<Stay> } | null;

export function StaysSection({ compact = false }: { compact?: boolean }) {
  const { rows, canEdit, tripId, trip } = useTrip();
  const [open, setOpen] = useState<Open>(null);
  const travel = useTravel();
  const stays = [...rows.stays].sort((a, b) => (a.check_in ?? "9999").localeCompare(b.check_in ?? "9999"));
  const settled = stays.filter((s) => s.status !== "idea");
  const deciding = travel.stayGroups.filter((g) => g.options.length > 0);
  const shown = compact ? stays.filter((s) => s.status !== "cancelled").slice(0, 3) : settled;
  const totalNights = stays.filter((s) => s.status === "booked" && s.check_in && s.check_out).reduce((n, s) => n + daysBetween(s.check_in!, s.check_out!), 0);
  const isTrip = (trip?.kind ?? "trip") === "trip";

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <ModuleTitle id="stays" fallback="Stays" />
            <p>Hotels, hostels, rentals and couches. {totalNights > 0 && `${totalNights} night${totalNights === 1 ? "" : "s"} booked.`}</p>
          </div>
          {canEdit && <button className="btn btn-primary" onClick={() => setOpen({ stay: "new", edit: true })}><Plus size={16} /> Add stay</button>}
        </div>
      )}
      {!compact && isTrip && <WhereToStay />}
      {stays.length === 0 ? (
        <EmptyState icon={<BedDouble />} title="No stays yet" action={canEdit && <button className="btn btn-sm" onClick={() => setOpen({ stay: "new", edit: true, init: { status: "idea" } })}><Plus size={14} /> Add an option</button>}>
          Add places you&apos;re comparing as options. Driftbook ranks them by how close they are to your plans and their price per night.
        </EmptyState>
      ) : (
        <div className="stack">
          {!compact &&
            deciding.map((g) => {
              const ranked = travel.ranked.filter((r) => g.options.some((o) => o.id === r.stay.id));
              const maxKm = Math.max(...ranked.map((r) => r.avgKm ?? 0), 0.5);
              return (
                <section key={g.key} className="card options-card">
                  <div className="row-between wrap" style={{ gap: 6 }}>
                    <div>
                      <span className="tiny muted options-kicker">{g.booked.length ? "Other options (one's booked)" : "Still deciding"}</span>
                      <h3 className="row" style={{ gap: 6 }}><BedDouble size={16} /> {g.key.includes("→") ? formatRange(g.key.split(" → ")[0], g.key.split(" → ")[1]) : g.key}</h3>
                    </div>
                    <span className="chip chip-muted">{g.options.length} option{g.options.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="stack" style={{ gap: 6, marginTop: 10 }}>
                    {ranked.map((r) => (
                      <FitRow key={r.stay.id} fit={r} maxKm={maxKm} cheapest={g.options.length > 1 && g.cheapest?.id === r.stay.id} others={g.options.filter((o) => o.id !== r.stay.id)} onOpen={() => setOpen({ stay: r.stay, edit: false })} />
                    ))}
                  </div>
                </section>
              );
            })}
          <div className={compact ? "stack" : "grid-cards"} style={compact ? undefined : { gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {shown.map((s) => <StayCard key={s.id} stay={s} compact={compact} onOpen={() => setOpen({ stay: s, edit: false })} />)}
          </div>
        </div>
      )}
      {compact && stays.length > shown.length && (
        <Link className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} href={`/trips/${tripId}/stays`}>All stays →</Link>
      )}
      <StayPanel open={open} onClose={() => setOpen(null)} onEdit={(s) => setOpen({ stay: s, edit: true })} />
    </div>
  );
}

/** The sweet spot for staying in each stretch of the trip, with searches already pointed at it. */
function WhereToStay() {
  const { goingIds, tripId } = useTrip();
  const travel = useTravel();
  if (!travel.periods.length) return null;
  const several = travel.periods.length > 1;
  return (
    <section className="card fit-card stack" style={{ marginBottom: "1rem", gap: "0.8rem" }}>
      <div className="spot">
        <span className="cat-dot" style={{ width: 42, height: 42, fontSize: 20, flex: "none" }}><Sparkles size={20} /></span>
        <div>
          <h3>Where to stay</h3>
          <p className="small muted" style={{ marginTop: 2 }}>
            Based on where your plans are{several ? " in each part of the trip" : ""}. Options are ranked by distance to those plans and price per night.
          </p>
        </div>
      </div>
      {travel.periods.map((p) => {
        // The plan nearest the center names the area.
        const nearest = [...travel.points]
          .filter((pt) => !p.checkIn || !p.checkOut || (pt.day && pt.day >= p.checkIn && pt.day <= p.checkOut))
          .sort((a, b) => distanceKm(p.spot.center, a) - distanceKm(p.spot.center, b))[0];
        const links = staySearchLinks({ center: p.spot.center, radiusKm: p.spot.radiusKm, checkIn: p.checkIn, checkOut: p.checkOut, guests: Math.max(1, goingIds.length) });
        return (
          <div key={`${p.checkIn}${p.checkOut}`} className="spot-period">
            {(several || p.checkIn) && <strong className="small">{p.checkIn ? formatRange(p.checkIn, p.checkOut) : "Your trip"}</strong>}
            <p className="small" style={{ margin: "2px 0 6px" }}>
              Stay near <strong>{nearest?.title}</strong>
              {p.spot.count === 1 ? ", your only plan with a place then" : <>: {p.spot.count} plans are within {formatDistance(p.spot.radiusKm)}</>}
              {p.spot.outliers > 0 && <span className="muted"> (not counting {p.spot.outliers} farther day trip{p.spot.outliers === 1 ? "" : "s"})</span>}.
            </p>
            <div className="row wrap" style={{ gap: 6 }}>
              {links.map((l) => <a key={l.label} className="chip chip-2" href={l.href} target="_blank" rel="noopener noreferrer"><ExternalLink size={11} /> {l.label}</a>)}
            </div>
          </div>
        );
      })}
      <Link className="chip chip-muted" style={{ alignSelf: "flex-start" }} href={`/trips/${tripId}/map?spot=1`}><MapIcon size={11} /> See it on the map</Link>
    </section>
  );
}

function useBookStay() {
  const { update } = useTrip();
  const toast = useToast();
  return async (s: Stay, others: Stay[]) => {
    if (!(await update("stays", s.id, { status: "booked" }))) return;
    if (others.length && window.confirm(`Booked! Set the other ${others.length} option${others.length === 1 ? "" : "s"} aside? (They're kept as "not chosen" so you can look back.)`)) {
      await Promise.all(others.map((o) => update("stays", o.id, { status: "cancelled" })));
    }
    toast.success("Booked. Add the confirmation and check-in times when you have them.");
  };
}

function FitRow({ fit, maxKm, cheapest, others, onOpen }: { fit: ReturnType<typeof useTravel>["ranked"][number]; maxKm: number; cheapest: boolean; others: Stay[]; onOpen: () => void }) {
  const { trip, canEdit } = useTrip();
  const book = useBookStay();
  const s = fit.stay;
  const kind = stayKindOf(s.kind);
  return (
    <div className="fit-row" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div style={{ minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          <strong className="truncate">{kind.emoji} {s.name}</strong>
          {fit.best && <span className="chip chip-ok"><Sparkles size={11} /> Best fit</span>}
          {cheapest && !fit.best && <span className="chip chip-ok">Cheapest</span>}
        </div>
        <span className="tiny muted">
          {fit.avgKm != null ? <>{formatDistance(fit.avgKm)} from your plans on average{fit.plans ? ` (${fit.plans})` : ""}</> : s.location?.lat == null ? "Add the address to compare distance" : "No plans with a place yet"}
        </span>
      </div>
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <div style={{ textAlign: "right" }}>
          {fit.perNight != null ? <><strong>{formatMoney(fit.perNight, trip?.currency)}</strong><span className="tiny muted" style={{ display: "block" }}>per night</span></> : <span className="tiny muted">No price</span>}
        </div>
        {canEdit && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); void book(s, others); }}><Check size={14} /> Book</button>}
      </div>
      {fit.avgKm != null && <div className="fit-bar" aria-hidden><span style={{ width: `${Math.max(6, 100 - (fit.avgKm / maxKm) * 94)}%` }} /></div>}
    </div>
  );
}

function StayCard({ stay: s, compact, onOpen }: { stay: Stay; compact?: boolean; onOpen: () => void }) {
  const { trip, nameOf, colorOf } = useTrip();
  const toast = useToast();
  const kind = stayKindOf(s.kind);
  const money = useMoney();
  const travel = useTravel();
  const costed = money.byKey[`stay:${s.id}`];
  const nights = s.check_in && s.check_out ? daysBetween(s.check_in, s.check_out) : null;
  const dirs = mapsLink(s.location, s.address || s.name);
  const fromAirport = travel.stayLegFromAirport(s);
  const fit = travel.fitOf(s.id);
  return (
    <article className="card card-hover" style={{ cursor: "pointer", opacity: s.status === "cancelled" ? 0.5 : 1 }} onClick={onOpen}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <span className="cat-dot" style={{ width: 42, height: 42, fontSize: 20 }}>{kind.emoji}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row-between">
            <h3 className="truncate">{s.name}</h3>
            {s.status === "idea" && <span className="chip chip-2">Option</span>}
            {s.status === "cancelled" && <span className="chip chip-muted">Not chosen</span>}
          </div>
          <span className="tiny muted">{kind.label}{s.address && ` · ${s.address}`}</span>
        </div>
      </div>
      <div className="row-between" style={{ marginTop: "0.9rem", gap: "0.4rem" }}>
        <div>
          <div className="tiny muted">Check in</div>
          <strong className="small">{formatDay(s.check_in) || "—"}</strong>
          {s.check_in_time && <div className="tiny muted">{formatTime(s.check_in_time)}</div>}
        </div>
        {nights != null && <span className="chip chip-muted"><Moon size={12} /> {nights} night{nights === 1 ? "" : "s"}</span>}
        <div style={{ textAlign: "right" }}>
          <div className="tiny muted">Check out</div>
          <strong className="small">{formatDay(s.check_out) || "—"}</strong>
          {s.check_out_time && <div className="tiny muted">{formatTime(s.check_out_time)}</div>}
        </div>
      </div>
      {!compact && (fromAirport || fit?.avgKm != null) && (
        <div className="stack tiny muted" style={{ gap: 2, marginTop: "0.7rem" }}>
          {fromAirport && <span className="row" style={{ gap: 5 }}><Plane size={12} /> {fromAirport.label} from {fromAirport.airport.code}</span>}
          {fit?.avgKm != null && fit.plans > 0 && <span className="row" style={{ gap: 5 }}><MapPin size={12} /> {formatDistance(fit.avgKm)} from your plans on average</span>}
        </div>
      )}
      {!compact && (
        <div className="row wrap" style={{ marginTop: "0.9rem", gap: "0.4rem" }} onClick={(e) => e.stopPropagation()}>
          {s.confirmation && (
            <button className="chip chip-muted" style={{ cursor: "pointer", border: 0 }} onClick={() => { void navigator.clipboard?.writeText(s.confirmation); toast.success("Confirmation copied"); }}>
              <Copy size={11} /> {s.confirmation}
            </button>
          )}
          {costed?.total != null && <span className="chip chip-muted">{formatMoney(costed.total, trip?.currency)}{nights ? ` · ${formatMoney(costed.total / Math.max(nights, 1), trip?.currency, true)}/night` : ""}</span>}
          {costed && costed.status !== "none" && <PayStatus thing={costed} />}
          {dirs && <a className="chip chip-2" href={dirs} target="_blank" rel="noopener noreferrer"><MapPin size={11} /> Map</a>}
          {s.phone && <a className="chip chip-2" href={`tel:${s.phone}`}><Phone size={11} /> Call</a>}
          {s.url && <a className="chip chip-2" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={11} /> {hostname(s.url)}</a>}
          {s.guests.length > 0 && (
            <span className="avatar-stack" style={{ marginLeft: "auto" }}>
              {s.guests.map((g) => <Avatar key={g} name={nameOf(g)} color={colorOf(g)} size={22} />)}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------- panel

function StayPanel({ open, onClose, onEdit }: { open: Open; onClose: () => void; onEdit: (s: Stay) => void }) {
  const { canEdit, rows, remove } = useTrip();
  const live = open && open.stay !== "new" ? rows.stays.find((s) => s.id === (open.stay as Stay).id) ?? null : null;
  const editing = !!open && (open.edit || open.stay === "new");
  return (
    <Modal
      open={!!open && (open.stay === "new" || !!live)}
      onClose={onClose}
      variant="panel"
      title={open?.stay === "new" ? "Add a place to stay" : live?.name ?? ""}
      actions={!editing && live && canEdit ? <button className="btn btn-sm" onClick={() => onEdit(live)}><Pencil size={14} /> Edit</button> : undefined}
      footer={
        editing && canEdit ? (
          <>
            {live && (
              <button className="btn btn-danger" type="button" onClick={async () => { if (confirm("Delete this stay?")) { await remove("stays", live.id); onClose(); } }}>
                <Trash2 size={15} /> Delete
              </button>
            )}
            <span className="spacer" />
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" form="stay-form">{live ? "Save" : "Add stay"}</button>
          </>
        ) : undefined
      }
    >
      {editing ? <StayForm key={live?.id ?? "new"} stay={live} init={open?.init} onDone={onClose} /> : live ? <StayDetails stay={live} /> : null}
    </Modal>
  );
}

function StayDetails({ stay: s }: { stay: Stay }) {
  const { trip, nameOf, colorOf, canEdit } = useTrip();
  const travel = useTravel();
  const money = useMoney();
  const toast = useToast();
  const book = useBookStay();
  const kind = stayKindOf(s.kind);
  const nights = stayNights(s);
  const total = s.status === "idea" ? travel.stayTotal(s) : money.byKey[`stay:${s.id}`]?.total ?? null;
  const inLeg = travel.stayLegFromAirport(s);
  const outLeg = travel.stayLegToAirport(s);
  const near = travel.plansNear(s);
  const fit = travel.fitOf(s.id);
  const dirs = mapsLink(s.location, s.address || s.name);
  const others = travel.stayGroups.find((g) => g.key === stayOptionKey(s))?.options.filter((o) => o.id !== s.id) ?? [];

  return (
    <div className="detail">
      <div className="detail-hero">
        <span className="cat-dot" style={{ width: 48, height: 48, fontSize: 24 }}>{kind.emoji}</span>
        <div style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className={s.status === "booked" ? "chip chip-ok" : s.status === "idea" ? "chip chip-2" : "chip chip-muted"}>{s.status === "booked" ? "Booked" : s.status === "idea" ? "Option" : "Not chosen"}</span>
            {fit?.best && <span className="chip chip-ok"><Sparkles size={11} /> Best fit</span>}
          </div>
          <span className="small muted">{kind.label}{s.address && ` · ${s.address}`}</span>
        </div>
      </div>
      <div className="detail-grid">
        <div><small>Check in</small>{formatDay(s.check_in) || "—"}{s.check_in_time && ` · ${formatTime(s.check_in_time)}`}</div>
        <div><small>Check out</small>{formatDay(s.check_out) || "—"}{s.check_out_time && ` · ${formatTime(s.check_out_time)}`}</div>
        <div><small>{s.status === "idea" ? "Estimated price" : "Price"}</small>{total != null ? <>{s.status === "idea" && "≈ "}{formatMoney(total, trip?.currency)}{nights ? <span className="tiny muted"> · {formatMoney(total / nights, trip?.currency)}/night</span> : null}</> : "—"}</div>
        <div>
          <small>Confirmation</small>
          {s.confirmation ? <button className="link-btn" onClick={() => { void navigator.clipboard?.writeText(s.confirmation); toast.success("Copied"); }}>{s.confirmation} <Copy size={11} /></button> : "—"}
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {dirs && <a className="chip chip-2" href={dirs} target="_blank" rel="noopener noreferrer"><MapPin size={11} /> Map</a>}
        {s.phone && <a className="chip chip-2" href={`tel:${s.phone}`}><Phone size={11} /> Call</a>}
        {s.url && <a className="chip chip-2" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={11} /> {hostname(s.url)}</a>}
      </div>
      {s.status === "idea" && canEdit && (
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => void book(s, others)}><Check size={15} /> Book this one</button>
      )}
      {(inLeg || outLeg) && (
        <div className="detail-section">
          <h3>Airport</h3>
          {inLeg && (
            <a className="dist-row" href={inLeg.href} target="_blank" rel="noopener noreferrer">
              <Plane size={16} />
              <span className="grow"><strong className="small">From {inLeg.airport.code} ({inLeg.airport.city})</strong><span className="tiny muted" style={{ display: "block" }}>{inLeg.label}</span></span>
              <span className="tiny">Directions</span>
            </a>
          )}
          {outLeg && (
            <a className="dist-row" href={outLeg.href} target="_blank" rel="noopener noreferrer">
              <Plane size={16} />
              <span className="grow"><strong className="small">To {outLeg.airport.code} for your flight out</strong><span className="tiny muted" style={{ display: "block" }}>{outLeg.label}</span></span>
              <span className="tiny">Directions</span>
            </a>
          )}
        </div>
      )}
      {near.length > 0 && (
        <div className="detail-section">
          <h3>Your plans from here</h3>
          {near.map((n) => (
            <a key={n.item.id} className="dist-row" href={n.href} target="_blank" rel="noopener noreferrer">
              <MapPin size={16} />
              <span className="grow"><strong className="small truncate" style={{ display: "block" }}>{n.item.title}</strong><span className="tiny muted">{formatDay(n.item.day)} · {n.label}</span></span>
              <span className="tiny">Go</span>
            </a>
          ))}
        </div>
      )}
      {s.guests.length > 0 && (
        <div className="detail-section">
          <h3>Who&apos;s staying</h3>
          <div className="row wrap" style={{ gap: 8 }}>
            {s.guests.map((id) => <span key={id} className="row small" style={{ gap: 5 }}><Avatar name={nameOf(id)} color={colorOf(id)} size={22} /> {nameOf(id)}</span>)}
          </div>
        </div>
      )}
      {s.notes && <div className="detail-section"><h3>Notes</h3><p className="detail-notes small">{s.notes}</p></div>}
      {s.status === "booked" && <PaymentPanel type="stay" id={s.id} category="lodging" />}
      <div className="detail-section">
        <h3>Comments</h3>
        <CommentThread entity="stay" id={s.id} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- form

function StayForm({ stay: existing, init, onDone }: { stay: Stay | null; init?: Partial<Stay>; onDone: () => void }) {
  const { insert, update, rows, nameOf, colorOf, trip, goingIds, householdOf } = useTrip();
  const [form, setForm] = useState(() => ({
    name: existing?.name ?? "",
    kind: (existing?.kind ?? "hotel") as StayKind,
    address: existing?.address ?? "",
    location: (existing?.location ?? {}) as Place,
    check_in: existing?.check_in ?? trip?.start_date ?? "",
    check_out: existing?.check_out ?? trip?.end_date ?? "",
    check_in_time: existing?.check_in_time?.slice(0, 5) ?? "",
    check_out_time: existing?.check_out_time?.slice(0, 5) ?? "",
    confirmation: existing?.confirmation ?? "",
    url: existing?.url ?? "",
    phone: existing?.phone ?? "",
    status: (existing?.status ?? init?.status ?? "booked") as BookingStatus,
    option_group: existing?.option_group ?? "",
    guests: existing?.guests ?? rows.trip_members.filter((m) => m.attendance !== "not_going").map((m) => m.user_id),
    cost: costValueFrom(existing?.cost ?? null, existing ?? null, "night") as CostValue,
    notes: existing?.notes ?? "",
  }));
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const near = trip?.lat != null && trip?.lng != null ? { lat: trip.lat, lng: trip.lng } : null;
  const groups = [...new Set(rows.stays.map((s) => s.option_group).filter(Boolean))] as string[];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.check_in && form.check_out && form.check_out < form.check_in) return;
    const row = {
      name: form.name.trim(),
      kind: form.kind,
      address: form.address.trim() || form.location.address || "",
      location: form.location,
      check_in: form.check_in || null,
      check_out: form.check_out || null,
      check_in_time: form.check_in_time ? `${form.check_in_time}:00` : null,
      check_out_time: form.check_out_time ? `${form.check_out_time}:00` : null,
      confirmation: form.confirmation.trim(),
      url: normalizeUrl(form.url),
      phone: form.phone.trim(),
      status: form.status,
      option_group: form.option_group.trim(),
      guests: form.guests,
      ...costColumns(form.cost),
      notes: form.notes,
    };
    const ok = existing ? await update("stays", existing.id, row) : !!(await insert("stays", row));
    if (ok) onDone();
  }

  return (
    <form id="stay-form" className="form-grid" onSubmit={save}>
      <Field label="Status" full>
        <Segmented<BookingStatus> value={form.status} onChange={(v) => set("status", v)} options={[{ value: "idea", label: "Option" }, { value: "booked", label: "Booked" }, { value: "cancelled", label: "Not chosen" }]} />
      </Field>
      <Field label="Name" full><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="The Hawthorne Hotel" required /></Field>
      <Field label="Type">
        <select className="input" value={form.kind} onChange={(e) => set("kind", e.target.value as StayKind)}>
          {STAY_KINDS.map((k) => <option key={k.id} value={k.id}>{k.emoji} {k.label}</option>)}
        </select>
      </Field>
      <Field label="Find on the map" hint="Needed for distances to the airport and your plans." full>
        <PlaceSearch value={form.location} onChange={(p) => setForm((f) => ({ ...f, location: p, address: p.address ?? f.address }))} near={near} placeholder="Search the hotel or address" />
      </Field>
      <Field label="Address" full><input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
      <Field label="Check in"><input className="input" type="date" value={form.check_in} onChange={(e) => set("check_in", e.target.value)} /></Field>
      <Field label="Check out"><input className="input" type="date" min={form.check_in || undefined} value={form.check_out} onChange={(e) => set("check_out", e.target.value)} /></Field>
      {form.status !== "idea" && (
        <>
          <Field label="Check-in time"><input className="input" type="time" value={form.check_in_time} onChange={(e) => set("check_in_time", e.target.value)} /></Field>
          <Field label="Check-out time"><input className="input" type="time" value={form.check_out_time} onChange={(e) => set("check_out_time", e.target.value)} /></Field>
          <Field label="Confirmation"><input className="input" value={form.confirmation} onChange={(e) => set("confirmation", e.target.value)} /></Field>
        </>
      )}
      <Field label="Phone"><input className="input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      <Field label="Link" full><input className="input" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="Airbnb, Booking.com, hotel site…" /></Field>
      <Field label="Compare with" hint="Options with the same name are compared, and only the cheapest counts toward the budget. Leave empty to compare stays with the same dates." full>
        <input className="input" list="stay-groups" value={form.option_group} onChange={(e) => set("option_group", e.target.value)} placeholder="e.g. Salem week, Boston nights" maxLength={80} />
        <datalist id="stay-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      </Field>
      <Field label="Who's staying" full>
        <PersonPicker people={rows.trip_members.map((m) => m.user_id)} value={form.guests} onChange={(v) => set("guests", v)} nameOf={nameOf} colorOf={colorOf} />
      </Field>
      <CostEditor
        value={form.cost}
        onChange={(v) => set("cost", v)}
        participants={participantsForStay(form, goingIds)}
        currency={trip?.currency ?? "USD"}
        householdOf={householdOf}
        nights={stayNights(form)}
        label={form.status === "idea" ? "Rough price" : "Price"}
      />
      <Field label="Notes" full><textarea className="input textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Door code, parking, Wi-Fi password…" /></Field>
    </form>
  );
}
