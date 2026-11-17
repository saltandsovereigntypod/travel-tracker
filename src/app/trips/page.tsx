"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, CalendarDays, MapPin, Loader2 } from "lucide-react";
import { RequireAuth, TopBar } from "@/components/AppChrome";
import { useAuth } from "@/components/AuthProvider";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, Field } from "@/components/ui/Fields";
import { useToast } from "@/components/ui/Toast";
import { friendlyError, supabase } from "@/lib/supabase";
import { countdown, formatRange } from "@/lib/format";
import { CURRENCIES, searchPlaces } from "@/lib/services";
import type { Member, Trip } from "@/lib/types";

type TripWithRole = Trip & { role: Member["role"]; attendance: Member["attendance"] };

function TripsInner() {
  const { user, profile } = useAuth();
  const [trips, setTrips] = useState<TripWithRole[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase()
      .from("trip_members")
      .select("role, attendance, trips(*)")
      .eq("user_id", user!.id);
    if (error) {
      setTrips([]);
      return;
    }
    const list = (data as unknown as { role: Member["role"]; attendance: Member["attendance"]; trips: Trip }[])
      .filter((r) => r.trips)
      .map((r) => ({ ...r.trips, role: r.role, attendance: r.attendance }))
      .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"));
    setTrips(list);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = trips?.filter((t) => countdown(t.start_date, t.end_date).phase !== "after") ?? [];
  const past = trips?.filter((t) => countdown(t.start_date, t.end_date).phase === "after") ?? [];

  return (
    <>
      <TopBar />
      <main className="main main-narrow">
        <div className="section-head">
          <div>
            <h1>Hi {profile?.display_name?.split(" ")[0] ?? "there"} 👋</h1>
            <p>Your trips, shared with the people you travel with.</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setCreating(true)}>
            <Plus size={18} /> New trip
          </button>
        </div>

        {trips === null ? (
          <Loader2 className="spin" />
        ) : trips.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<MapPin />}
              title="No trips yet"
              action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Plan your first trip</button>}
            >
              Create a trip, then invite your people with a link.
            </EmptyState>
          </div>
        ) : (
          <>
            <TripGrid trips={upcoming} />
            {past.length > 0 && (
              <>
                <h2 style={{ margin: "2rem 0 1rem" }}>Memories</h2>
                <TripGrid trips={past} />
              </>
            )}
          </>
        )}
      </main>
      <NewTripModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function TripGrid({ trips }: { trips: TripWithRole[] }) {
  return (
    <div className="grid-cards">
      {trips.map((t) => {
        const c = countdown(t.start_date, t.end_date);
        const label =
          c.phase === "before" ? `${c.days} day${c.days === 1 ? "" : "s"} to go` :
          c.phase === "during" ? `Day ${c.days} of ${c.total}` :
          c.phase === "after" ? "Memory" : "Dates TBD";
        return (
          <Link key={t.id} href={`/trips/${t.id}`} className="card card-hover trip-card">
            <div className="trip-cover" style={t.cover_image ? { backgroundImage: `url("${t.cover_image}")` } : undefined}>
              <span className="chip">{label}</span>
            </div>
            <div className="trip-card-body">
              <h3>{t.name}</h3>
              <span className="muted small row"><MapPin size={14} /> {t.destination || "Somewhere wonderful"}</span>
              <span className="muted small row"><CalendarDays size={14} /> {formatRange(t.start_date, t.end_date)}</span>
              <span className="row" style={{ marginTop: 4 }}>
                <span className="chip chip-muted">{t.role}</span>
                {t.attendance === "maybe" && <span className="chip chip-2">maybe going</span>}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function NewTripModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (end && start && end < start) {
      toast.error("The end date is before the start date.");
      return;
    }
    setBusy(true);
    const sb = supabase();
    const { data: id, error } = await sb.rpc("create_trip", {
      p_name: name.trim(),
      p_destination: destination.trim(),
      p_start: start || null,
      p_end: end || null,
      p_currency: currency,
    });
    if (error || !id) {
      setBusy(false);
      toast.error(friendlyError(error));
      return;
    }
    // Pin the destination on the map in the background.
    if (destination.trim()) {
      searchPlaces(destination)
        .then((r) => r[0] && sb.from("trips").update({ lat: r[0].lat, lng: r[0].lng }).eq("id", id))
        .catch(() => {});
    }
    router.push(`/trips/${id}`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Plan a new trip"
      footer={
        <>
          <button className="btn" onClick={onClose} type="button">Cancel</button>
          <button className="btn btn-primary" form="new-trip" disabled={busy || !name.trim()}>
            {busy && <Loader2 size={16} className="spin" />} Create trip
          </button>
        </>
      }
    >
      <form id="new-trip" className="form-grid" onSubmit={create}>
        <Field label="Trip name" full>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Salem Halloween 2027" required maxLength={120} />
        </Field>
        <Field label="Where to?" full>
          <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Salem, Massachusetts" />
        </Field>
        <Field label="Start date">
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="End date">
          <input className="input" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="Trip currency" hint="Budget totals use this currency.">
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </form>
    </Modal>
  );
}

export default function TripsPage() {
  return (
    <RequireAuth>
      <TripsInner />
    </RequireAuth>
  );
}
