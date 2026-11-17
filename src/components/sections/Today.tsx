"use client";

import Link from "next/link";
import { Plane, BedDouble, MapPin, Sun, Lightbulb } from "lucide-react";
import { useTrip } from "../TripProvider";
import { categoryOf } from "@/lib/categories";
import { addDays, countdown, formatDayLong, formatTime, todayString, tripDays } from "@/lib/format";
import { mapsLink } from "@/lib/services";
import { itemsForDay, useFixedEvents } from "./Itinerary";
import { useIdeaScores } from "./Ideas";

export function Countdown({ big = false }: { big?: boolean }) {
  const { trip } = useTrip();
  const c = countdown(trip?.start_date ?? null, trip?.end_date ?? null);
  const text =
    c.phase === "before" ? { n: c.days, label: `day${c.days === 1 ? "" : "s"} to go` } :
    c.phase === "during" ? { n: c.days, label: `of ${c.total} · you're there!` } :
    c.phase === "after" ? { n: "♥", label: "what a trip" } : { n: "?", label: "set your dates" };
  return (
    <div style={{ textAlign: "center" }}>
      <div className="countdown-num" style={big ? { fontSize: "5rem" } : undefined}>{text.n}</div>
      <div className="muted" style={{ fontWeight: 600 }}>{c.phase === "during" ? `Day ${c.days} ` : ""}{text.label}</div>
    </div>
  );
}

/** What's happening today during the trip, or what's coming up before it. */
export function TodaySection({ compact = false }: { compact?: boolean }) {
  const { trip, rows, tripId } = useTrip();
  const fixed = useFixedEvents();
  const scores = useIdeaScores();
  const today = todayString();
  const c = countdown(trip?.start_date ?? null, trip?.end_date ?? null);
  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null);

  const focusDay = c.phase === "during" ? today : days[0] ?? null;
  const items = focusDay ? itemsForDay(rows.itinerary_items, focusDay) : [];
  const events = focusDay ? fixed[focusDay] ?? [] : [];
  const tomorrow = c.phase === "during" ? addDays(today, 1) : null;
  const tomorrowItems = tomorrow ? itemsForDay(rows.itinerary_items, tomorrow) : [];

  const unbooked = [
    ...rows.stays.filter((s) => s.status === "idea").map((s) => `Book a stay: ${s.name}`),
    ...rows.flights.filter((f) => f.status === "idea").map((f) => `Book flight ${f.from_code || ""}→${f.to_code || ""}`),
  ];
  const topIdeas = rows.ideas
    .filter((i) => i.status === "open" || i.status === "maybe")
    .sort((a, b) => (scores[b.id]?.score ?? 0) - (scores[a.id]?.score ?? 0))
    .slice(0, 3);
  const unscheduled = itemsForDay(rows.itinerary_items, null).length;

  return (
    <div className="stack">
      {!compact && (
        <div className="section-head" style={{ marginBottom: 0 }}>
          <div>
            <h1>{c.phase === "during" ? "Today" : c.phase === "after" ? "After the trip" : "Up next"}</h1>
            <p>{c.phase === "during" ? formatDayLong(today) : "A quick look at what needs attention."}</p>
          </div>
        </div>
      )}
      {!compact && <div className="card"><Countdown big /></div>}

      {c.phase === "during" || (c.phase === "before" && c.days <= 3) ? (
        <div className={compact ? "" : "card"}>
          <h3 style={{ marginBottom: "0.6rem" }} className="row"><Sun size={16} /> {c.phase === "during" ? "Today's plan" : `First day · ${formatDayLong(focusDay)}`}</h3>
          {events.length + items.length === 0 && <p className="muted small">Nothing planned. Free day! ✨</p>}
          <div className="stack" style={{ gap: "0.4rem" }}>
            {events.map((e) => (
              <div key={e.key} className="itin-item itin-fixed">
                <span className="itin-time">{formatTime(e.time) || "—"}</span>
                {e.kind === "flight" ? <Plane size={16} /> : <BedDouble size={16} />}
                <strong className="small grow">{e.title}</strong>
              </div>
            ))}
            {items.map((i) => {
              const link = mapsLink(i.location);
              return (
                <div key={i.id} className="itin-item" style={{ cursor: "default" }}>
                  <span className="itin-time">{i.start_time ? formatTime(i.start_time) : "Any time"}</span>
                  <span className="cat-dot">{categoryOf(i.category).emoji}</span>
                  <div className="grow">
                    <strong className="small">{i.title}</strong>
                    {i.location?.name && <div className="tiny muted">{i.location.name}</div>}
                  </div>
                  {link && <a className="icon-btn" href={link} target="_blank" rel="noopener noreferrer" aria-label="Directions"><MapPin size={16} /></a>}
                </div>
              );
            })}
          </div>
          {tomorrowItems.length > 0 && (
            <p className="small muted" style={{ marginTop: "0.8rem" }}>Tomorrow: {tomorrowItems.map((i) => i.title).join(" · ")}</p>
          )}
        </div>
      ) : (
        <div className={compact ? "stack" : "card stack"} style={{ gap: "0.6rem" }}>
          {unbooked.length > 0 && (
            <div>
              <strong className="small">Still to book</strong>
              <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.1rem" }} className="small">{unbooked.slice(0, 4).map((u) => <li key={u}>{u}</li>)}</ul>
            </div>
          )}
          {topIdeas.length > 0 && (
            <div>
              <strong className="small row"><Lightbulb size={14} /> Most-wanted ideas, not scheduled yet</strong>
              <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.1rem" }} className="small">
                {topIdeas.map((i) => <li key={i.id}>{i.title} <span className="muted">({scores[i.id]?.up ?? 0} 👍)</span></li>)}
              </ul>
            </div>
          )}
          {unscheduled > 0 && <p className="small">{unscheduled} plan{unscheduled === 1 ? "" : "s"} waiting for a day.</p>}
          {!unbooked.length && !topIdeas.length && !unscheduled && <p className="small muted">All caught up. 🎉</p>}
          <Link href={`/trips/${tripId}/itinerary`} className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-start" }}>Open itinerary →</Link>
        </div>
      )}
    </div>
  );
}
