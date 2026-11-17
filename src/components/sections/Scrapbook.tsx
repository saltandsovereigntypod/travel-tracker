"use client";

import { useEffect, useMemo } from "react";
import { Printer, BookHeart } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Avatar, EmptyState } from "../ui/Fields";
import { categoryOf } from "@/lib/categories";
import { formatDayLong, formatRange, tripDays } from "@/lib/format";
import { itemsForDay } from "./Itinerary";

/** A keepsake view: each day's plans, journal entries and photos, ready to print. */
export function ScrapbookSection() {
  const { trip, rows, nameOf, colorOf, ensurePhotoUrls, photoUrl } = useTrip();
  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null);
  const journal = rows.notes.filter((n) => n.kind === "journal" && (n.body.trim() || n.title.trim()));
  const photos = rows.photos;
  const favorites = photos.filter((p) => p.favorite);

  const paths = useMemo(() => photos.map((p) => p.storage_path), [photos]);
  useEffect(() => {
    void ensurePhotoUrls(paths);
  }, [paths, ensurePhotoUrls]);

  const travelers = rows.trip_members.filter((m) => m.attendance === "going");
  const dayHasContent = (d: string) =>
    itemsForDay(rows.itinerary_items, d).length || journal.some((j) => j.entry_date === d) || photos.some((p) => p.taken_on === d);
  const contentDays = days.filter(dayHasContent);
  const loose = journal.filter((j) => !j.entry_date || !days.includes(j.entry_date));

  if (!contentDays.length && !favorites.length && !loose.length) {
    return (
      <div>
        <div className="section-head"><div><h1>Scrapbook</h1><p>Your trip, turned into a keepsake.</p></div></div>
        <div className="card">
          <EmptyState icon={<BookHeart />} title="The scrapbook fills itself in">
            Write journal entries, add photos (heart your favorites) and plan your days. They all land here, day by day, ready to print.
          </EmptyState>
        </div>
      </div>
    );
  }

  const rot = (i: number) => `rotate(${((i * 37) % 7) - 3}deg)`;

  return (
    <div className="scrap-page">
      <div className="row-between no-print">
        <div />
        <button className="btn" onClick={() => window.print()}><Printer size={16} /> Print or save as PDF</button>
      </div>
      <header className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem", position: "relative", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/stickers/passport-stamp.svg" alt="" style={{ position: "absolute", right: -20, top: -10, width: 160, opacity: 0.5, transform: "rotate(14deg)" }} />
        <p className="day-num">{trip?.destination}</p>
        <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)", margin: "0.4rem 0" }}>{trip?.name}</h1>
        <p className="muted">{formatRange(trip?.start_date ?? null, trip?.end_date ?? null)}</p>
        <div className="row" style={{ justifyContent: "center", marginTop: "1rem" }}>
          {travelers.map((m) => (
            <span key={m.user_id} className="row small" style={{ gap: 4 }}>
              <Avatar name={nameOf(m.user_id)} color={colorOf(m.user_id)} size={26} /> {nameOf(m.user_id)}
            </span>
          ))}
        </div>
        {trip?.description && <p style={{ marginTop: "1rem", fontStyle: "italic" }}>{trip.description}</p>}
      </header>

      {contentDays.map((d) => {
        const items = itemsForDay(rows.itinerary_items, d);
        const entries = journal.filter((j) => j.entry_date === d);
        const dayPhotos = photos.filter((p) => p.taken_on === d).sort((a, b) => Number(b.favorite) - Number(a.favorite)).slice(0, 6);
        return (
          <section key={d} className="card journal-entry">
            <div className="date">Day {days.indexOf(d) + 1} · {formatDayLong(d)}</div>
            {items.length > 0 && (
              <p className="small muted" style={{ marginTop: 6 }}>
                {items.map((i) => `${categoryOf(i.category).emoji} ${i.title}`).join("  ·  ")}
              </p>
            )}
            {entries.map((j) => (
              <div key={j.id} style={{ marginTop: "1rem" }}>
                {j.title && <h3>{j.title}</h3>}
                <p className="journal-body">{j.body}</p>
                <span className="tiny muted">— {nameOf(j.created_by)}</span>
              </div>
            ))}
            {dayPhotos.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1.2rem", marginTop: "1.2rem" }}>
                {dayPhotos.map((p, i) => (
                  <figure key={p.id} className="polaroid" style={{ transform: rot(i), margin: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photoUrl(p.storage_path) && <img src={photoUrl(p.storage_path)} alt={p.caption} />}
                    <figcaption>{p.caption}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {loose.map((j) => (
        <section key={j.id} className="card journal-entry">
          <div className="date">{j.entry_date ? formatDayLong(j.entry_date) : "Journal"}</div>
          {j.title && <h3 style={{ marginTop: 6 }}>{j.title}</h3>}
          <p className="journal-body">{j.body}</p>
          <span className="tiny muted">— {nameOf(j.created_by)}</span>
        </section>
      ))}

      {favorites.length > 0 && (
        <section>
          <h2 style={{ textAlign: "center", marginBottom: "1.4rem" }}>Favorites</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1.6rem" }}>
            {favorites.map((p, i) => (
              <figure key={p.id} className="polaroid" style={{ transform: rot(i + 3), margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photoUrl(p.storage_path) && <img src={photoUrl(p.storage_path)} alt={p.caption} />}
                <figcaption>{p.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
