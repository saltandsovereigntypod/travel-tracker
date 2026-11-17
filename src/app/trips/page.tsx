"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, CalendarDays, MapPin, Loader2, ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { RequireAuth, TopBar } from "@/components/AppChrome";
import { InstallPrompt } from "@/components/InstallPrompt";
import { HomeFeed } from "@/components/home/HomeFeed";
import { useAuth } from "@/components/AuthProvider";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, Field } from "@/components/ui/Fields";
import { useToast } from "@/components/ui/Toast";
import { friendlyError, supabase } from "@/lib/supabase";
import { countdown, formatRange } from "@/lib/format";
import { CURRENCIES, searchPlaces } from "@/lib/services";
import { TEMPLATES, templateFor, type SpaceTemplate } from "@/lib/spaces";
import { LIST_TEMPLATES, SPACE_LISTS, buildLists } from "@/lib/list-templates";
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

function NewSpaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [tpl, setTpl] = useState<SpaceTemplate | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);

  function pick(t: SpaceTemplate) {
    setTpl(t);
    setIcon(t.icon);
  }

  function close() {
    setTpl(null);
    setName("");
    setDestination("");
    setStart("");
    setEnd("");
    onClose();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!tpl) return;
    const endDate = tpl.dates.single ? start : end;
    if (endDate && start && endDate < start) {
      toast.error("The end date is before the start date.");
      return;
    }
    setBusy(true);
    const sb = supabase();
    const { data: id, error } = await sb.rpc("create_space", {
      p_name: name.trim(),
      p_kind: tpl.kind,
      p_icon: icon,
      p_modules: [],
      p_destination: destination.trim(),
      p_start: start || null,
      p_end: endDate || null,
      p_currency: currency,
    });
    if (error || !id) {
      setBusy(false);
      toast.error(friendlyError(error));
      return;
    }
    // Starter lists for this kind of space (linked to each other where it makes sense).
    const starter = SPACE_LISTS[tpl.kind] ?? [];
    if (starter.length) {
      const { error: listErr } = await sb.from("lists").insert(buildLists(starter, id as string));
      if (listErr) toast.error(`Created, but the starter lists failed: ${friendlyError(listErr)}`);
    }
    if (destination.trim()) {
      searchPlaces(destination)
        .then((r) => r[0] && sb.from("trips").update({ lat: r[0].lat, lng: r[0].lng }).eq("id", id))
        .catch(() => {});
    }
    router.push(`/trips/${id}`);
  }

  const placeholders: Record<string, string> = {
    trip: "Salem Halloween 2027",
    wedding: "Our wedding",
    podcast: "Salt & Sovereignty · Season 3",
    household: "Our home",
    event: "Mom's 60th",
    blank: "Name it anything",
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={tpl ? <span className="row"><button className="icon-btn" onClick={() => setTpl(null)} aria-label="Back to templates"><ArrowLeft size={18} /></button> New {tpl.name.toLowerCase()}</span> : "What are you planning?"}
      size={tpl ? "md" : "lg"}
      footer={
        tpl && (
          <>
            <button className="btn" onClick={close} type="button">Cancel</button>
            <button className="btn btn-primary" form="new-space" disabled={busy || !name.trim()}>
              {busy && <Loader2 size={16} className="spin" />} Create
            </button>
          </>
        )
      }
    >
      {!tpl ? (
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.kind} className="template-card" onClick={() => pick(t)}>
              <span className="template-art" style={{ background: t.gradient }}>{t.icon}</span>
              <strong>{t.name}</strong>
              <span className="small muted">{t.description}</span>
            </button>
          ))}
        </div>
      ) : (
        <form id="new-space" className="form-grid" onSubmit={create}>
          <Field label="Name" full>
            <div className="row">
              <input className="input" style={{ width: 64, textAlign: "center", fontSize: "1.3rem" }} value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 4))} aria-label="Icon (emoji)" />
              <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholders[tpl.kind] ?? "Name"} required maxLength={120} autoFocus />
            </div>
          </Field>
          {tpl.location && (
            <Field label={tpl.location} full>
              <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={tpl.kind === "trip" ? "Salem, Massachusetts" : ""} />
            </Field>
          )}
          {tpl.dates.single ? (
            <Field label={`${tpl.dates.label} (optional)`}>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label={`${tpl.dates.label}: start (optional)`}>
                <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="End (optional)">
                <input className="input" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Currency" hint="Budget totals use this currency.">
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <p className="field-full small muted">
            Comes with: {tpl.modules.map((m) => m.label ?? m.id).map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(" · ")}
            {(SPACE_LISTS[tpl.kind] ?? []).length > 0 && <>, plus lists for {(SPACE_LISTS[tpl.kind] ?? []).map((k) => LIST_TEMPLATES.find((t) => t.key === k)?.name).join(", ")}</>}
            . Switch features on or off, rename them, and add more lists anytime.
          </p>
        </form>
      )}
    </Modal>
  );
}

export default function SpacesPage() {
  return (
    <RequireAuth>
      <SpacesInner />
    </RequireAuth>
  );
}
