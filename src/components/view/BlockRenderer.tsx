"use client";

import Link from "next/link";
import clsx from "clsx";
import { MapPin, CalendarDays, ExternalLink } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Avatar } from "../ui/Fields";
import { IdeasSection } from "../sections/Ideas";
import { ItinerarySection } from "../sections/Itinerary";
import { FlightsSection } from "../sections/Flights";
import { StaysSection } from "../sections/Stays";
import { BudgetSection } from "../sections/Budget";
import { PackingSection } from "../sections/Packing";
import { NotesSection } from "../sections/Notes";
import { PhotosSection } from "../sections/Photos";
import { MapSection } from "../sections/MapView";
import { PeopleSection } from "../sections/People";
import { Countdown, TodaySection } from "../sections/Today";
import { blockMeta } from "@/lib/blocks";
import { fontCss, readableOn } from "@/lib/themes";
import { formatRange, hostname } from "@/lib/format";
import type { BlockProps, BlockStyle, BlockType } from "@/lib/types";

export interface RenderableBlock {
  id: string;
  type: BlockType;
  props?: BlockProps;
  style?: BlockStyle;
}

const DECOR: BlockType[] = ["heading", "text", "quote", "image", "sticker", "divider"];

/** Turns a block's style overrides into CSS variables scoped to that block. */
export function blockVars(style: BlockStyle | undefined): React.CSSProperties {
  if (!style) return {};
  const v: Record<string, string> = {};
  if (style.bg) {
    v["--surface"] = style.bg;
    v["--border"] = `color-mix(in srgb, ${style.bg} 80%, black)`;
  }
  if (style.ink) v["--ink"] = style.ink;
  else if (style.bg) v["--ink"] = readableOn(style.bg);
  if (style.accent) v["--accent"] = style.accent;
  if (style.font) {
    v["--font-heading"] = fontCss(style.font);
    v["--font-body"] = fontCss(style.font);
  }
  return v as React.CSSProperties;
}

export function BlockRenderer({
  block,
  editing,
  selected,
  onProps,
  fill,
}: {
  block: RenderableBlock;
  editing?: boolean;
  selected?: boolean;
  onProps?: (p: BlockProps) => void;
  /** Board mode: fill the given box and scroll inside it. */
  fill?: boolean;
}) {
  const { tripId } = useTrip();
  const meta = blockMeta(block.type);
  const style = block.style ?? {};
  const isDecor = DECOR.includes(block.type);
  const cardStyle = style.cardStyle ?? (isDecor && block.type !== "text" && block.type !== "quote" ? "none" : undefined);
  const bare = cardStyle === "none";
  const title = style.title ?? meta.label;
  const showTitle = !style.hideTitle && !isDecor && block.type !== "hero" && block.type !== "countdown";

  return (
    <div
      className={clsx(!bare && "card", !bare && cardStyle && `cs-${cardStyle}`, bare && "block-bare")}
      style={{
        ...blockVars(style),
        color: "var(--ink)",
        textAlign: style.align,
        height: fill ? "100%" : undefined,
        overflow: fill ? "auto" : undefined,
        ...(block.type === "hero" ? { padding: 0, overflow: "hidden" } : {}),
        ...(bare ? { background: style.bg } : {}),
      }}
    >
      {showTitle && (
        <div className="block-title">
          <h3>{title}</h3>
          {meta.section && <Link href={`/trips/${tripId}/${meta.section}`}>Open →</Link>}
        </div>
      )}
      <BlockBody block={block} editing={editing && selected} onProps={onProps} fill={fill} />
    </div>
  );
}

function BlockBody({ block, editing, onProps, fill }: { block: RenderableBlock; editing?: boolean; onProps?: (p: BlockProps) => void; fill?: boolean }) {
  const p = block.props ?? {};
  const size = block.style?.size ?? "m";
  switch (block.type) {
    case "hero":
      return <Hero />;
    case "countdown":
      return <div style={{ padding: "1rem 0" }}><Countdown /></div>;
    case "today":
      return <TodaySection compact />;
    case "ideas":
      return <IdeasSection compact limit={p.limit ?? 6} />;
    case "itinerary":
      return <ItinerarySection compact />;
    case "flights":
      return <FlightsSection compact />;
    case "stays":
      return <StaysSection compact />;
    case "budget":
      return <BudgetSection compact />;
    case "packing":
      return <PackingSection compact />;
    case "notes":
      return <NotesSection compact />;
    case "photos":
      return <PhotosSection compact limit={p.limit ?? 8} />;
    case "map":
      return <MapSection compact height={fill ? undefined : 340} />;
    case "people":
      return <PeopleSection compact />;
    case "heading":
      return editing && onProps ? (
        <input className={clsx("inline-edit heading", `h-${size}`)} autoFocus value={p.text ?? ""} onChange={(e) => onProps({ ...p, text: e.target.value })} />
      ) : (
        <h1 className={`h-${size}`} style={{ margin: 0 }}>{p.text || "Heading"}</h1>
      );
    case "text":
      return editing && onProps ? (
        <textarea className={clsx("inline-edit", `text-${size}`)} rows={5} autoFocus value={p.text ?? ""} onChange={(e) => onProps({ ...p, text: e.target.value })} />
      ) : (
        <p className={`text-${size}`} style={{ whiteSpace: "pre-wrap" }}>{p.text || "Double-click to write."}</p>
      );
    case "quote":
      return editing && onProps ? (
        <textarea className={clsx("inline-edit", `text-${size}`)} rows={3} autoFocus value={p.text ?? ""} onChange={(e) => onProps({ ...p, text: e.target.value })} />
      ) : (
        <blockquote className={clsx("quote-block", `text-${size === "m" ? "l" : size}`)} style={{ margin: 0 }}>{p.text || "A favorite quote"}</blockquote>
      );
    case "image":
      return p.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.src} alt={p.text ?? ""} style={{ width: "100%", height: fill ? "100%" : "auto", objectFit: "cover", borderRadius: "calc(var(--radius) * 0.7)" }} />
      ) : (
        <div className="empty" style={{ border: "2px dashed var(--border)", borderRadius: 12 }}>Pick an image in the Design panel</div>
      );
    case "sticker":
      return (
        <div style={{ display: "grid", placeItems: "center", height: fill ? "100%" : undefined }}>
          {p.sticker?.startsWith("/") || p.sticker?.startsWith("http") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.sticker} alt="" style={{ maxWidth: "100%", maxHeight: fill ? "100%" : 180, objectFit: "contain" }} draggable={false} />
          ) : (
            <span style={{ fontSize: fill ? "min(9rem, 70%)" : { s: "3rem", m: "5rem", l: "7rem", xl: "9rem" }[size], lineHeight: 1 }}>{p.sticker || "✨"}</span>
          )}
        </div>
      );
    case "divider":
      return <div className="fancy-divider" style={{ padding: "0.6rem 0" }}>{p.text || "✦"}</div>;
    case "links":
      return (
        <div className="stack" style={{ gap: "0.35rem" }}>
          {(p.links ?? []).length === 0 && <p className="muted small">Add links in the Design panel.</p>}
          {(p.links ?? []).map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="check-row" style={{ textDecoration: "none" }}>
              <ExternalLink size={14} /> <span className="grow">{l.label || hostname(l.url)}</span>
            </a>
          ))}
        </div>
      );
  }
}

function Hero() {
  const { trip, rows, view, nameOf, colorOf, profiles } = useTrip();
  const cover = view.theme.cover || trip?.cover_image;
  const going = rows.trip_members.filter((m) => m.attendance !== "not_going");
  return (
    <div className={clsx("hero-block", cover && "has-cover")} style={cover ? { backgroundImage: `url("${cover.replace(/"/g, "")}")` } : { background: "linear-gradient(135deg, var(--soft2), var(--soft))" }}>
      {!cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/stickers/watercolor-map.svg" alt="" style={{ position: "absolute", right: -40, top: -30, width: 360, opacity: 0.35 }} />
      )}
      <p className="day-num" style={cover ? { color: "#fff" } : undefined}>Driftbook</p>
      <h1>{trip?.name}</h1>
      <div className="row wrap" style={{ marginTop: "0.6rem", gap: "1rem", opacity: 0.92 }}>
        {trip?.destination && <span className="row"><MapPin size={16} /> {trip.destination}</span>}
        <span className="row"><CalendarDays size={16} /> {formatRange(trip?.start_date ?? null, trip?.end_date ?? null)}</span>
        <span className="avatar-stack">
          {going.map((m) => <Avatar key={m.user_id} name={nameOf(m.user_id)} color={colorOf(m.user_id)} src={profiles[m.user_id]?.avatar_url} size={30} />)}
        </span>
      </div>
    </div>
  );
}
