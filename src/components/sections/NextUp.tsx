"use client";

import Link from "next/link";
import { BedDouble, CalendarClock, AlertTriangle } from "lucide-react";
import { useTrip } from "../TripProvider";
import { EmptyState } from "../ui/Fields";
import { useFixedEvents } from "./Itinerary";
import { categoryOf } from "@/lib/categories";
import { cadenceGaps } from "@/lib/fields";
import { daysBetween, formatDay, formatTime, todayString } from "@/lib/format";
import { ModeIcon } from "../travel/ModeIcon";

interface Up {
  key: string;
  day: string;
  time: string | null;
  title: string;
  sub?: string;
  icon: React.ReactNode;
  href?: string;
}

const when = (day: string) => {
  const d = daysBetween(todayString(), day);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 7) return `In ${d} days`;
  return formatDay(day);
};

/** What's coming soon, from every list, the calendar, pages, flights and stays. */
export function NextUpSection({ limit = 6 }: { limit?: number }) {
  const { rows, tripId } = useTrip();
  const fixed = useFixedEvents();
  const today = todayString();
  const items: Up[] = [
    ...Object.entries(fixed)
      .filter(([d]) => d >= today)
      .flatMap(([day, evs]) =>
        evs
          .filter((e) => !e.title.startsWith("✓ "))
          .map((e) => ({
            key: e.key,
            day,
            time: e.time,
            title: e.title,
            sub: e.sub,
            href: e.href,
            icon: e.kind === "flight" ? <ModeIcon mode={e.mode} size={15} /> : e.kind === "stay" ? <BedDouble size={15} /> : <span aria-hidden>{e.icon}</span>,
          })),
      ),
    ...rows.itinerary_items
      .filter((i) => i.day && i.day >= today && !i.draft)
      .map((i) => ({ key: i.id, day: i.day!, time: i.start_time, title: i.title, icon: <span aria-hidden>{categoryOf(i.category).emoji}</span>, href: `/trips/${tripId}/itinerary` })),
  ]
    .sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? "99").localeCompare(b.time ?? "99"))
    .slice(0, limit);

  // Lists with a rhythm (a weekly release): flag the coming gaps.
  const gaps = rows.lists.flatMap((l) =>
    l.fields
      .filter((f) => f.cadence && (f.type === "date" || f.type === "datetime"))
      .map((f) => ({ list: l, field: f, gaps: cadenceGaps(rows.list_items, l, f, today, 4) }))
      .filter((g) => g.gaps.length),
  );
  const warn = gaps.length > 0 && (
    <div className="stack" style={{ gap: 6, marginBottom: 6 }}>
      {gaps.map((g) => (
        <Link key={g.field.id} href={`/trips/${tripId}/lists/${g.list.id}`} className="cadence-warn" style={{ textDecoration: "none", color: "inherit", marginBottom: 0 }}>
          <AlertTriangle size={15} />
          <span className="small">
            No {g.field.name.toLowerCase()} planned for the {g.field.cadence === "month" ? "month" : "week"} of {formatDay(g.gaps[0])}
            {g.gaps.length > 1 && ` (+${g.gaps.length - 1} more)`}
          </span>
        </Link>
      ))}
    </div>
  );

  if (!items.length) {
    if (warn) return <>{warn}<p className="small muted">Nothing else dated coming up.</p></>;
    return <EmptyState icon={<CalendarClock />} title="Nothing coming up">Anything with a date (in a list, on the calendar or on a page) shows here.</EmptyState>;
  }
  return (
    <div className="stack" style={{ gap: 2 }}>
      {warn}
      {items.map((u) => {
        const body = (
          <>
            <span className="nextup-icon">{u.icon}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <strong className="small truncate" style={{ display: "block" }}>{u.title}</strong>
              {u.sub && <span className="tiny muted truncate" style={{ display: "block" }}>{u.sub}</span>}
            </span>
            <span className="nextup-when">
              {when(u.day)}
              {u.time && <span className="tiny muted" style={{ display: "block" }}>{formatTime(u.time)}</span>}
            </span>
          </>
        );
        return u.href ? (
          <Link key={u.key} href={u.href} className="check-row" style={{ textDecoration: "none" }}>{body}</Link>
        ) : (
          <div key={u.key} className="check-row">{body}</div>
        );
      })}
    </div>
  );
}
