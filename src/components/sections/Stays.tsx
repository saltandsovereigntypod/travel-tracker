"use client";

import { useState } from "react";
import Link from "next/link";
import { BedDouble, Plus, Trash2, MapPin, Phone, ExternalLink, Copy, Moon } from "lucide-react";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Modal } from "../ui/Modal";
import { Avatar, EmptyState, Field, PersonPicker, PlaceSearch, Segmented } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { CommentThread } from "./Comments";
import { CostEditor, costColumns, costValueFrom, type CostValue } from "../ui/CostEditor";
import { PaymentPanel, PayStatus } from "./Payments";
import { participantsForStay, stayNights, useMoney } from "./money";
import { STAY_KINDS, stayKindOf } from "@/lib/categories";
import { daysBetween, formatDay, formatMoney, formatTime, normalizeUrl, hostname } from "@/lib/format";
import { mapsLink } from "@/lib/services";
import type { BookingStatus, Place, Stay, StayKind } from "@/lib/types";

export function StaysSection({ compact = false }: { compact?: boolean }) {
  const { rows, canEdit, tripId } = useTrip();
  const [editing, setEditing] = useState<Stay | "new" | null>(null);
  const stays = [...rows.stays].sort((a, b) => (a.check_in ?? "9999").localeCompare(b.check_in ?? "9999"));
  const shown = compact ? stays.filter((s) => s.status !== "cancelled").slice(0, 3) : stays;
  const totalNights = stays.filter((s) => s.status === "booked" && s.check_in && s.check_out).reduce((n, s) => n + daysBetween(s.check_in!, s.check_out!), 0);

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <ModuleTitle id="stays" fallback="Stays" />
            <p>Hotels, hostels, rentals and couches. {totalNights > 0 && `${totalNights} night${totalNights === 1 ? "" : "s"} booked.`}</p>
          </div>
          {canEdit && <button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add stay</button>}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState icon={<BedDouble />} title="No stays yet" action={canEdit && <button className="btn btn-sm" onClick={() => setEditing("new")}><Plus size={14} /> Add a place to stay</button>}>
          Add options you&apos;re comparing too, then mark the winner as booked.
        </EmptyState>
      ) : (
        <div className={compact ? "stack" : "grid-cards"} style={compact ? undefined : { gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {shown.map((s) => <StayCard key={s.id} stay={s} compact={compact} onOpen={() => setEditing(s)} />)}
        </div>
      )}
      {compact && stays.length > shown.length && (
        <Link className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} href={`/trips/${tripId}/stays`}>All stays →</Link>
      )}
      <StayModal stay={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function StayCard({ stay: s, compact, onOpen }: { stay: Stay; compact?: boolean; onOpen: () => void }) {
  const { trip, nameOf, colorOf } = useTrip();
  const toast = useToast();
  const kind = stayKindOf(s.kind);
  const money = useMoney();
  const costed = money.byKey[`stay:${s.id}`];
  const nights = s.check_in && s.check_out ? daysBetween(s.check_in, s.check_out) : null;
  const dirs = mapsLink(s.location, s.address || s.name);
  return (
    <article className="card card-hover" style={{ cursor: "pointer", opacity: s.status === "cancelled" ? 0.5 : 1 }} onClick={onOpen}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <span className="cat-dot" style={{ width: 42, height: 42, fontSize: 20 }}>{kind.emoji}</span>
        <div className="grow">
          <div className="row-between">
            <h3 className="truncate">{s.name}</h3>
            {s.status === "idea" && <span className="chip chip-2">Option</span>}
            {s.status === "cancelled" && <span className="chip chip-muted">Cancelled</span>}
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
      {!compact && (
        <div className="row wrap" style={{ marginTop: "0.9rem", gap: "0.4rem" }} onClick={(e) => e.stopPropagation()}>
          {s.confirmation && (
            <button className="chip chip-muted" style={{ cursor: "pointer", border: 0 }} onClick={() => { void navigator.clipboard?.writeText(s.confirmation); toast.success("Confirmation copied"); }}>
              <Copy size={11} /> {s.confirmation}
            </button>
          )}
          {costed?.total != null && <span className="chip chip-muted">{formatMoney(costed.total, trip?.currency)}{nights ? ` · ${formatMoney(costed.total / Math.max(nights, 1), trip?.currency, true)}/night` : ""}</span>}
          {costed && costed.status !== "none" && <PayStatus thing={costed} />}
          {dirs && <a className="chip chip-2" href={dirs} target="_blank" rel="noopener noreferrer"><MapPin size={11} /> Directions</a>}
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

const blank = {
  name: "", kind: "hotel" as StayKind, address: "", location: {} as Place, check_in: "", check_out: "",
  check_in_time: "", check_out_time: "", confirmation: "", url: "", phone: "", status: "booked" as BookingStatus,
  guests: [] as string[], cost: costValueFrom(null, null, "night") as CostValue, notes: "",
};

function StayModal({ stay, onClose }: { stay: Stay | "new" | null; onClose: () => void }) {
  const { insert, update, remove, canEdit, rows, nameOf, colorOf, trip, goingIds, householdOf } = useTrip();
  const existing = stay && stay !== "new" ? stay : null;
  const [form, setForm] = useState(blank);
  const [loadedFor, setLoadedFor] = useState<unknown>(null);
  if (stay !== loadedFor) {
    setLoadedFor(stay);
    setForm(
      existing
        ? {
            ...blank,
            ...existing,
            check_in: existing.check_in ?? "",
            check_out: existing.check_out ?? "",
            check_in_time: existing.check_in_time?.slice(0, 5) ?? "",
            check_out_time: existing.check_out_time?.slice(0, 5) ?? "",
            url: existing.url ?? "",
            cost: costValueFrom(existing.cost, existing),
          }
        : { ...blank, check_in: trip?.start_date ?? "", check_out: trip?.end_date ?? "", guests: rows.trip_members.filter((m) => m.attendance !== "not_going").map((m) => m.user_id) },
    );
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const near = trip?.lat != null && trip?.lng != null ? { lat: trip.lat, lng: trip.lng } : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
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
      guests: form.guests,
      ...costColumns(form.cost),
      notes: form.notes,
    };
    const ok = existing ? await update("stays", existing.id, row) : !!(await insert("stays", row));
    if (ok) onClose();
  }

  return (
    <Modal
      open={!!stay}
      onClose={onClose}
      title={existing ? existing.name : "Add a place to stay"}
      size="lg"
      footer={
        canEdit && (
          <>
            {existing && (
              <button className="btn btn-danger" type="button" onClick={async () => { if (confirm("Delete this stay?")) { await remove("stays", existing.id); onClose(); } }}>
                <Trash2 size={15} /> Delete
              </button>
            )}
            <span className="spacer" />
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" form="stay-form" disabled={!form.name.trim()}>{existing ? "Save" : "Add stay"}</button>
          </>
        )
      }
    >
      <form id="stay-form" className="form-grid" onSubmit={save}>
        <fieldset disabled={!canEdit} style={{ display: "contents" }}>
          <Field label="Status" full>
            <Segmented<BookingStatus> value={form.status} onChange={(v) => set("status", v)} options={[{ value: "idea", label: "Option" }, { value: "booked", label: "Booked" }, { value: "cancelled", label: "Cancelled" }]} />
          </Field>
          <Field label="Name" full><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="The Hawthorne Hotel" required /></Field>
          <Field label="Type">
            <select className="input" value={form.kind} onChange={(e) => set("kind", e.target.value as StayKind)}>
              {STAY_KINDS.map((k) => <option key={k.id} value={k.id}>{k.emoji} {k.label}</option>)}
            </select>
          </Field>

          <Field label="Find on the map" full>
            <PlaceSearch value={form.location} onChange={(p) => setForm((f) => ({ ...f, location: p, address: p.address ?? f.address }))} near={near} placeholder="Search the hotel or address" />
          </Field>
          <Field label="Address" full><input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Check in"><input className="input" type="date" value={form.check_in} onChange={(e) => set("check_in", e.target.value)} /></Field>
          <Field label="Check out"><input className="input" type="date" min={form.check_in || undefined} value={form.check_out} onChange={(e) => set("check_out", e.target.value)} /></Field>
          <Field label="Check-in time"><input className="input" type="time" value={form.check_in_time} onChange={(e) => set("check_in_time", e.target.value)} /></Field>
          <Field label="Check-out time"><input className="input" type="time" value={form.check_out_time} onChange={(e) => set("check_out_time", e.target.value)} /></Field>
          <Field label="Confirmation"><input className="input" value={form.confirmation} onChange={(e) => set("confirmation", e.target.value)} /></Field>
          <Field label="Phone"><input className="input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Booking link" full><input className="input" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="Airbnb, Booking.com, hotel site…" /></Field>
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
            label="Price"
          />
          <Field label="Notes" full><textarea className="input textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Door code, parking, Wi-Fi password…" /></Field>
        </fieldset>
      </form>
      {existing && existing.status === "booked" && (
        <div style={{ marginTop: "1.2rem" }}>
          <PaymentPanel type="stay" id={existing.id} category="lodging" />
        </div>
      )}
      {existing && (
        <div style={{ marginTop: "1.2rem" }}>
          <h3 style={{ marginBottom: "0.6rem" }}>Comments</h3>
          <CommentThread entity="stay" id={existing.id} />
        </div>
      )}
    </Modal>
  );
}
