"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";
import { addDays, todayString } from "@/lib/format";
import { calendarEntries, isDone, type ListDef, type ListItem } from "@/lib/fields";
import type { ItineraryItem } from "@/lib/types";

const ON_KEY = "driftbook:reminders";
const LAST_KEY = "driftbook:reminders-last";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

/** What's due today and tomorrow across every space you're in. */
async function dueSoon(userId: string): Promise<{ today: string[]; tomorrow: string[] }> {
  const sb = supabase();
  const today = todayString();
  const tomorrow = addDays(today, 1);
  const { data: m } = await sb.from("trip_members").select("trip_id").eq("user_id", userId);
  const ids = (m ?? []).map((x) => x.trip_id as string);
  if (!ids.length) return { today: [], tomorrow: [] };
  const [lists, items, plans] = await Promise.all([
    sb.from("lists").select("*").in("trip_id", ids),
    sb.from("list_items").select("*").in("trip_id", ids),
    sb.from("itinerary_items").select("*").in("trip_id", ids).gte("day", today).lte("day", tomorrow),
  ]);
  const out = { today: [] as string[], tomorrow: [] as string[] };
  for (const c of calendarEntries({ lists: (lists.data as ListDef[]) ?? [], items: (items.data as ListItem[]) ?? [] }, { from: today, to: tomorrow })) {
    if (isDone(c.item, c.list)) continue;
    (c.day === today ? out.today : out.tomorrow).push(`${c.list.icon} ${c.item.title || c.list.name}`);
  }
  for (const p of (plans.data as ItineraryItem[]) ?? []) (p.day === today ? out.today : out.tomorrow).push(p.title);
  return out;
}

async function notify(title: string, body: string) {
  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  // Phones need notifications to come from the service worker.
  if (reg) await reg.showNotification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "driftbook-daily" });
  else new Notification(title, { body, icon: "/icon-192.png" });
}

/** Runs quietly in the background: at most one summary per day while Driftbook is open. */
export function ReminderChecker() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || typeof Notification === "undefined") return;
    if (read(ON_KEY) !== "1" || Notification.permission !== "granted") return;
    if (read(LAST_KEY) === todayString()) return;
    let alive = true;
    dueSoon(user.id).then(async ({ today, tomorrow }) => {
      if (!alive) return;
      write(LAST_KEY, todayString());
      if (!today.length && !tomorrow.length) return;
      const parts = [];
      if (today.length) parts.push(`Today: ${today.slice(0, 4).join(", ")}${today.length > 4 ? ` +${today.length - 4}` : ""}`);
      if (tomorrow.length) parts.push(`Tomorrow: ${tomorrow.slice(0, 3).join(", ")}${tomorrow.length > 3 ? ` +${tomorrow.length - 3}` : ""}`);
      await notify(today.length ? `${today.length} thing${today.length === 1 ? "" : "s"} due today` : "Coming up tomorrow", parts.join("\n"));
    });
    return () => {
      alive = false;
    };
  }, [user]);
  return null;
}

/** Settings card to switch reminders on for this device. */
export function RemindersCard() {
  const [supported, setSupported] = useState(true);
  const [on, setOn] = useState(false);
  const [permission, setPermission] = useState<string>("default");
  useEffect(() => {
    if (typeof Notification === "undefined") {
      queueMicrotask(() => setSupported(false));
      return;
    }
    queueMicrotask(() => {
      setPermission(Notification.permission);
      setOn(read(ON_KEY) === "1" && Notification.permission === "granted");
    });
  }, []);

  async function enable() {
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      write(ON_KEY, "1");
      write(LAST_KEY, "");
      setOn(true);
      await notify("Reminders are on", "Driftbook will give you a heads-up about things due today and tomorrow.");
    }
  }

  return (
    <div className="card stack">
      <h3 className="row"><Bell size={18} /> Reminders</h3>
      <p className="muted small">
        A once-a-day heads-up about bills, deposits, chores and plans due today or tomorrow, from every space. It works on this device when
        Driftbook is open or installed on your home screen.
      </p>
      {!supported ? (
        <p className="small">This browser can&apos;t show notifications. On iPhone, add Driftbook to your Home Screen first, then turn this on from there.</p>
      ) : on ? (
        <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => { write(ON_KEY, "0"); setOn(false); }}>
          <BellOff size={16} /> Turn off on this device
        </button>
      ) : permission === "denied" ? (
        <p className="small">Notifications are blocked for Driftbook in your browser settings. Allow them there, then come back.</p>
      ) : (
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={enable}>
          <Bell size={16} /> Turn on reminders
        </button>
      )}
    </div>
  );
}
