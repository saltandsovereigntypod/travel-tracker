"use client";

import { useState } from "react";
import Link from "next/link";
import { Plane, Plus, Trash2, Copy } from "lucide-react";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Modal } from "../ui/Modal";
import { Avatar, EmptyState, Field, PersonPicker, Segmented } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { CommentThread } from "./Comments";
import { CostEditor, costColumns, costValueFrom, type CostValue } from "../ui/CostEditor";
import { PaymentPanel, PayStatus } from "./Payments";
import { participantsForFlight, useMoney } from "./money";
import { formatDay, formatMoney, formatTime, splitLocal } from "@/lib/format";
import type { BookingStatus, Flight } from "@/lib/types";

function duration(dep: string | null, arr: string | null): string {
  // Local times at two airports can't give true duration without time zones,
  // so only show it when both are on the same day-ish and arrival is later.
  if (!dep || !arr) return "";
  const a = new Date(dep).getTime();
  const b = new Date(arr).getTime();
  if (!(b > a) || b - a > 30 * 3600_000) return "";
  const mins = Math.round((b - a) / 60000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m (local times)`;
}

export function FlightsSection({ compact = false }: { compact?: boolean }) {
  const { rows, canEdit, tripId } = useTrip();
  const [editing, setEditing] = useState<Flight | "new" | null>(null);
  const flights = [...rows.flights].sort((a, b) => (a.depart_local ?? "9999").localeCompare(b.depart_local ?? "9999"));
  const shown = compact ? flights.filter((f) => f.status !== "cancelled").slice(0, 3) : flights;

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <ModuleTitle id="flights" fallback="Flights" />
            <p>Who&apos;s flying when, with confirmation codes in one place.</p>
          </div>
          {canEdit && <button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add flight</button>}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState icon={<Plane />} title="No flights yet" action={canEdit && <button className="btn btn-sm" onClick={() => setEditing("new")}><Plus size={14} /> Add a flight</button>}>
          Add ones you&apos;re considering too. Mark them as &quot;idea&quot; until booked.
        </EmptyState>
      ) : (
        <div className="stack">
          {shown.map((f) => <BoardingPass key={f.id} flight={f} compact={compact} onOpen={() => setEditing(f)} />)}
        </div>
      )}
      {compact && flights.length > shown.length && (
        <Link className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} href={`/trips/${tripId}/flights`}>All flights →</Link>
      )}
      <FlightModal flight={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function BoardingPass({ flight: f, compact, onOpen }: { flight: Flight; compact?: boolean; onOpen: () => void }) {
  const { nameOf, colorOf, trip } = useTrip();
  const toast = useToast();
  const dep = splitLocal(f.depart_local);
  const arr = splitLocal(f.arrive_local);
  return (
    <article className="card pass card-hover" style={{ cursor: "pointer", opacity: f.status === "cancelled" ? 0.5 : 1 }} onClick={onOpen}>
      <div className="pass-main">
        <div className="row-between">
          <span className="tiny muted" style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {[f.airline, f.flight_number].filter(Boolean).join(" · ") || "Flight"}
          </span>
          {f.status === "idea" && <span className="chip chip-2">Not booked</span>}
          {f.status === "cancelled" && <span className="chip chip-muted">Cancelled</span>}
        </div>
        <div className="pass-route">
          <div>
            <div className="pass-code">{f.from_code || "—"}</div>
            <div className="tiny muted truncate" style={{ maxWidth: 120 }}>{f.from_name}</div>
          </div>
          <div className="pass-line"><Plane size={18} /></div>
          <div style={{ textAlign: "right" }}>
            <div className="pass-code">{f.to_code || "—"}</div>
            <div className="tiny muted truncate" style={{ maxWidth: 120 }}>{f.to_name}</div>
          </div>
        </div>
        <div className="row-between small">
          <div>
            <strong>{formatTime(dep.time) || "—"}</strong>
            <div className="tiny muted">{formatDay(dep.day)}</div>
          </div>
          <span className="tiny muted hide-sm">{duration(f.depart_local, f.arrive_local)}</span>
          <div style={{ textAlign: "right" }}>
            <strong>{formatTime(arr.time) || "—"}</strong>
            <div className="tiny muted">{formatDay(arr.day)}</div>
          </div>
        </div>
        {!compact && f.travelers.length > 0 && (
          <div className="row">
            <div className="avatar-stack">
              {f.travelers.map((id) => <Avatar key={id} name={nameOf(id)} color={colorOf(id)} size={24} />)}
            </div>
            <span className="tiny muted">{f.travelers.map(nameOf).join(", ")}</span>
          </div>
        )}
      </div>
      <div className="pass-stub">
        <span className="tiny muted">Confirmation</span>
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
        )}
        {f.seats && <span className="tiny">Seats {f.seats}</span>}
        <FlightMoney flight={f} />
      </div>
    </article>
  );
}

function FlightMoney({ flight: f }: { flight: Flight }) {
  const { trip } = useTrip();
  const money = useMoney();
  const c = money.byKey[`flight:${f.id}`];
  if (!c?.total && !c?.paid) return null;
  return (
    <>
      {c.total != null && <span className="tiny muted">{formatMoney(c.total, trip?.currency)}</span>}
      <PayStatus thing={c} />
    </>
  );
}

const blank = {
  airline: "", flight_number: "", from_code: "", from_name: "", to_code: "", to_name: "",
  depart_local: "", arrive_local: "", confirmation: "", seats: "", status: "booked" as BookingStatus,
  travelers: [] as string[], cost: costValueFrom(null, null, "person") as CostValue, notes: "",
};

function FlightModal({ flight, onClose }: { flight: Flight | "new" | null; onClose: () => void }) {
  const { insert, update, remove, canEdit, rows, nameOf, colorOf, trip, me, goingIds, householdOf } = useTrip();
  const existing = flight && flight !== "new" ? flight : null;
  const [form, setForm] = useState(blank);
  const [loadedFor, setLoadedFor] = useState<unknown>(null);
  if (flight !== loadedFor) {
    setLoadedFor(flight);
    setForm(
      existing
        ? {
            ...blank,
            ...existing,
            depart_local: existing.depart_local?.slice(0, 16) ?? "",
            arrive_local: existing.arrive_local?.slice(0, 16) ?? "",
            cost: costValueFrom(existing.cost, existing),
          }
        : { ...blank, travelers: me ? [me] : [] },
    );
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const people = rows.trip_members.map((m) => m.user_id);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = {
      airline: form.airline.trim(),
      flight_number: form.flight_number.trim().toUpperCase(),
      from_code: form.from_code.trim().toUpperCase(),
      from_name: form.from_name.trim(),
      to_code: form.to_code.trim().toUpperCase(),
      to_name: form.to_name.trim(),
      depart_local: form.depart_local || null,
      arrive_local: form.arrive_local || null,
      confirmation: form.confirmation.trim().toUpperCase(),
      seats: form.seats.trim(),
      status: form.status,
      travelers: form.travelers,
      ...costColumns(form.cost),
      notes: form.notes,
    };
    const ok = existing ? await update("flights", existing.id, row) : !!(await insert("flights", row));
    if (ok) onClose();
  }

  return (
    <Modal
      open={!!flight}
      onClose={onClose}
      title={existing ? "Flight details" : "Add a flight"}
      size="lg"
      footer={
        canEdit && (
          <>
            {existing && (
              <button className="btn btn-danger" type="button" onClick={async () => { if (confirm("Delete this flight?")) { await remove("flights", existing.id); onClose(); } }}>
                <Trash2 size={15} /> Delete
              </button>
            )}
            <span className="spacer" />
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" form="flight-form">{existing ? "Save" : "Add flight"}</button>
          </>
        )
      }
    >
      <form id="flight-form" className="form-grid" onSubmit={save}>
        <fieldset disabled={!canEdit} style={{ display: "contents" }}>
          <Field label="Status" full>
            <Segmented<BookingStatus> value={form.status} onChange={(v) => set("status", v)} options={[{ value: "idea", label: "Considering" }, { value: "booked", label: "Booked" }, { value: "cancelled", label: "Cancelled" }]} />
          </Field>
          <Field label="Airline"><input className="input" value={form.airline} onChange={(e) => set("airline", e.target.value)} placeholder="JetBlue" /></Field>
          <Field label="Flight number"><input className="input" value={form.flight_number} onChange={(e) => set("flight_number", e.target.value)} placeholder="B6 1234" /></Field>
          <Field label="From (airport code)"><input className="input" value={form.from_code} onChange={(e) => set("from_code", e.target.value)} placeholder="LAX" maxLength={4} /></Field>
          <Field label="From (city)"><input className="input" value={form.from_name} onChange={(e) => set("from_name", e.target.value)} placeholder="Los Angeles" /></Field>
          <Field label="To (airport code)"><input className="input" value={form.to_code} onChange={(e) => set("to_code", e.target.value)} placeholder="BOS" maxLength={4} /></Field>
          <Field label="To (city)"><input className="input" value={form.to_name} onChange={(e) => set("to_name", e.target.value)} placeholder="Boston" /></Field>
          <Field label="Departs (local time)"><input className="input" type="datetime-local" value={form.depart_local} onChange={(e) => set("depart_local", e.target.value)} /></Field>
          <Field label="Arrives (local time)"><input className="input" type="datetime-local" value={form.arrive_local} onChange={(e) => set("arrive_local", e.target.value)} /></Field>
          <Field label="Confirmation code"><input className="input" value={form.confirmation} onChange={(e) => set("confirmation", e.target.value)} placeholder="ABC123" /></Field>
          <Field label="Seats"><input className="input" value={form.seats} onChange={(e) => set("seats", e.target.value)} placeholder="14A, 14B" /></Field>
          <Field label="Who's on this flight" full>
            <PersonPicker people={people} value={form.travelers} onChange={(v) => set("travelers", v)} nameOf={nameOf} colorOf={colorOf} />
          </Field>
          <CostEditor value={form.cost} onChange={(v) => set("cost", v)} participants={participantsForFlight(form, goingIds)} currency={trip?.currency ?? "USD"} householdOf={householdOf} label="Ticket price" />
          <Field label="Notes" full><textarea className="input textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Baggage, terminal, layover…" /></Field>
        </fieldset>
      </form>
      {existing && existing.status === "booked" && (
        <div style={{ marginTop: "1.2rem" }}>
          <PaymentPanel type="flight" id={existing.id} category="flights" />
        </div>
      )}
      {existing && (
        <div style={{ marginTop: "1.2rem" }}>
          <h3 style={{ marginBottom: "0.6rem" }}>Comments</h3>
          <CommentThread entity="flight" id={existing.id} />
        </div>
      )}
    </Modal>
  );
}
