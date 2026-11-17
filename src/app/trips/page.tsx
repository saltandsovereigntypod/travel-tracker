"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, CalendarDays, MapPin, Loader2 } from "lucide-react";
import { RequireAuth, TopBar } from "@/components/AppChrome";
import { InstallPrompt } from "@/components/InstallPrompt";
import { HomeFeed } from "@/components/home/HomeFeed";
import { NewSpaceModal } from "@/components/spaces/NewSpaceModal";
import { useAuth } from "@/components/AuthProvider";
import { EmptyState } from "@/components/ui/Fields";
import { supabase } from "@/lib/supabase";
import { countdown, formatRange } from "@/lib/format";
import { templateFor } from "@/lib/spaces";
import type { Member, Trip } from "@/lib/types";

type SpaceWithRole = Trip & { role: Member["role"]; attendance: Member["attendance"] };

function SpacesInner() {
  const { user, profile } = useAuth();
  const [spaces, setSpaces] = useState<SpaceWithRole[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [householdInvite, setHouseholdInvite] = useState(false);

  useEffect(() => {
    supabase()
      .from("household_members")
      .select("household_id")
      .eq("user_id", user!.id)
      .eq("status", "pending")
      .then(({ data }) => setHouseholdInvite(!!data?.length));
  }, [user]);

  const load = useCallback(async () => {
    const { data, error } = await supabase()
      .from("trip_members")
      .select("role, attendance, trips(*)")
      .eq("user_id", user!.id);
    if (error) {
      setSpaces([]);
      return;
    }
    const list = (data as unknown as { role: Member["role"]; attendance: Member["attendance"]; trips: Trip }[])
      .filter((r) => r.trips)
      .map((r) => ({ ...r.trips, role: r.role, attendance: r.attendance }))
      .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999") || a.name.localeCompare(b.name));
    setSpaces(list);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const dated = spaces?.filter((t) => t.start_date && countdown(t.start_date, t.end_date).phase !== "after") ?? [];
  const ongoing = spaces?.filter((t) => !t.start_date) ?? [];
  const past = spaces?.filter((t) => t.start_date && countdown(t.start_date, t.end_date).phase === "after") ?? [];

  return (
    <>
      <TopBar />
      <main className="main main-narrow">
        <div className="section-head">
          <div>
            <h1>Hi {profile?.display_name?.split(" ")[0] ?? "there"} 👋</h1>
            <p>Everything you&apos;re planning, shared with your people.</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setCreating(true)}>
            <Plus size={18} /> New
          </button>
        </div>

        <InstallPrompt />
        {householdInvite && (
          <div className="card card-tight row wrap" style={{ marginBottom: "1rem", background: "var(--soft)" }}>
            <span className="grow small">💞 Someone wants to link households with you, so you settle up together on shared plans.</span>
            <Link className="btn btn-sm btn-primary" href="/settings">Review</Link>
          </div>
        )}
        {spaces === null ? (
          <Loader2 className="spin" />
        ) : spaces.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<MapPin />}
              title="Nothing here yet"
              action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Start something</button>}
            >
              A trip, a wedding, a podcast season, your household… start from a template and invite your people.
            </EmptyState>
          </div>
        ) : (
          <>
            <HomeFeed spaces={spaces} />
            <h2 style={{ margin: "0.4rem 0 0.9rem" }}>Your spaces</h2>
            {dated.length > 0 && <SpaceGrid spaces={dated} title={ongoing.length ? "Coming up" : undefined} />}
            {ongoing.length > 0 && <SpaceGrid spaces={ongoing} title={dated.length ? "Ongoing" : undefined} />}
            {past.length > 0 && <SpaceGrid spaces={past} title="Memories" />}
          </>
        )}
      </main>
      <NewSpaceModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function SpaceGrid({ spaces, title }: { spaces: SpaceWithRole[]; title?: string }) {
  return (
    <section style={{ marginBottom: "1.6rem" }}>
      {title && <h2 style={{ margin: "0.4rem 0 0.9rem" }}>{title}</h2>}
      <div className="grid-cards">
        {spaces.map((t) => {
          const tpl = templateFor(t.kind);
          const c = countdown(t.start_date, t.end_date);
          const label =
            c.phase === "before" ? `${c.days} day${c.days === 1 ? "" : "s"} to go` :
            c.phase === "during" ? (t.start_date === t.end_date ? "Today!" : `Day ${c.days} of ${c.total}`) :
            c.phase === "after" ? "Memory" : tpl.name;
          return (
            <Link key={t.id} href={`/trips/${t.id}`} className="card card-hover trip-card">
              <div className="trip-cover" style={t.cover_image ? { backgroundImage: `url("${t.cover_image}")` } : { background: tpl.gradient }}>
                <span className="chip">{label}</span>
                <span className="space-icon" aria-hidden>{t.icon || tpl.icon}</span>
              </div>
              <div className="trip-card-body">
                <h3>{t.name}</h3>
                {t.destination && <span className="muted small row"><MapPin size={14} /> {t.destination}</span>}
                {t.start_date && <span className="muted small row"><CalendarDays size={14} /> {formatRange(t.start_date, t.end_date)}</span>}
                <span className="row" style={{ marginTop: 4 }}>
                  <span className="chip chip-muted">{tpl.name}</span>
                  <span className="chip chip-muted">{t.role}</span>
                  {t.attendance === "maybe" && <span className="chip chip-2">maybe</span>}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function SpacesPage() {
  return (
    <RequireAuth>
      <SpacesInner />
    </RequireAuth>
  );
}
