"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Printer, BookHeart, Palette, EyeOff, Eye, X, Loader2, Check } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { EmptyState, Field, Segmented } from "../ui/Fields";
import { Modal } from "../ui/Modal";
import { useAirports } from "../travel/useTravel";
import { categoryOf } from "@/lib/categories";
import { formatDayLong, formatRange, formatTime } from "@/lib/format";
import { fontCss, fontHref } from "@/lib/themes";
import { canSee, linkTitle } from "@/lib/memories";
import { buildChapters, collage, PAGE_SIZES, STYLES, styleOf, tripNumbers, withDefaults, type Chapter, type PageSize, type ScrapbookPrefs, type StyleDef } from "@/lib/scrapbook";
import type { Note, Photo } from "@/lib/types";

/** A keepsake of the trip: designed pages that print exactly as they look. */
export function ScrapbookSection() {
  const { trip, rows, me, view, saveView, ensurePhotoUrls, nameOf, voice, noun } = useTrip();
  const airports = useAirports();
  const prefs = withDefaults(view.scrapbook);
  const style = styleOf(prefs.style, trip?.kind);
  const [designing, setDesigning] = useState(false);
  const [curating, setCurating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const setPrefs = (p: Partial<ScrapbookPrefs>) => saveView({ scrapbook: { ...(view.scrapbook ?? {}), ...p } });

  // Only what you're allowed to see; private things only if you choose to include them.
  const visibleNotes = useMemo(() => rows.notes.filter((n) => canSee(n, me)), [rows.notes, me]);
  const visiblePhotos = useMemo(() => rows.photos.filter((p) => canSee(p, me)), [rows.photos, me]);
  const src = useMemo(
    () => ({ start: trip?.start_date ?? null, end: trip?.end_date ?? null, plans: rows.itinerary_items, stays: rows.stays, notes: visibleNotes, photos: visiblePhotos }),
    [trip?.start_date, trip?.end_date, rows.itinerary_items, rows.stays, visibleNotes, visiblePhotos],
  );
  // While curating, show hidden things (faded) so they can be brought back.
  const chapters = useMemo(() => buildChapters(src, curating ? { ...view.scrapbook, hidden: [] } : view.scrapbook), [src, view.scrapbook, curating]);
  const hidden = new Set(prefs.hidden);
  const favorites = visiblePhotos.filter((p) => p.favorite && !hidden.has(p.id) && (prefs.include.privateToo || (p.visibility ?? "everyone") === "everyone")).slice(0, 12);
  const coverPhoto =
    visiblePhotos.find((p) => p.id === prefs.cover.photoId) ?? favorites[0] ?? chapters.flatMap((c) => c.photos)[0] ?? null;
  const bookPhotos = visiblePhotos.filter((p) => !hidden.has(p.id) && (prefs.include.privateToo || (p.visibility ?? "everyone") === "everyone"));
  const bookNotes = visibleNotes.filter((n) => !hidden.has(n.id) && (prefs.include.privateToo || (n.visibility ?? (n.is_private ? "private" : "everyone")) === "everyone"));
  const numbers = tripNumbers({ ...src, photos: bookPhotos, notes: bookNotes, flights: rows.flights }, (c) => airports?.get(c?.toUpperCase()) ?? null);
  const travelers = rows.trip_members.filter((m) => m.attendance === "going");

  const pathKey = [...new Set([...chapters.flatMap((c) => c.photos), ...favorites, ...(coverPhoto ? [coverPhoto] : [])].map((p) => p.storage_path))].join("|");
  useEffect(() => {
    if (pathKey) void ensurePhotoUrls(pathKey.split("|"));
  }, [pathKey, ensurePhotoUrls]);

  // This style's fonts.
  const href = fontHref([style.heading, style.body, style.hand]);
  useEffect(() => {
    if (!href) return;
    let link = document.getElementById("sb-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "sb-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [href]);

  const toggleHidden = (id: string) => setPrefs({ hidden: hidden.has(id) ? prefs.hidden.filter((x) => x !== id) : [...prefs.hidden, id] });

  async function savePdf() {
    setCurating(false);
    setPrinting(true);
    // Make sure every picture and font is loaded so the PDF matches the screen.
    await new Promise((r) => setTimeout(r, 50));
    await document.fonts?.ready;
    await Promise.all(
      Array.from(document.querySelectorAll<HTMLImageElement>(".sb img")).map((img) =>
        img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }),
      ),
    );
    setPrinting(false);
    window.print();
  }

  const empty = !chapters.length && !favorites.length;
  const page = PAGE_SIZES[prefs.pageSize];
  const vars = {
    "--paper": style.paper,
    "--sb-ink": style.ink,
    "--sb-muted": style.muted,
    "--sb-accent": style.accent,
    "--sb-heading": fontCss(style.heading),
    "--sb-body": fontCss(style.body),
    "--sb-hand": fontCss(style.hand),
    "--page-ratio": String(page.ratio),
    "--page-w": prefs.pageSize === "a4" ? "794px" : prefs.pageSize === "square" ? "768px" : "816px",
  } as React.CSSProperties;

  return (
    <div className="sb-wrap">
      {/* The printed page size and paper color follow your choices. */}
      <style>{`@media print { @page { size: ${page.css}; margin: 0; } html, body, #theme-root, .trip-layout, .main { background: ${style.paper} !important; } }`}</style>
      <div className="section-head no-print">
        <div>
          <ModuleTitle id="scrapbook" fallback="Scrapbook" />
          <p>Your {noun}, laid out like a keepsake book. It fills itself in from plans, journals, notes and photos. Design it your way, then save it as a PDF that looks just like this.</p>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={() => setDesigning(true)}><Palette size={16} /> Design</button>
          <button className={clsx("btn", curating && "btn-primary")} onClick={() => setCurating((c) => !c)} aria-pressed={curating}>
            {curating ? <Check size={16} /> : <EyeOff size={16} />} {curating ? "Done choosing" : "Choose what's in it"}
          </button>
          <button className="btn btn-primary" onClick={savePdf} disabled={empty || printing}>{printing ? <Loader2 size={16} className="spin" /> : <Printer size={16} />} Save as PDF</button>
        </div>
      </div>
      {curating && (
        <p className="card small no-print sb-curate-tip">
          Tap <X size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> on any photo, entry or note to leave it out (faded ones are already out; tap <Eye size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> to bring them back). This only changes your copy.
        </p>
      )}
      {empty ? (
        <div className="card no-print">
          <EmptyState icon={<BookHeart />} title="The scrapbook fills itself in">
            Plan your days, write journal entries and add photos (heart your favorites). They all land here, chapter by chapter.
          </EmptyState>
        </div>
      ) : (
        <div className={clsx("sb", `sb-${style.id}`, `sb-frame-${style.frame}`, curating && "sb-curating")} style={vars}>
          <Cover title={prefs.cover.title || trip?.name || ""} subtitle={prefs.cover.subtitle || [trip?.destination, formatRange(trip?.start_date ?? null, trip?.end_date ?? null)].filter(Boolean).join(" · ")} photo={coverPhoto} people={travelers.map((m) => nameOf(m.user_id).split(" ")[0])} style={style} />
          {chapters.map((c, i) => (
            <ChapterPage key={c.key} chapter={c} index={i} style={style} hidden={hidden} curating={curating} onToggle={toggleHidden} include={prefs.include} />
          ))}
          {prefs.include.numbers && (
            <Page className="sb-numbers">
              <div className="sb-kicker">By the numbers</div>
              <h2 className="sb-title">{voice.scrapbook.numbersTitle(noun)}</h2>
              <div className="sb-numgrid">
                {[
                  [numbers.days, numbers.days === 1 ? "day" : "days"],
                  ...(voice.travel ? [[numbers.nights, numbers.nights === 1 ? "night away" : "nights away"]] : []),
                  [numbers.plans, numbers.plans === 1 ? "plan" : "plans"],
                  [numbers.places, numbers.places === 1 ? "place" : "places"],
                  [numbers.photos, numbers.photos === 1 ? "photo" : "photos"],
                  [numbers.entries, numbers.entries === 1 ? "journal entry" : "journal entries"],
                  ...(numbers.milesFlown ? [[numbers.milesFlown.toLocaleString(), "miles flown"]] : []),
                  ...(numbers.milesOverland ? [[numbers.milesOverland.toLocaleString(), "miles by road, rail & sea"]] : []),
                ]
                  .filter(([n]) => Number(String(n).replace(/,/g, "")) > 0)
                  .map(([n, label]) => (
                    <div key={String(label)} className="sb-num"><strong>{n}</strong><span>{label}</span></div>
                  ))}
              </div>
              <Stickers style={style} seed={97} />
            </Page>
          )}
          {prefs.include.favorites && favorites.length > 0 && (
            <Page className="sb-favorites">
              <div className="sb-kicker">The best of it</div>
              <h2 className="sb-title">Favorites</h2>
              <div className="sb-wall">
                {favorites.map((p, i) => <SbPhoto key={p.id} photo={p} i={i} curating={curating} hidden={hidden.has(p.id)} onToggle={toggleHidden} />)}
              </div>
            </Page>
          )}
          {prefs.include.people && travelers.length > 0 && (
            <Page className="sb-people">
              <div className="sb-kicker">Who was there</div>
              <h2 className="sb-title">With love,</h2>
              <div className="sb-signatures">
                {travelers.map((m) => <span key={m.user_id} className="sb-hand sb-sign">{nameOf(m.user_id)}</span>)}
              </div>
              <Stickers style={style} seed={41} />
            </Page>
          )}
        </div>
      )}
      <p className="tiny muted no-print" style={{ textAlign: "center", marginTop: "1rem" }}>
        Save as PDF opens your device&apos;s print screen: choose <strong>Save as PDF</strong> (on iPhone, pinch out on the preview, then Share › Save to Files).
      </p>
      <DesignPanel open={designing} onClose={() => setDesigning(false)} prefs={view.scrapbook ?? {}} setPrefs={setPrefs} photos={visiblePhotos} coverId={coverPhoto?.id ?? null} />
    </div>
  );
}

/** A page: the outer box sizes the inner one, so everything inside scales with the page width. */
function Page({ className, children, pageRef }: { className: string; children: React.ReactNode; pageRef?: React.Ref<HTMLElement> }) {
  return (
    <section className={`sb-page ${className}`} ref={pageRef}>
      <div className="sb-pg">{children}</div>
    </section>
  );
}

function usePhotoSrc(p: Photo | null) {
  const { photoUrl } = useTrip();
  return p ? photoUrl(p.storage_path) : undefined;
}

function Cover({ title, subtitle, photo, people, style }: { title: string; subtitle: string; photo: Photo | null; people: string[]; style: StyleDef }) {
  const src = usePhotoSrc(photo);
  return (
    <Page className="sb-cover">
      {photo && (
        <div className="sb-cover-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src && <img src={src} alt="" />}
        </div>
      )}
      <div className="sb-cover-text">
        <div className="sb-kicker">{style.id === "spooky" ? "A season to remember" : "A keepsake"}</div>
        <h1 className="sb-cover-title">{title}</h1>
        {subtitle && <p className="sb-cover-sub">{subtitle}</p>}
        {people.length > 0 && <p className="sb-hand sb-cover-people">{people.join(" · ")}</p>}
      </div>
      <Stickers style={style} seed={3} />
    </Page>
  );
}

const STICKER_SPOTS = [
  { right: "4%", top: "3%", rot: 14 },
  { left: "3%", bottom: "4%", rot: -10 },
  { right: "6%", bottom: "6%", rot: 8 },
  { left: "5%", top: "4%", rot: -14 },
];

function Stickers({ style, seed }: { style: StyleDef; seed: number }) {
  if (!style.stickers.length) return null;
  const s = style.stickers[seed % style.stickers.length];
  const spot = STICKER_SPOTS[seed % STICKER_SPOTS.length];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/stickers/${s}.svg`} alt="" aria-hidden className="sb-sticker" style={{ ...spot, transform: `rotate(${spot.rot}deg)` }} />
  );
}

/** How many photos fit beside a chapter's text, and how the rest go onto photo pages. */
function splitPhotos(photos: Photo[], textWeight: number): Photo[][] {
  const first = textWeight > 9 ? 0 : textWeight > 5 ? 2 : textWeight > 0 ? 3 : 6;
  const pages: Photo[][] = [photos.slice(0, first)];
  for (let i = first; i < photos.length; i += 6) pages.push(photos.slice(i, i + 6));
  return pages;
}

function ChapterPage({ chapter: c, index, style, hidden, curating, onToggle, include }: { chapter: Chapter; index: number; style: StyleDef; hidden: Set<string>; curating: boolean; onToggle: (id: string) => void; include: ReturnType<typeof withDefaults>["include"] }) {
  const { nameOf, rows } = useTrip();
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(c.title);
  const plans = include.plans ? c.plans : [];
  const journal = include.journal ? c.journal : [];
  const notes = include.notes ? c.notes : [];
  const photos = include.photos ? c.photos : [];
  const two = plans.length > 0 && journal.length > 0;
  // Rough measure of how much of the page the words take (so pages print as they look).
  const journalWeight = journal.reduce((n, j) => n + 1.5 + j.body.length / 260, 0);
  const textWeight = (two ? Math.max(plans.length * 0.8, journalWeight) : plans.length + journalWeight) + notes.length * 1.2;
  // Start from a guess, then measure: photos that don't fit move to the next page, so the screen shows exactly the pages the PDF will have.
  const guess = splitPhotos(photos, plans.length || journal.length || notes.length ? textWeight : 0)[0].length;
  const photoKey = photos.map((p) => p.id).join(",");
  const [fit, setFit] = useState<{ key: string; n: number } | null>(null);
  const first = fit && fit.key === photoKey ? fit.n : guess;
  const pageRef = useRef<HTMLElement>(null);
  // Re-measure once the style's fonts arrive (they change how much space text takes).
  const [, setFontsReady] = useState(0);
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => alive && setFontsReady((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [style.id]);
  useLayoutEffect(() => {
    const el = pageRef.current;
    const pg = el?.querySelector<HTMLElement>(".sb-pg");
    if (!el || !pg || first <= 0) return;
    const ratio = Number(getComputedStyle(el).getPropertyValue("--page-ratio")) || 8.5 / 11;
    const pageH = el.clientWidth / ratio;
    if (pg.scrollHeight > pageH + 2) setFit({ key: photoKey, n: first - 1 });
  });
  const firstPhotos = photos.slice(0, first);
  const photoPages: Photo[][] = [];
  for (let i = first; i < photos.length; i += 6) photoPages.push(photos.slice(i, i + 6));
  const title = isDay ? formatDayLong(c.title) : c.title;
  return (
    <>
      <Page className="sb-chapter" pageRef={pageRef}>
        <header className="sb-head">
          {c.kicker && <div className="sb-kicker">{c.kicker}</div>}
          <h2 className="sb-title">{title}</h2>
          {c.sub && <div className="sb-sub">{isDay ? `Staying at ${c.sub}` : c.sub}</div>}
          <div className="sb-rule" aria-hidden><span>✦</span></div>
        </header>
        <div className={clsx("sb-cols", two && "two")}>
          {plans.length > 0 && (
            <ol className="sb-plans">
              {plans.map((p) => (
                <li key={p.id}>
                  <span className="sb-time">{p.start_time ? formatTime(p.start_time) : isDay ? "" : formatDayLong(p.day).replace(/, \d{4}$/, "")}</span>
                  <span className="sb-plan"><span aria-hidden>{categoryOf(p.category).emoji}</span> {p.title}</span>
                </li>
              ))}
            </ol>
          )}
          {journal.length > 0 && (
            <div className="sb-journal">
              {journal.map((j) => (
                <Curatable key={j.id} id={j.id} hidden={hidden.has(j.id)} curating={curating} onToggle={onToggle}>
                  <article className="sb-entry">
                    {j.title && <h3 className="sb-entry-title">{j.title}</h3>}
                    <p className="sb-hand sb-entry-body">{j.body}</p>
                    <span className="sb-byline">— {nameOf(j.created_by)}</span>
                  </article>
                </Curatable>
              ))}
            </div>
          )}
        </div>
        {firstPhotos.length > 0 && <Collage photos={firstPhotos} seed={index} curating={curating} hidden={hidden} onToggle={onToggle} />}
        {notes.length > 0 && (
          <div className="sb-notes">
            {notes.map((n: Note) => (
              <Curatable key={n.id} id={n.id} hidden={hidden.has(n.id)} curating={curating} onToggle={onToggle}>
                <div className="sb-note">
                  <span className="sb-note-for">{linkTitle(n.linked_type, n.linked_id, rows)}</span>
                  {n.title && <strong>{n.title}</strong>}
                  <p>{n.body}</p>
                </div>
              </Curatable>
            ))}
          </div>
        )}
        {index % 2 === 1 && <Stickers style={style} seed={index} />}
      </Page>
      {photoPages.map((ps, k) => (
        <Page key={k} className="sb-chapter sb-photo-page">
          <header className="sb-head">
            <div className="sb-kicker">{c.kicker ? `${c.kicker} · ` : ""}{title}</div>
          </header>
          <Collage photos={ps} seed={index + k + 1} curating={curating} hidden={hidden} onToggle={onToggle} />
          {(index + k) % 2 === 0 && <Stickers style={style} seed={index + k + 5} />}
        </Page>
      ))}
    </>
  );
}

function Collage({ photos, seed, curating, hidden, onToggle }: { photos: Photo[]; seed: number; curating: boolean; hidden: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div className={`sb-collage sb-${collage(photos.length)}`}>
      {photos.map((p, i) => <SbPhoto key={p.id} photo={p} i={i + seed} curating={curating} hidden={hidden.has(p.id)} onToggle={onToggle} />)}
    </div>
  );
}

function Curatable({ id, hidden, curating, onToggle, children }: { id: string; hidden: boolean; curating: boolean; onToggle: (id: string) => void; children: React.ReactNode }) {
  if (!curating) return <>{children}</>;
  return (
    <div className={clsx("sb-curatable", hidden && "is-hidden")}>
      {children}
      <button className="sb-x no-print" onClick={() => onToggle(id)} aria-label={hidden ? "Put it back" : "Leave it out"}>
        {hidden ? <Eye size={14} /> : <X size={14} />}
      </button>
    </div>
  );
}

function SbPhoto({ photo, i, curating, hidden, onToggle }: { photo: Photo; i: number; curating: boolean; hidden: boolean; onToggle: (id: string) => void }) {
  const src = usePhotoSrc(photo);
  const rot = ((i * 37) % 7) - 3;
  return (
    <Curatable id={photo.id} hidden={hidden} curating={curating} onToggle={onToggle}>
      <figure className="sb-photo" style={{ "--rot": `${rot}deg` } as React.CSSProperties}>
        <div className="sb-photo-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt={photo.caption} /> : null}
        </div>
        {photo.caption && <figcaption className="sb-hand">{photo.caption}</figcaption>}
      </figure>
    </Curatable>
  );
}

// ---------------------------------------------------------------- design panel

function DesignPanel({ open, onClose, prefs: raw, setPrefs, photos, coverId }: { open: boolean; onClose: () => void; prefs: ScrapbookPrefs; setPrefs: (p: Partial<ScrapbookPrefs>) => void; photos: Photo[]; coverId: string | null }) {
  const { trip, photoUrl, ensurePhotoUrls, voice, noun } = useTrip();
  const prefs = withDefaults(raw);
  const coverChoices = [...photos].sort((a, b) => Number(b.favorite) - Number(a.favorite)).slice(0, 24);
  const paths = coverChoices.map((p) => p.storage_path).join("|");
  useEffect(() => {
    if (open && paths) void ensurePhotoUrls(paths.split("|"));
  }, [open, paths, ensurePhotoUrls]);
  const include = (k: keyof typeof prefs.include, v: boolean) => setPrefs({ include: { ...(raw.include ?? {}), [k]: v } });
  const sw = (k: keyof typeof prefs.include, label: string, hint?: string) => (
    <label className="toggle-row">
      <span>{label}{hint && <span className="tiny muted" style={{ display: "block" }}>{hint}</span>}</span>
      <input type="checkbox" role="switch" className="switch" checked={prefs.include[k]} onChange={(e) => include(k, e.target.checked)} />
    </label>
  );
  return (
    <Modal open={open} onClose={onClose} variant="panel" title="Design your scrapbook">
      <div className="detail">
        <div className="detail-section">
          <h3>Style</h3>
          <div className="sb-style-grid">
            {STYLES.map((s) => (
              <button key={s.id} className={clsx("sb-style-card", prefs.style === s.id && "on")} onClick={() => setPrefs({ style: s.id })} aria-pressed={prefs.style === s.id}>
                <span className="sb-swatch" style={{ background: s.paper, color: s.ink, fontFamily: fontCss(s.heading), borderColor: s.accent }}>
                  Aa<span style={{ background: s.accent }} />
                </span>
                <strong className="small">{s.name}</strong>
                <span className="tiny muted">{s.blurb}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label="Chapters">
          <Segmented<"day" | "stay"> size="sm" value={prefs.chapters} onChange={(v) => setPrefs({ chapters: v })} options={[{ value: "day", label: "One per day" }, ...(voice.scrapbook.chapterByStay ? [{ value: "stay" as const, label: "One per stay" }] : [])]} />
        </Field>
        <Field label="Page size (for the PDF too)">
          <Segmented<PageSize> size="sm" value={prefs.pageSize} onChange={(v) => setPrefs({ pageSize: v })} options={[{ value: "letter", label: "Letter" }, { value: "a4", label: "A4" }, { value: "square", label: "Square" }]} />
        </Field>
        <Field label="Photos per chapter">
          <Segmented<string> size="sm" value={String(prefs.photosPerChapter)} onChange={(v) => setPrefs({ photosPerChapter: Number(v) as 4 | 8 | 0 })} options={[{ value: "4", label: "Up to 4" }, { value: "8", label: "Up to 8" }, { value: "0", label: "All" }]} />
        </Field>
        <div className="detail-section">
          <h3>What&apos;s in it</h3>
          <div className="toggle-list">
            {sw("plans", "Plans for each day")}
            {sw("journal", "Journal entries")}
            {sw("notes", "Notes attached to plans and stays")}
            {sw("photos", "Photos")}
            <label className="toggle-row">
              <span>Only favorite photos</span>
              <input type="checkbox" role="switch" className="switch" checked={prefs.favoritesOnly} onChange={(e) => setPrefs({ favoritesOnly: e.target.checked })} />
            </label>
            {sw("numbers", `${voice.scrapbook.numbersTitle(noun)} page`)}
            {sw("favorites", "Favorites page")}
            {sw("people", "“With love” page")}
            {sw("privateToo", "Include things not everyone can see", "Off by default, so your PDF is safe to share.")}
          </div>
        </div>
        <div className="detail-section">
          <h3>Cover</h3>
          <div className="form-grid">
            <Field label="Title" full><input className="input" value={raw.cover?.title ?? ""} placeholder={trip?.name} onChange={(e) => setPrefs({ cover: { ...(raw.cover ?? {}), title: e.target.value } })} maxLength={120} /></Field>
            <Field label="Subtitle" full><input className="input" value={raw.cover?.subtitle ?? ""} placeholder={[trip?.destination, formatRange(trip?.start_date ?? null, trip?.end_date ?? null)].filter(Boolean).join(" · ")} onChange={(e) => setPrefs({ cover: { ...(raw.cover ?? {}), subtitle: e.target.value } })} maxLength={160} /></Field>
          </div>
          {coverChoices.length > 0 && (
            <>
              <span className="tiny muted" style={{ display: "block", margin: "0.6rem 0 0.4rem" }}>Cover photo</span>
              <div className="memory-strip">
                {coverChoices.map((p) => (
                  <button key={p.id} className={clsx("memory-thumb sb-cover-pick", coverId === p.id && "on")} onClick={() => setPrefs({ cover: { ...(raw.cover ?? {}), photoId: p.id } })} aria-label="Use as cover" aria-pressed={coverId === p.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photoUrl(p.storage_path) && <img src={photoUrl(p.storage_path)} alt="" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setPrefs({ style: undefined, chapters: undefined, pageSize: undefined, photosPerChapter: undefined, favoritesOnly: undefined, include: undefined, cover: undefined })}>
          Start over with the defaults
        </button>
      </div>
    </Modal>
  );
}
