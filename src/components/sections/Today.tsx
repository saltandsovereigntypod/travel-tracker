"use client";

import Link from "next/link";
import { BedDouble, MapPin, Sun, Lightbulb } from "lucide-react";
import { useTrip } from "../TripProvider";
import { categoryOf } from "@/lib/categories";
import { assignedTo, calendarEntries, isDone } from "@/lib/fields";
import { pageTasks } from "@/lib/pages";
import { addDays, countdown, daysBetween, formatDayLong, formatTime, todayString, tripDays } from "@/lib/format";
import { mapsLink } from "@/lib/services";
import { itemsForDay, useFixedEvents } from "./Itinerary";
import { useIdeaScores } from "./Ideas";
import { modeOf, routeText } from "@/lib/transport";
import { ModeIcon } from "../travel/ModeIcon";
import { finalOnly } from "@/lib/drafts";

export function Countdown({ big = false }: { big?: boolean }) {
  const { trip, noun, voice, rows } = useTrip();
  // Ongoing spaces (a show, a home) count down to the next thing with a date instead.
  if (voice.ongoing && !trip?.start_date) {
    const today = todayString();
    const next = [
      ...calendarEntries({ lists: rows.lists, items: rows.list_items })
        .filter((c) => c.day >= today && !isDone(c.item, c.list))
        .map((c) => ({ day: c.day, title: c.item.title || "Untitled", sub: c.field.name })),
      ...finalOnly(rows.itinerary_items).filter((i) => i.day && i.day >= today).map((i) => ({ day: i.day!, title: i.title, sub: "" })),
    ].sort((a, b) => a.day.localeCompare(b.day))[0];
    if (!next) {
      return (
        <div style={{ textAlign: "center" }}>
          <div className="countdown-num" style={big ? { fontSize: "5rem" } : undefined}>✦</div>
          <div className="muted" style={{ fontWeight: 600 }}>Nothing dated coming up</div>
        </div>
      );
    }
    const days = daysBetween(today, next.day);
    return (
      <div style={{ textAlign: "center" }}>
        <div className="countdown-num" style={big ? { fontSize: "5rem" } : undefined}>{days === 0 ? "Today" : days}</div>
        <div className="muted" style={{ fontWeight: 600 }}>
          {days === 0 ? "" : `day${days === 1 ? "" : "s"} until `}
          <strong style={{ color: "var(--ink)" }}>{next.title}</strong>
          {next.sub && <span className="tiny" style={{ display: "block" }}>{next.sub}</span>}
        </div>
      </div>
    );
  }
  const c = countdown(trip?.start_date ?? null, trip?.end_date ?? null);
  const single = !!trip?.start_date && trip.start_date === trip.end_date;
  const text =
    c.phase === "before" ? { n: c.days, label: `day${c.days === 1 ? "" : "s"} ${voice.countdown.until(noun)}` } :
    c.phase === "during" ? (single ? { n: "🎉", label: "today's the day!" } : { n: c.days, label: `of ${c.total} · it's happening!` }) :
    c.phase === "after" ? { n: "♥", label: voice.countdown.after(noun) } : { n: "✦", label: "add a date to count down" };
  return (
    <div style={{ textAlign: "center" }}>
      <div className="countdown-num" style={big ? { fontSize: "5rem" } : undefined}>{text.n}</div>
      <div className="muted" style={{ fontWeight: 600 }}>{c.phase === "during" ? `Day ${c.days} ` : ""}{text.label}</div>
    </div>
  );
}

/** What's happening today during the trip, or what's coming up before it. */
export function TodaySection({ compact = false }: { compact?: boolean }) {
  const { trip, rows, tripId, noun, hasModule, me, voice } = useTrip();
  const engine = { lists: rows.lists, items: rows.list_items };
  const horizon = addDays(todayString(), 14);
  // To-dos written on pages count too.
  const tasks = pageTasks(rows.pages).filter((t) => !t.done);
  const pageHref = (t: (typeof tasks)[number]) => `/trips/${tripId}/pages/${t.page.id}`;
  const mine = [
    ...assignedTo(me, engine).map(({ item, list }) => ({ key: item.id, icon: list.icon, title: item.title || "Untitled", sub: list.name, href: `/trips/${tripId}/lists/${list.id}?item=${item.id}` })),
    ...tasks.filter((t) => t.who === me).map((t) => ({ key: t.block.id, icon: t.page.icon, title: t.text, sub: t.page.title || "Untitled page", href: pageHref(t) })),
  ].slice(0, 6);
  const dueSoon = [
    ...calendarEntries(engine)
      .filter((c) => c.day >= todayString() && c.day <= horizon && !isDone(c.item, c.list))
      .map((c) => ({ key: `${c.item.id}${c.field.id}${c.day}`, icon: c.list.icon, title: c.item.title || "Untitled", sub: c.field.name, day: c.day, href: `/trips/${tripId}/lists/${c.list.id}?item=${c.item.id}` })),
    ...tasks
      .filter((t) => t.due && t.due >= todayString() && t.due <= horizon)
      .map((t) => ({ key: t.block.id, icon: t.page.icon, title: t.text, sub: t.page.title || "Page", day: t.due!, href: pageHref(t) })),
  ]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, 6);
  const fixed = useFixedEvents();
  const scores = useIdeaScores();
  const today = todayString();
  const c = countdown(trip?.start_date ?? null, trip?.end_date ?? null);
  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null);

  const focusDay = c.phase === "during" ? today : days[0] ?? null;
  // Today shows what's locked in; pencilled-in plans are still being decided.
  const items = focusDay ? itemsForDay(finalOnly(rows.itinerary_items), focusDay) : [];
  const events = focusDay ? fixed[focusDay] ?? [] : [];
  const tomorrow = c.phase === "during" ? addDays(today, 1) : null;
  const tomorrowItems = tomorrow ? itemsForDay(finalOnly(rows.itinerary_items), tomorrow) : [];

  const unbooked = !hasModule("flights") && !hasModule("stays") ? [] : [
    ...rows.stays.filter((s) => s.status === "idea").map((s) => `Book a stay: ${s.name}`),
    ...rows.flights.filter((f) => f.status === "idea").map((f) => `Book ${modeOf(f).noun} ${routeText(f)}`.trim()),
  ];
  const topIdeas = rows.ideas
    .filter((i) => i.status === "open" || i.status === "maybe")
    .sort((a, b) => (scores[b.id]?.score ?? 0) - (scores[a.id]?.score ?? 0))
    .slice(0, 3);
  const unscheduled = itemsForDay(rows.itinerary_items, null).length;
  const pencilled = rows.itinerary_items.filter((i) => i.draft && i.day).length;

  return (
    <div className="stack">
      {!compact && (
        <div className="section-head" style={{ marginBottom: 0 }}>
          <div>
            <h1>{c.phase === "during" ? "Today" : c.phase === "after" ? `After the ${noun}` : "Up next"}</h1>
            <p>{c.phase === "during" ? formatDayLong(today) : voice.today.hint}</p>
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
                {e.kind === "flight" ? <ModeIcon mode={e.mode} size={16} /> : e.kind === "stay" ? <BedDouble size={16} /> : <span aria-hidden>{e.icon}</span>}
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
          {pencilled > 0 && <p className="small">✏️ {pencilled} plan{pencilled === 1 ? "" : "s"} pencilled in. Vote on {pencilled === 1 ? "it" : "them"} so the itinerary can be locked in.</p>}
          {!unbooked.length && !topIdeas.length && !unscheduled && !pencilled && <p className="small muted">All caught up. 🎉</p>}
          {hasModule("itinerary") && <Link href={`/trips/${tripId}/itinerary`} className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-start" }}>Open calendar →</Link>}
        </div>
      )}
      {(mine.length > 0 || dueSoon.length > 0) && (
        <div className={compact ? "stack" : "card stack"} style={{ gap: "0.8rem" }}>
          {dueSoon.length > 0 && (
            <div>
              <strong className="small">Coming up in the next 2 weeks</strong>
              <div className="stack" style={{ gap: 2, marginTop: 4 }}>
                {dueSoon.map((c) => (
                  <Link key={c.key} href={c.href} className="check-row" style={{ textDecoration: "none" }}>
                    <span aria-hidden>{c.icon}</span>
                    <span className="grow small"><strong>{c.title}</strong> <span className="muted">· {c.sub}</span></span>
                    <span className="tiny muted nowrap">{formatDayLong(c.day).replace(/^\w+, /, "")}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {mine.length > 0 && (
            <div>
              <strong className="small">On your plate</strong>
              <div className="stack" style={{ gap: 2, marginTop: 4 }}>
                {mine.map((m) => (
                  <Link key={m.key} href={m.href} className="check-row" style={{ textDecoration: "none" }}>
                    <span aria-hidden>{m.icon}</span>
                    <span className="grow small">{m.title} <span className="muted">· {m.sub}</span></span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
