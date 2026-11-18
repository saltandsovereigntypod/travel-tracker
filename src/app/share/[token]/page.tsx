"use client";

import { use, useEffect, useState } from "react";
import { Loader2, MapPin, CalendarDays, Route, BedDouble } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { categoryOf, stayKindOf } from "@/lib/categories";
import { formatDay, formatDayLong, formatRange, formatTime, splitLocal, tripDays } from "@/lib/format";
import type { Place } from "@/lib/types";
import { modeOf, routeText, viaText } from "@/lib/transport";

interface Shared {
  trip: { name: string; destination: string; description: string; start_date: string | null; end_date: string | null; cover_image: string | null };
  travelers: { name: string; color: string }[];
  itinerary: { day: string; start_time: string | null; end_time: string | null; title: string; category: string; location: Place }[];
  stays: { name: string; kind: string; address: string; check_in: string | null; check_out: string | null }[];
  flights: { mode?: string; airline: string; flight_number: string; from_code: string; from_name?: string; to_code: string; to_name?: string; depart_local: string | null; arrive_local: string | null; stops?: { name: string; code?: string | null }[] }[];
}

/** Public, read-only itinerary. No account needed. Leaves out codes, costs and private things. */
export default function SharedTrip({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Shared | null | undefined>(undefined);

  useEffect(() => {
    supabase()
      .rpc("get_shared_trip", { p_token: token })
      .then(({ data: d }) => setData((d as Shared) ?? null));
  }, [token]);

  if (data === undefined) return <div className="auth-wrap"><Loader2 className="spin" /></div>;
  if (!data) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: "center", padding: "2rem" }}>
          <h1>Link not available</h1>
          <p className="muted" style={{ marginTop: 8 }}>This share link was turned off or doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  const { trip } = data;
  const days = tripDays(trip.start_date, trip.end_date);
  const dayList = days.length ? days : [...new Set(data.itinerary.map((i) => i.day))].sort();

  return (
    <div className="landing" style={{ maxWidth: 860 }}>
      <header className="card hero-block" style={{ padding: "2rem", ...(trip.cover_image ? { backgroundImage: `url("${trip.cover_image}")`, color: "#fff" } : { background: "linear-gradient(135deg, var(--soft2), var(--soft))" }) }}>
        <p className="day-num" style={trip.cover_image ? { color: "#fff" } : undefined}>Shared itinerary</p>
        <h1>{trip.name}</h1>
        <div className="row wrap" style={{ gap: "1rem", marginTop: 8 }}>
          {trip.destination && <span className="row"><MapPin size={16} /> {trip.destination}</span>}
          <span className="row"><CalendarDays size={16} /> {formatRange(trip.start_date, trip.end_date)}</span>
        </div>
        {data.travelers.length > 0 && <p style={{ marginTop: 8 }}>With {data.travelers.map((t) => t.name).join(", ")}</p>}
      </header>

      {(data.flights.length > 0 || data.stays.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          {data.flights.length > 0 && (
            <div className="card">
              <h3 className="row" style={{ marginBottom: 8 }}><Route size={18} /> Getting around</h3>
              {data.flights.map((f, i) => {
                const d = splitLocal(f.depart_local);
                const a = splitLocal(f.arrive_local);
                return (
                  <p key={i} className="small" style={{ marginBottom: 6 }}>
                    <strong>{modeOf(f).emoji} {routeText({ from_name: "", to_name: "", ...f }) || modeOf(f).label}</strong>{f.airline && <> · {[f.airline, f.flight_number].filter(Boolean).join(" ")}</>}
                    {f.stops?.length ? <span className="muted"> · {viaText({ stops: f.stops.map((x, j) => ({ id: String(j), name: x.name ?? "", code: x.code ?? "" })) })}</span> : null}<br />
                    <span className="muted">{formatDay(d.day)} {formatTime(d.time)} → {formatTime(a.time)}</span>
                  </p>
                );
              })}
            </div>
          )}
          {data.stays.length > 0 && (
            <div className="card">
              <h3 className="row" style={{ marginBottom: 8 }}><BedDouble size={18} /> Staying at</h3>
              {data.stays.map((s, i) => (
                <p key={i} className="small" style={{ marginBottom: 6 }}>
                  <strong>{stayKindOf(s.kind).emoji} {s.name}</strong><br />
                  <span className="muted">{formatDay(s.check_in)} – {formatDay(s.check_out)}{s.address && ` · ${s.address}`}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="stack" style={{ marginTop: "1rem" }}>
        {dayList.map((d, idx) => {
          const items = data.itinerary.filter((i) => i.day === d);
          return (
            <section key={d} className="card">
              <div className="day-num">Day {idx + 1}</div>
              <h3 style={{ marginBottom: 8 }}>{formatDayLong(d)}</h3>
              {items.length === 0 ? (
                <p className="muted small">Free day</p>
              ) : (
                items.map((i, k) => (
                  <div key={k} className="row small" style={{ padding: "0.35rem 0", alignItems: "flex-start" }}>
                    <span className="itin-time">{i.start_time ? formatTime(i.start_time) : ""}</span>
                    <span>{categoryOf(i.category).emoji}</span>
                    <span className="grow"><strong>{i.title}</strong>{i.location?.name && <span className="muted"> · {i.location.name}</span>}</span>
                  </div>
                ))
              )}
            </section>
          );
        })}
      </div>
      <p className="tiny muted" style={{ textAlign: "center", marginTop: "2rem" }}>Made with Driftbook</p>
    </div>
  );
}
