"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Sun, Lightbulb, CalendarDays, Plane, BedDouble, Wallet, Luggage, Map, NotebookPen,
  Camera, Users, BookHeart, Settings2, MoreHorizontal, Loader2, WifiOff,
} from "lucide-react";
import clsx from "clsx";
import { TopBar } from "./AppChrome";
import { useTrip } from "./TripProvider";
import { Avatar } from "./ui/Fields";
import { Modal } from "./ui/Modal";
import { NewListModal } from "./lists/NewListModal";
import { NewPageModal } from "./pages/PagesIndex";
import { breadcrumbs, childPages } from "@/lib/pages";
import { Plus } from "lucide-react";
import { fontHref, readableOn, themeVars } from "@/lib/themes";

export const MODULE_ICONS: Record<string, typeof Home> = {
  today: Sun,
  ideas: Lightbulb,
  itinerary: CalendarDays,
  flights: Plane,
  stays: BedDouble,
  budget: Wallet,
  packing: Luggage,
  map: Map,
  notes: NotebookPen,
  photos: Camera,
  scrapbook: BookHeart,
};

interface NavItem {
  slug: string;
  label: string;
  icon: typeof Home;
}

/** Navigation for a space: My view, its switched-on modules, then people and settings. */
export function useSpaceNav(): NavItem[] {
  const { modules, template } = useTrip();
  const noun = template.noun.charAt(0).toUpperCase() + template.noun.slice(1);
  return useMemo(
    () => [
      { slug: "", label: "My view", icon: Home },
      ...modules.map((m) => ({ slug: m.slug, label: m.name, icon: MODULE_ICONS[m.id] ?? Sun })),
      { slug: "people", label: "People & sharing", icon: Users },
      { slug: "settings", label: `${noun} settings`, icon: Settings2 },
    ],
    [modules, noun],
  );
}


export function TripShell({ children }: { children: React.ReactNode }) {
  const { trip, loading, error, offline, view, online, me, tripId, setPresencePage, nameOf, colorOf, noun, rows, canEdit } = useTrip();
  const NAV = useSpaceNav();
  // Phone bottom bar: home plus the first three modules (skipping Today, which lives on Home).
  const MOBILE_MAIN = ["", ...NAV.filter((n) => n.slug && n.slug !== "today" && n.slug !== "people" && n.slug !== "settings").slice(0, 3).map((n) => n.slug)];
  const pathname = usePathname();
  const base = `/trips/${tripId}`;
  const parts = pathname.replace(base, "").replace(/^\//, "").split("/");
  const current = parts[0];
  const currentList = current === "lists" ? parts[1] : null;
  const currentPage = current === "pages" ? parts[1] ?? null : null;
  const [moreOpen, setMoreOpen] = useState(false);
  const [newList, setNewList] = useState(false);
  const [newPage, setNewPage] = useState(false);
  const theme = view.theme as Required<typeof view.theme>;

  useEffect(() => {
    setPresencePage(current || "home");
  }, [current, setPresencePage]);

  // Load only the fonts this person's theme uses.
  const href = fontHref([theme.headingFont, theme.bodyFont]);
  useEffect(() => {
    if (!href) return;
    const id = "theme-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [href]);

  const style = useMemo(() => ({ ...themeVars(theme as never), "--on-accent": readableOn(theme.accent) }) as React.CSSProperties, [theme]);

  const others = online.filter((p) => p.user_id !== me);

  if (loading) {
    return (
      <div className="auth-wrap">
        <Loader2 className="spin" />
      </div>
    );
  }
  if (error || !trip) {
    return (
      <>
        <TopBar />
        <div className="auth-wrap" style={{ minHeight: "60dvh" }}>
          <div className="card auth-card" style={{ textAlign: "center", padding: "2rem" }}>
            <h2>Can&apos;t open this {noun}</h2>
            <p className="muted" style={{ margin: "0.6rem 0 1rem" }}>{error}</p>
            <Link className="btn btn-primary" href="/trips">Back to my trips</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <div id="theme-root" style={style} data-card={theme.cardStyle}>
      <TopBar>
        <Link href={base} className="truncate heading" style={{ fontSize: "1.05rem", textDecoration: "none", fontWeight: 700 }}>
          {trip.name}
        </Link>
        <div className="grow" />
        {others.length > 0 && (
          <div className="presence-bar" title="Here right now">
            <span className="tiny muted hide-sm">Here now</span>
            <div className="avatar-stack">
              {others.slice(0, 5).map((p) => (
                <Avatar
                  key={p.user_id}
                  name={nameOf(p.user_id)}
                  color={colorOf(p.user_id)}
                  size={28}
                  ring
                  title={`${nameOf(p.user_id)} is on ${NAV.find((n) => n.slug === (p.page === "home" ? "" : p.page))?.label ?? `the ${noun}`}`}
                />
              ))}
            </div>
          </div>
        )}
      </TopBar>
      {offline && (
        <div className="offline-banner">
          <WifiOff size={14} style={{ display: "inline", verticalAlign: "-2px" }} /> You&apos;re offline. Showing the last saved copy; changes are paused.
        </div>
      )}
      <div className="trip-layout">
        <nav className="sidenav" aria-label="Trip sections">
          {NAV.map((n, i) => {
            const here = others.filter((p) => (p.page === "home" ? "" : p.page) === n.slug);
            return (
              <div key={n.slug}>
                {i === NAV.length - 2 && (
                  <>
                    {(rows.pages.length > 0 || canEdit) && (
                      <>
                        <Link href={`${base}/pages`} className="nav-label nav-label-link">Pages</Link>
                        <PageTree base={base} pages={rows.pages} current={currentPage} />
                        {canEdit && (
                          <button className="nav-add" onClick={() => setNewPage(true)}>
                            <Plus size={16} /> New page
                          </button>
                        )}
                      </>
                    )}
                    <div className="nav-label">Lists</div>
                    {rows.lists.map((l) => (
                      <Link key={l.id} href={`${base}/lists/${l.id}`} className={clsx(currentList === l.id && "active")}>
                        <span aria-hidden style={{ width: 18, textAlign: "center" }}>{l.icon}</span>
                        <span className="truncate">{l.name}</span>
                      </Link>
                    ))}
                    {canEdit && (
                      <button className="nav-add" onClick={() => setNewList(true)}>
                        <Plus size={16} /> New list
                      </button>
                    )}
                    <div className="nav-label">{noun}</div>
                  </>
                )}
                <Link href={n.slug ? `${base}/${n.slug}` : base} className={clsx(current === n.slug && "active")}>
                  <n.icon size={18} />
                  {n.label}
                  {here.length > 0 && (
                    <span className="presence-dot">
                      {here.slice(0, 3).map((p) => (
                        <span key={p.user_id} title={nameOf(p.user_id)} style={{ width: 8, height: 8, borderRadius: 9, background: colorOf(p.user_id), marginLeft: 2 }} />
                      ))}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
        <main className="main">{children}</main>
      </div>
      <nav className="bottomnav" aria-label="Trip sections">
        {NAV.filter((n) => MOBILE_MAIN.includes(n.slug)).map((n) => (
          <Link key={n.slug} href={n.slug ? `${base}/${n.slug}` : base} className={clsx(current === n.slug && "active")}>
            <n.icon size={20} />
            {n.slug === "" ? "Home" : n.label}
          </Link>
        ))}
        <button onClick={() => setMoreOpen(true)} className={clsx(!MOBILE_MAIN.includes(current) && "active")}>
          <MoreHorizontal size={20} />
          More
        </button>
      </nav>
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Go to">
        <div className="more-sheet">
          {NAV.filter((n) => !MOBILE_MAIN.includes(n.slug)).map((n) => (
            <Link key={n.slug} href={`${base}/${n.slug}`} onClick={() => setMoreOpen(false)}>
              <n.icon size={22} />
              {n.label}
            </Link>
          ))}
        </div>
        {(rows.pages.length > 0 || canEdit) && (
          <>
            <div className="nav-label" style={{ padding: "1rem 0 0.4rem" }}>Pages</div>
            <div className="more-sheet">
              {childPages(rows.pages, null).map((p) => (
                <Link key={p.id} href={`${base}/pages/${p.id}`} onClick={() => setMoreOpen(false)}>
                  <span style={{ fontSize: 22 }} aria-hidden>{p.icon}</span>
                  <span className="truncate" style={{ maxWidth: "100%" }}>{p.title || "Untitled"}</span>
                </Link>
              ))}
              {canEdit && (
                <button className="more-add" onClick={() => { setMoreOpen(false); setNewPage(true); }}>
                  <Plus size={22} />
                  New page
                </button>
              )}
            </div>
          </>
        )}
        {(rows.lists.length > 0 || canEdit) && (
          <>
            <div className="nav-label" style={{ padding: "1rem 0 0.4rem" }}>Lists</div>
            <div className="more-sheet">
              {rows.lists.map((l) => (
                <Link key={l.id} href={`${base}/lists/${l.id}`} onClick={() => setMoreOpen(false)}>
                  <span style={{ fontSize: 22 }} aria-hidden>{l.icon}</span>
                  {l.name}
                </Link>
              ))}
              {canEdit && (
                <button className="more-add" onClick={() => { setMoreOpen(false); setNewList(true); }}>
                  <Plus size={22} />
                  New list
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
      <NewListModal open={newList} onClose={() => setNewList(false)} />
      <NewPageModal open={newPage} onClose={() => setNewPage(false)} />
    </div>
  );
}

/** Top-level pages, with the open page's branch expanded. */
function PageTree({ base, pages, current }: { base: string; pages: import("@/lib/pages").Page[]; current: string | null }) {
  const open = new Set(current ? breadcrumbs(pages, current).map((p) => p.id) : []);
  const render = (parent: string | null, depth: number): React.ReactNode =>
    childPages(pages, parent).map((p) => (
      <div key={p.id}>
        <Link href={`${base}/pages/${p.id}`} className={clsx(current === p.id && "active")} style={depth ? { paddingLeft: `${0.75 + depth * 0.9}rem` } : undefined}>
          <span aria-hidden style={{ width: 18, textAlign: "center" }}>{p.icon}</span>
          <span className="truncate">{p.title || "Untitled"}</span>
        </Link>
        {open.has(p.id) && depth < 4 && render(p.id, depth + 1)}
      </div>
    ));
  return <>{render(null, 0)}</>;
}
