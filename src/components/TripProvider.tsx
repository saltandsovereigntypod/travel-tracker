"use client";

// TripProvider loads one trip's shared information, keeps it live with Supabase
// Realtime, and exposes simple create/update/delete helpers to every section.
// It also holds the signed-in person's private view (theme + layouts).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { friendlyError, supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ui/Toast";
import type {
  Comment, Expense, Flight, Idea, Invite, ItineraryItem, Member, Note, PackingItem, Photo,
  Profile, Stay, Trip, TripView, Vote, Household, HouseholdMember,
} from "@/lib/types";
import type { ListDef, ListItem } from "@/lib/fields";
import type { Page } from "@/lib/pages";
import { resolveTheme } from "@/lib/themes";
import { defaultPageLayout, isUntouchedTripLayout, pageToBoard } from "@/lib/blocks";
import { resolveModules, templateFor, type ResolvedModule, type SpaceTemplate } from "@/lib/spaces";
import { voiceFor, type Voice } from "@/lib/voice";

export type TableName =
  | "ideas" | "idea_votes" | "itinerary_items" | "flights" | "stays" | "expenses"
  | "packing_items" | "notes" | "photos" | "comments" | "trip_members" | "trip_invites"
  | "lists" | "list_items" | "pages";

interface Rows {
  ideas: Idea[];
  idea_votes: Vote[];
  itinerary_items: ItineraryItem[];
  flights: Flight[];
  stays: Stay[];
  expenses: Expense[];
  packing_items: PackingItem[];
  notes: Note[];
  photos: Photo[];
  comments: Comment[];
  trip_members: Member[];
  trip_invites: Invite[];
  lists: ListDef[];
  list_items: ListItem[];
  pages: Page[];
}

type RowOf<T extends TableName> = Rows[T][number];

const TABLES: TableName[] = [
  "ideas", "idea_votes", "itinerary_items", "flights", "stays", "expenses",
  "packing_items", "notes", "photos", "comments", "trip_members", "trip_invites",
  "lists", "list_items", "pages",
];
const LIVE_TABLES = TABLES.filter((t) => t !== "trip_invites");

const emptyRows = (): Rows => ({
  ideas: [], idea_votes: [], itinerary_items: [], flights: [], stays: [], expenses: [],
  packing_items: [], notes: [], photos: [], comments: [], trip_members: [], trip_invites: [],
  lists: [], list_items: [], pages: [],
});

function keyOf(table: TableName, row: Record<string, unknown>): string {
  if (table === "idea_votes") return `${row.idea_id}:${row.user_id}`;
  if (table === "trip_members") return `${row.trip_id}:${row.user_id}`;
  return String(row.id);
}

function upsertRow<T extends Record<string, unknown>>(list: T[], table: TableName, row: T): T[] {
  const k = keyOf(table, row);
  const i = list.findIndex((r) => keyOf(table, r) === k);
  if (i === -1) return [...list, row];
  const copy = list.slice();
  copy[i] = { ...copy[i], ...row };
  return copy;
}

function removeRow<T extends Record<string, unknown>>(list: T[], table: TableName, row: Record<string, unknown>): T[] {
  const k = keyOf(table, row);
  return list.filter((r) => keyOf(table, r) !== k);
}

export interface PresenceUser {
  user_id: string;
  name: string;
  color: string;
  page: string;
}

interface TripContextValue {
  tripId: string;
  loading: boolean;
  error: string | null;
  offline: boolean;
  trip: Trip | null;
  rows: Rows;
  profiles: Record<string, Profile>;
  me: string;
  myRole: Member["role"] | null;
  canEdit: boolean;
  isOwner: boolean;
  online: PresenceUser[];
  view: TripView;
  setPresencePage: (page: string) => void;
  nameOf: (userId: string | null | undefined) => string;
  colorOf: (userId: string | null | undefined) => string;
  insert: <T extends TableName>(table: T, row: Partial<RowOf<T>>) => Promise<RowOf<T> | null>;
  update: <T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>) => Promise<boolean>;
  remove: (table: TableName, id: string) => Promise<boolean>;
  updateTrip: (patch: Partial<Trip>) => Promise<boolean>;
  saveView: (patch: Partial<Omit<TripView, "id" | "trip_id" | "user_id">>) => void;
  vote: (ideaId: string, value: 1 | -1 | 0) => Promise<void>;
  photoUrl: (path: string) => string | undefined;
  ensurePhotoUrls: (paths: string[]) => Promise<void>;
  reload: () => Promise<void>;
  /** Households (couples, families) that trip members belong to. */
  households: Household[];
  householdMembers: HouseholdMember[];
  /** Household id for a person, or null if they don't share money with anyone. */
  householdOf: (userId: string) => string | null;
  /** Party id used for settling up: the household id, or the person's own id. */
  partyOf: (userId: string) => string;
  partyName: (partyId: string) => string;
  /** Everyone marked as going (the default for "who's doing this"). */
  goingIds: string[];
  reloadHouseholds: () => Promise<void>;
  /** Modules switched on for this space, in nav order. */
  modules: ResolvedModule[];
  hasModule: (id: string) => boolean;
  /** How this kind of space talks (page hints, buttons, categories). */
  voice: Voice;
  moduleName: (id: string, fallback?: string) => string;
  template: SpaceTemplate;
  /** "trip", "wedding", "show"… */
  noun: string;
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ tripId, children }: { tripId: string; children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const me = user?.id ?? "";
  const [trip, setTrip] = useState<Trip | null>(null);
  const [rows, setRows] = useState<Rows>(emptyRows);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [view, setView] = useState<TripView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, { url: string; at: number }>>({});
  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const presencePage = useRef("home");
  const viewRef = useRef<TripView | null>(null);
  const snapshotKey = `driftbook:trip:${tripId}:${me}`;

  // ---------------------------------------------------------------- loading
  const loadHouseholds = useCallback(async (ids: string[]) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const sb = supabase();
    const { data: mine } = await sb.from("household_members").select("*").in("user_id", unique);
    const hids = [...new Set(((mine as HouseholdMember[]) ?? []).map((m) => m.household_id))];
    if (!hids.length) {
      setHouseholds([]);
      setHouseholdMembers([]);
      return;
    }
    const [hs, all] = await Promise.all([
      sb.from("households").select("id, name, created_by").in("id", hids),
      sb.from("household_members").select("*").in("household_id", hids),
    ]);
    setHouseholds((hs.data as Household[]) ?? []);
    setHouseholdMembers((all.data as HouseholdMember[]) ?? []);
  }, []);

  const loadProfiles = useCallback(async (ids: string[]) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const { data } = await supabase().from("profiles").select("id, display_name, avatar_url").in("id", unique);
    if (data) setProfiles((p) => ({ ...p, ...Object.fromEntries((data as Profile[]).map((x) => [x.id, x])) }));
  }, []);

  const load = useCallback(async () => {
    if (!me) return;
    const sb = supabase();
    const tripRes = await sb.from("trips").select("*").eq("id", tripId).maybeSingle();
    if (tripRes.error) {
      // Probably offline: fall back to the last snapshot.
      const snap = typeof window !== "undefined" ? localStorage.getItem(snapshotKey) : null;
      if (snap) {
        const s = JSON.parse(snap);
        setTrip(s.trip);
        setRows({ ...emptyRows(), ...s.rows });
        setProfiles(s.profiles ?? {});
        setView(s.view ?? null);
        setOffline(true);
      } else {
        setError(friendlyError(tripRes.error));
      }
      setLoading(false);
      return;
    }
    if (!tripRes.data) {
      setError("This trip doesn't exist, or you haven't been invited to it yet.");
      setLoading(false);
      return;
    }
    const results = await Promise.all(
      TABLES.map((t) => {
        let q = sb.from(t).select("*").eq("trip_id", tripId);
        if (t === "itinerary_items" || t === "packing_items" || t === "lists" || t === "list_items" || t === "pages") q = q.order("sort_order");
        else if (t === "trip_members") q = q.order("joined_at");
        else q = q.order("created_at");
        return q;
      }),
    );
    const next = emptyRows();
    results.forEach((r, i) => {
      // Viewers can't read invites; that's fine.
      if (!r.error) (next as unknown as Record<string, unknown[]>)[TABLES[i]] = r.data ?? [];
    });
    const viewRes = await sb.from("trip_views").select("*").eq("trip_id", tripId).eq("user_id", me).maybeSingle();
    setTrip(tripRes.data as Trip);
    setRows(next);
    setView((viewRes.data as TripView) ?? null);
    setOffline(false);
    setError(null);
    setLoading(false);
    await Promise.all([
      loadProfiles(next.trip_members.map((m) => m.user_id)),
      loadHouseholds(next.trip_members.map((m) => m.user_id)),
    ]);
  }, [me, tripId, snapshotKey, loadProfiles, loadHouseholds]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Keep an offline snapshot of everything we can see.
  useEffect(() => {
    if (loading || offline || !trip) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(snapshotKey, JSON.stringify({ trip, rows, profiles, view, at: Date.now() }));
      } catch {
        /* storage full or disabled */
      }
    }, 800);
    return () => clearTimeout(id);
  }, [trip, rows, profiles, view, loading, offline, snapshotKey]);

  // Presence ("who's here, on which page"). Supabase rate-limits presence updates and
  // closes the channel if we send too many, so only send real changes, at most ~1/sec.
  const presenceInfo = useRef({ name: "", color: "" });
  const lastPresence = useRef("");
  const presenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackPresence = useCallback(() => {
    if (presenceTimer.current) clearTimeout(presenceTimer.current);
    presenceTimer.current = setTimeout(() => {
      const payload = { user_id: me, ...presenceInfo.current, page: presencePage.current };
      const key = JSON.stringify(payload);
      if (key === lastPresence.current || !channelRef.current) return;
      lastPresence.current = key;
      void channelRef.current.track(payload);
    }, 1000);
  }, [me]);
  // ---------------------------------------------------------------- realtime
  useEffect(() => {
    if (!me || !tripId) return;
    const sb = supabase();
    const channel = sb.channel(`trip:${tripId}`, { config: { presence: { key: me } } });
    let subscribedOnce = false;

    for (const table of LIVE_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter: `trip_id=eq.${tripId}` },
        (payload) => setRows((r) => ({ ...r, [table]: upsertRow(r[table] as never[], table, payload.new as never) })),
      );
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table, filter: `trip_id=eq.${tripId}` },
        (payload) => setRows((r) => ({ ...r, [table]: upsertRow(r[table] as never[], table, payload.new as never) })),
      );
      // Delete events can't be filtered server-side; they only carry the primary key.
      channel.on("postgres_changes", { event: "DELETE", schema: "public", table }, (payload) =>
        setRows((r) => ({ ...r, [table]: removeRow(r[table] as never[], table, payload.old) })),
      );
    }
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` }, (payload) =>
      setTrip((t) => (t ? { ...t, ...(payload.new as Trip) } : t)),
    );
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceUser>();
      const list = Object.values(state)
        .map((entries) => entries[entries.length - 1])
        .filter(Boolean) as PresenceUser[];
      setOnline(list);
    });
    let cancelled = false;
    // Attach the signed-in token before joining; otherwise the database sees an
    // anonymous listener and row-level security filters out every change.
    sb.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session) await sb.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (subscribedOnce) void load(); // catch up on anything missed while disconnected
          subscribedOnce = true;
          lastPresence.current = "";
          trackPresence();
        }
      });
    });
    channelRef.current = channel;
    return () => {
      cancelled = true;
      channelRef.current = null;
      void sb.removeChannel(channel);
    };
  }, [me, tripId, load, trackPresence]);

  // New members joined -> fetch their profiles.
  useEffect(() => {
    const missing = rows.trip_members.map((m) => m.user_id).filter((id) => !profiles[id]);
    if (missing.length) void loadProfiles(missing);
  }, [rows.trip_members, profiles, loadProfiles]);

  // Refresh when the tab comes back after a while (phones suspend websockets).
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) void load();
    };
    const onOnline = () => void load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
    };
  }, [load]);

  // ---------------------------------------------------------------- helpers
  const members = rows.trip_members;
  const myMember = members.find((m) => m.user_id === me) ?? null;
  const myRole = myMember?.role ?? null;
  const canEdit = myRole === "owner" || myRole === "editor";
  const isOwner = myRole === "owner";

  const nameOf = useCallback(
    (id: string | null | undefined) => {
      if (!id) return "Someone";
      if (id === me) return profile?.display_name ?? profiles[id]?.display_name ?? "You";
      return profiles[id]?.display_name ?? "Traveler";
    },
    [profiles, me, profile],
  );
  const colorOf = useCallback(
    (id: string | null | undefined) => members.find((m) => m.user_id === id)?.color ?? "#9CA3AF",
    [members],
  );

  const myName = nameOf(me);
  const myColor = colorOf(me);
  useEffect(() => {
    presenceInfo.current = { name: myName, color: myColor };
    trackPresence();
  }, [myName, myColor, trackPresence]);
  const setPresencePage = useCallback(
    (page: string) => {
      presencePage.current = page;
      trackPresence();
    },
    [trackPresence],
  );

  const insert = useCallback(
    async <T extends TableName>(table: T, row: Partial<RowOf<T>>): Promise<RowOf<T> | null> => {
      const { data, error: err } = await supabase()
        .from(table)
        .insert({ trip_id: tripId, ...row })
        .select()
        .single();
      if (err) {
        toast.error(friendlyError(err));
        return null;
      }
      setRows((r) => ({ ...r, [table]: upsertRow(r[table] as never[], table, data as never) }));
      return data as RowOf<T>;
    },
    [tripId, toast],
  );

  const update = useCallback(
    async <T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>): Promise<boolean> => {
      // Optimistic: apply locally first, roll back on failure.
      let before: unknown;
      setRows((r) => {
        const list = r[table] as unknown as Record<string, unknown>[];
        before = list.find((x) => x.id === id);
        return { ...r, [table]: list.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
      });
      const { error: err } = await supabase().from(table).update(patch as Record<string, unknown>).eq("id", id);
      if (err) {
        if (before) setRows((r) => ({ ...r, [table]: upsertRow(r[table] as never[], table, before as never) }));
        toast.error(friendlyError(err));
        return false;
      }
      return true;
    },
    [toast],
  );

  const remove = useCallback(
    async (table: TableName, id: string): Promise<boolean> => {
      const { error: err } = await supabase().from(table).delete().eq("id", id);
      if (err) {
        toast.error(friendlyError(err));
        return false;
      }
      setRows((r) => ({ ...r, [table]: removeRow(r[table] as never[], table, { id }) }));
      return true;
    },
    [toast],
  );

  const updateTrip = useCallback(
    async (patch: Partial<Trip>) => {
      setTrip((t) => (t ? { ...t, ...patch } : t));
      const { error: err } = await supabase().from("trips").update(patch).eq("id", tripId);
      if (err) {
        toast.error(friendlyError(err));
        void load();
        return false;
      }
      return true;
    },
    [tripId, toast, load],
  );

  const vote = useCallback(
    async (ideaId: string, value: 1 | -1 | 0) => {
      const sb = supabase();
      const row = { idea_id: ideaId, trip_id: tripId, user_id: me, value };
      if (value === 0) {
        setRows((r) => ({ ...r, idea_votes: removeRow(r.idea_votes as never[], "idea_votes", row) }));
        const { error: err } = await sb.from("idea_votes").delete().eq("idea_id", ideaId).eq("user_id", me);
        if (err) toast.error(friendlyError(err));
        return;
      }
      setRows((r) => ({ ...r, idea_votes: upsertRow(r.idea_votes as never[], "idea_votes", row as never) }));
      const { error: err } = await sb.from("idea_votes").upsert(row, { onConflict: "idea_id,user_id" });
      if (err) toast.error(friendlyError(err));
    },
    [tripId, me, toast],
  );

  // Personal view: debounce saves so dragging doesn't spam the database.
  const viewSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingView = useRef<Partial<TripView>>({});
  const tripKindRef = useRef<string | null>(null);
  useEffect(() => {
    tripKindRef.current = trip?.kind ?? null;
  }, [trip?.kind]);
  const saveView = useCallback(
    (patch: Partial<Omit<TripView, "id" | "trip_id" | "user_id">>) => {
      setView((v) => ({ ...(v ?? viewRef.current ?? defaultView(tripId, me, tripKindRef.current)), ...patch }) as TripView);
      pendingView.current = { ...pendingView.current, ...patch };
      if (viewSaveTimer.current) clearTimeout(viewSaveTimer.current);
      viewSaveTimer.current = setTimeout(async () => {
        // First save creates the row, so send the whole view, not just the change.
        const body = viewRef.current?.id ? pendingView.current : { ...viewRef.current, ...pendingView.current };
        delete (body as Partial<TripView>).id;
        delete (body as Partial<TripView>).updated_at;
        pendingView.current = {};
        const { data, error: err } = await supabase()
          .from("trip_views")
          .upsert({ trip_id: tripId, user_id: me, ...body }, { onConflict: "trip_id,user_id" })
          .select()
          .single();
        if (err) toast.error(`Couldn't save your design: ${friendlyError(err)}`);
        else if (data) setView((v) => ({ ...(v as TripView), id: (data as TripView).id }));
      }, 600);
    },
    [tripId, me, toast],
  );

  const ensurePhotoUrls = useCallback(
    async (paths: string[]) => {
      const now = Date.now();
      const need = paths.filter((p) => !photoUrls[p] || now - photoUrls[p].at > 50 * 60_000);
      if (!need.length) return;
      const { data } = await supabase().storage.from("trip-media").createSignedUrls(need, 3600);
      if (data) {
        setPhotoUrls((u) => {
          const copy = { ...u };
          data.forEach((d) => {
            if (d.signedUrl && d.path) copy[d.path] = { url: d.signedUrl, at: now };
          });
          return copy;
        });
      }
    },
    [photoUrls],
  );
  const photoUrl = useCallback((path: string) => photoUrls[path]?.url, [photoUrls]);

  const goingIds = useMemo(
    () => rows.trip_members.filter((m) => m.attendance === "going").map((m) => m.user_id),
    [rows.trip_members],
  );
  const householdOf = useCallback(
    (userId: string) => householdMembers.find((m) => m.user_id === userId && m.status === "accepted")?.household_id ?? null,
    [householdMembers],
  );
  const partyOf = useCallback((userId: string) => householdOf(userId) ?? userId, [householdOf]);
  const partyName = useCallback(
    (partyId: string) => {
      const h = households.find((x) => x.id === partyId);
      if (!h) return nameOf(partyId);
      if (h.name.trim()) return h.name;
      const names = householdMembers.filter((m) => m.household_id === partyId && m.status === "accepted").map((m) => nameOf(m.user_id).split(" ")[0]);
      return names.join(" & ") || "Household";
    },
    [households, householdMembers, nameOf],
  );
  const reloadHouseholds = useCallback(() => loadHouseholds(rows.trip_members.map((m) => m.user_id)), [loadHouseholds, rows.trip_members]);

  const modules = useMemo(() => resolveModules(trip), [trip]);
  const template = useMemo(() => templateFor(trip?.kind), [trip?.kind]);
  const hasModule = useCallback((id: string) => modules.some((m) => m.id === id), [modules]);
  const voice = useMemo(() => voiceFor(trip?.kind), [trip?.kind]);
  const moduleName = useCallback(
    (id: string, fallback?: string) => modules.find((m) => m.id === id)?.name ?? fallback ?? id,
    [modules],
  );

  const tripKind = trip?.kind ?? null;
  const resolvedView = useMemo(() => {
    const base = defaultView(tripId, me, tripKind);
    if (!view) return base;
    // A view still on the old trip layout (never customized) gets this kind's own home instead.
    const untouched = tripKind && tripKind !== "trip" && isUntouchedTripLayout(view.page_layout);
    const page = view.page_layout?.length && !untouched ? view.page_layout : base.page_layout;
    return {
      ...view,
      theme: resolveTheme(view.theme),
      page_layout: page,
      board_layout: view.board_layout?.length ? view.board_layout : pageToBoard(page),
    };
  }, [view, tripId, me, tripKind]);
  useEffect(() => {
    viewRef.current = resolvedView;
  }, [resolvedView]);

  const value: TripContextValue = {
    tripId, loading, error, offline, trip, rows, profiles, me, myRole, canEdit, isOwner, online,
    view: resolvedView, setPresencePage, nameOf, colorOf, insert, update, remove, updateTrip,
    saveView, vote, photoUrl, ensurePhotoUrls, reload: load,
    households, householdMembers, householdOf, partyOf, partyName, goingIds, reloadHouseholds,
    modules, hasModule, moduleName, template, noun: template.noun, voice,
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

function defaultView(tripId: string, me: string, kind?: string | null): TripView {
  const page = defaultPageLayout(kind);
  return {
    id: "",
    trip_id: tripId,
    user_id: me,
    mode: "page",
    theme: resolveTheme(null),
    page_layout: page,
    board_layout: pageToBoard(page),
    updated_at: new Date().toISOString(),
  };
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used inside TripProvider");
  return ctx;
}
