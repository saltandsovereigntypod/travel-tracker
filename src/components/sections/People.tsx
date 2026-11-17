"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Trash2, UserPlus, Globe, LogOut } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTrip } from "../TripProvider";
import { Avatar, Field, Segmented } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { friendlyError, supabase } from "@/lib/supabase";
import type { Attendance, Member, Role } from "@/lib/types";

const COLORS = ["#E07A5F", "#3D5A80", "#81B29A", "#F2CC8F", "#9B5DE5", "#F15BB5", "#00BBF9", "#6D597A", "#2A9D8F", "#E76F51"];

export function PeopleSection({ compact = false }: { compact?: boolean }) {
  const { rows, me, nameOf, profiles } = useTrip();
  const going = rows.trip_members.filter((m) => m.attendance === "going");
  const maybe = rows.trip_members.filter((m) => m.attendance === "maybe");

  if (compact) {
    return (
      <div className="stack" style={{ gap: "0.5rem" }}>
        {[...going, ...maybe].map((m) => (
          <div key={m.user_id} className="row">
            <Avatar name={nameOf(m.user_id)} color={m.color} src={profiles[m.user_id]?.avatar_url} size={30} />
            <span className="grow">{nameOf(m.user_id)}{m.user_id === me && <span className="muted"> (you)</span>}</span>
            {m.attendance === "maybe" && <span className="chip chip-2">maybe</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "1.4rem", maxWidth: 820 }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>People & sharing</h1>
          <p>Who&apos;s coming, who can edit, and how to bring more people in.</p>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: "0.8rem" }}>Travelers ({going.length} going{maybe.length ? `, ${maybe.length} maybe` : ""})</h3>
        <div className="stack">
          {rows.trip_members.map((m) => <MemberRow key={m.user_id} member={m} />)}
        </div>
      </div>
      <Invites />
      <ShareLink />
      <LeaveTrip />
    </div>
  );
}

function MemberRow({ member: m }: { member: Member }) {
  const { me, isOwner, nameOf, profiles, reload } = useTrip();
  const toast = useToast();
  const isMe = m.user_id === me;
  const canChange = isMe || isOwner;

  async function patch(p: Partial<Member>) {
    const { error } = await supabase().from("trip_members").update(p).eq("trip_id", m.trip_id).eq("user_id", m.user_id);
    if (error) toast.error(friendlyError(error));
    else await reload();
  }

  return (
    <div className="row wrap" style={{ gap: "0.7rem" }}>
      <Avatar name={nameOf(m.user_id)} color={m.color} src={profiles[m.user_id]?.avatar_url} size={38} />
      <div className="grow" style={{ minWidth: 140 }}>
        <strong>{nameOf(m.user_id)}{isMe && <span className="muted"> (you)</span>}</strong>
        <div className="tiny muted">Joined {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}</div>
      </div>
      {canChange ? (
        <select className="input" style={{ width: "auto" }} value={m.attendance} onChange={(e) => patch({ attendance: e.target.value as Attendance })} aria-label="Coming?">
          <option value="going">Going</option>
          <option value="maybe">Maybe</option>
          <option value="not_going">Not going</option>
        </select>
      ) : (
        <span className="chip chip-muted">{m.attendance.replace("_", " ")}</span>
      )}
      {isOwner && !isMe ? (
        <select className="input" style={{ width: "auto" }} value={m.role} onChange={(e) => patch({ role: e.target.value as Role })} aria-label="Role">
          <option value="owner">Owner</option>
          <option value="editor">Can edit</option>
          <option value="viewer">View only</option>
        </select>
      ) : (
        <span className="chip">{m.role === "editor" ? "can edit" : m.role === "viewer" ? "view only" : "owner"}</span>
      )}
      {isMe && (
        <div className="row" style={{ gap: 3 }} title="Your color">
          {COLORS.map((c) => (
            <button key={c} onClick={() => patch({ color: c })} aria-label={`Color ${c}`} style={{ width: 18, height: 18, borderRadius: 9, border: c === m.color ? "2px solid var(--ink)" : "2px solid transparent", background: c, cursor: "pointer" }} />
          ))}
        </div>
      )}
      {isOwner && !isMe && (
        <button className="icon-btn" aria-label="Remove from trip" onClick={async () => {
          if (!confirm(`Remove ${nameOf(m.user_id)} from this trip?`)) return;
          const { error } = await supabase().from("trip_members").delete().eq("trip_id", m.trip_id).eq("user_id", m.user_id);
          if (error) toast.error(friendlyError(error));
          else await reload();
        }}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

function Invites() {
  const { rows, canEdit, insert, update, me } = useTrip();
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  if (!canEdit) return null;
  const active = rows.trip_invites.filter((i) => !i.revoked && new Date(i.expires_at) > new Date());
  const linkFor = (token: string) => `${window.location.origin}/invite/${token}`;

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      toast.success("Invite link copied. Paste it in a text or email.");
    } catch {
      prompt("Copy this invite link:", linkFor(token));
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const inv = await insert("trip_invites", { label: label.trim(), role, created_by: me });
    if (inv) {
      setLabel("");
      await copy(inv.token);
    }
  }

  return (
    <div className="card">
      <h3 className="row" style={{ marginBottom: "0.3rem" }}><UserPlus size={18} /> Invite people</h3>
      <p className="muted small" style={{ marginBottom: "0.9rem" }}>Make a link and send it however you like. Links work for 30 days and can be turned off anytime.</p>
      <form className="form-grid" onSubmit={create}>
        <Field label="Who's it for? (optional)"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Lizza" /></Field>
        <Field label="They can">
          <Segmented<"editor" | "viewer"> value={role} onChange={setRole} options={[{ value: "editor", label: "Edit" }, { value: "viewer", label: "Only view" }]} />
        </Field>
        <div className="field-full"><button className="btn btn-primary"><Link2 size={16} /> Create & copy link</button></div>
      </form>
      {active.length > 0 && (
        <>
          <div className="divider-line" style={{ margin: "1rem 0" }} />
          <div className="stack" style={{ gap: "0.5rem" }}>
            {active.map((i) => (
              <div key={i.id} className="row wrap">
                <span className="grow small"><strong>{i.label || "Invite link"}</strong> <span className="muted">· {i.role === "editor" ? "can edit" : "view only"} · used {i.uses}× · expires {formatDistanceToNow(new Date(i.expires_at), { addSuffix: true })}</span></span>
                <button className="btn btn-sm" onClick={() => copy(i.token)}><Copy size={14} /> Copy</button>
                <button className="btn btn-sm btn-danger" onClick={() => update("trip_invites", i.id, { revoked: true })}>Turn off</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ShareLink() {
  const { trip, isOwner, tripId, reload } = useTrip();
  const toast = useToast();
  const url = trip?.share_token ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${trip.share_token}` : null;
  async function toggle(on: boolean) {
    const { error } = await supabase().rpc("set_share_link", { p_trip: tripId, p_enabled: on });
    if (error) toast.error(friendlyError(error));
    else await reload();
  }
  return (
    <div className="card">
      <h3 className="row" style={{ marginBottom: "0.3rem" }}><Globe size={18} /> Read-only share link</h3>
      <p className="muted small" style={{ marginBottom: "0.9rem" }}>
        For people who just need the plan (parents, pet sitter). Shows the itinerary, stays and flight times. Never shows confirmation codes, costs, notes or ideas.
      </p>
      {url ? (
        <div className="row wrap">
          <input className="input grow" readOnly value={url} onFocus={(e) => e.target.select()} />
          <button className="btn" onClick={() => { void navigator.clipboard?.writeText(url); toast.success("Share link copied"); }}><Copy size={14} /> Copy</button>
          {isOwner && <button className="btn btn-danger" onClick={() => toggle(false)}>Turn off</button>}
        </div>
      ) : isOwner ? (
        <button className="btn" onClick={() => toggle(true)}><Link2 size={16} /> Create share link</button>
      ) : (
        <p className="small muted">Only the trip owner can turn this on.</p>
      )}
    </div>
  );
}

function LeaveTrip() {
  const { me, tripId, isOwner, rows } = useTrip();
  const toast = useToast();
  const router = useRouter();
  const owners = rows.trip_members.filter((m) => m.role === "owner").length;
  if (isOwner && owners === 1) return null;
  return (
    <div>
      <button className="btn btn-danger" onClick={async () => {
        if (!confirm("Leave this trip? You'll need a new invite to come back.")) return;
        const { error } = await supabase().from("trip_members").delete().eq("trip_id", tripId).eq("user_id", me);
        if (error) toast.error(friendlyError(error));
        else router.replace("/trips");
      }}>
        <LogOut size={16} /> Leave trip
      </button>
    </div>
  );
}
