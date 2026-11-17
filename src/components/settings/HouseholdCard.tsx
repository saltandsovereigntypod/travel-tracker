"use client";

import { useCallback, useEffect, useState } from "react";
import { HeartHandshake, Loader2, UserPlus, LogOut, Check, X } from "lucide-react";
import { useAuth } from "../AuthProvider";
import { Avatar, Field } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { friendlyError, supabase } from "@/lib/supabase";
import type { Household, HouseholdMember, Profile } from "@/lib/types";

/**
 * Households link people who share money (couples, families) across every trip.
 * In budgets they settle up as one party, and "per 2 people" / "per room" costs pair them first.
 */
export function HouseholdCard() {
  const { user } = useAuth();
  const toast = useToast();
  const me = user?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [invitee, setInvitee] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = supabase();
    const [mine, companions] = await Promise.all([
      sb.from("household_members").select("*").eq("user_id", me),
      // Profiles visible to me = people I share a trip with (plus me).
      sb.from("profiles").select("id, display_name, avatar_url").neq("id", me).order("display_name"),
    ]);
    const hids = ((mine.data as HouseholdMember[]) ?? []).map((m) => m.household_id);
    setPeople((companions.data as Profile[]) ?? []);
    if (hids.length) {
      const [hs, ms] = await Promise.all([
        sb.from("households").select("id, name, created_by").in("id", hids),
        sb.from("household_members").select("*").in("household_id", hids),
      ]);
      setHouseholds((hs.data as Household[]) ?? []);
      setMembers((ms.data as HouseholdMember[]) ?? []);
      const current = ((ms.data as HouseholdMember[]) ?? []).find((m) => m.user_id === me && m.status === "accepted");
      setName(((hs.data as Household[]) ?? []).find((h) => h.id === current?.household_id)?.name ?? "");
    } else {
      setHouseholds([]);
      setMembers([]);
    }
    setLoading(false);
  }, [me]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.display_name ?? (id === me ? "You" : "Someone");
  const mine = members.find((m) => m.user_id === me && m.status === "accepted");
  const myHousehold = mine ? households.find((h) => h.id === mine.household_id) : undefined;
  const invites = members.filter((m) => m.user_id === me && m.status === "pending");
  const inMine = members.filter((m) => m.household_id === mine?.household_id);
  const candidates = people.filter((p) => !inMine.some((m) => m.user_id === p.id));

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) toast.error(friendlyError(error));
    else {
      toast.success(ok);
      setInvitee("");
      await load();
    }
  }

  return (
    <div className="card stack">
      <h3 className="row"><HeartHandshake size={18} /> Household</h3>
      <p className="muted small">
        Link up with your partner or family. On every trip you share, budgets will settle up with you as one party, and
        &quot;per 2 people&quot; or &quot;per room&quot; costs pair you together first. Each person still sees their own share.
      </p>
      {loading ? (
        <Loader2 className="spin" size={18} />
      ) : (
        <>
          {invites.map((inv) => {
            const by = inv.invited_by;
            return (
              <div key={inv.household_id} className="card card-tight row wrap" style={{ background: "var(--soft)" }}>
                <span className="grow small"><strong>{nameOf(by)}</strong> wants to link households with you.</span>
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(() => supabase().rpc("respond_household_invite", { p_household: inv.household_id, p_accept: true }), "You're linked")}>
                  <Check size={14} /> Accept
                </button>
                <button className="btn btn-sm" disabled={busy} onClick={() => run(() => supabase().rpc("respond_household_invite", { p_household: inv.household_id, p_accept: false }), "Declined")}>
                  <X size={14} /> Decline
                </button>
              </div>
            );
          })}

          {myHousehold ? (
            <>
              <div className="stack" style={{ gap: "0.4rem" }}>
                {inMine.map((m) => (
                  <div key={m.user_id} className="row small">
                    <Avatar name={nameOf(m.user_id)} size={26} />
                    <span className="grow">{m.user_id === me ? "You" : nameOf(m.user_id)}</span>
                    {m.status === "pending" && <span className="chip chip-muted">invite sent</span>}
                  </div>
                ))}
              </div>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => supabase().rpc("rename_household", { p_household: myHousehold.id, p_name: name }), "Saved");
                }}
              >
                <Field label="Household name (optional)">
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Pattersons" maxLength={80} />
                </Field>
                <button className="btn" style={{ alignSelf: "flex-end" }} disabled={busy}>Save</button>
              </form>
            </>
          ) : (
            invites.length === 0 && <p className="small">You&apos;re not linked with anyone yet.</p>
          )}

          {candidates.length > 0 ? (
            <form
              className="row wrap"
              onSubmit={(e) => {
                e.preventDefault();
                if (!invitee) return;
                if (myHousehold) void run(() => supabase().rpc("invite_to_household", { p_household: myHousehold.id, p_invitee: invitee }), "Invite sent. They'll see it in their Settings.");
                else void run(() => supabase().rpc("create_household", { p_name: "", p_invitee: invitee }), "Invite sent. They'll see it in their Settings.");
              }}
            >
              <select className="input" style={{ flex: "1 1 200px", width: "auto" }} value={invitee} onChange={(e) => setInvitee(e.target.value)} aria-label="Person to link with">
                <option value="">Choose someone you travel with…</option>
                {candidates.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <button className="btn btn-primary" disabled={!invitee || busy}><UserPlus size={15} /> {myHousehold ? "Invite" : "Link households"}</button>
            </form>
          ) : (
            !myHousehold && <p className="tiny muted">Once someone joins one of your trips, you can link with them here.</p>
          )}

          {myHousehold && (
            <button
              className="btn btn-sm btn-ghost btn-danger"
              style={{ alignSelf: "flex-start" }}
              disabled={busy}
              onClick={() => confirm("Leave this household? Your trips and expenses stay the same; budgets will just show you separately.") && run(() => supabase().rpc("leave_household", { p_household: myHousehold.id }), "You left the household")}
            >
              <LogOut size={14} /> Leave household
            </button>
          )}
        </>
      )}
    </div>
  );
}
