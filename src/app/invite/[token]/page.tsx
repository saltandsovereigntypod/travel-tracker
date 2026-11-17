"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, CalendarDays } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { friendlyError, supabase } from "@/lib/supabase";
import { formatRange } from "@/lib/format";

interface Preview {
  trip_name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  invited_by: string;
  role: string;
  valid: boolean;
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, ready } = useAuth();
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase()
      .rpc("get_invite_preview", { p_token: token })
      .then(({ data }) => setPreview(((data as Preview[]) ?? [])[0] ?? null));
  }, [token]);

  async function join() {
    setBusy(true);
    const { data, error: err } = await supabase().rpc("accept_invite", { p_token: token });
    setBusy(false);
    if (err) setError(friendlyError(err));
    else router.replace(`/trips/${data}`);
  }

  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ padding: "2rem", textAlign: "center" }}>
        {preview === undefined ? (
          <Loader2 className="spin" style={{ margin: "0 auto" }} />
        ) : !preview || !preview.valid ? (
          <>
            <h1>Invite not found</h1>
            <p className="muted" style={{ margin: "0.6rem 0 1.2rem" }}>This link is invalid, expired, or was turned off. Ask for a new one.</p>
            <Link className="btn" href="/">Go home</Link>
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stickers/ticket.svg" alt="" style={{ width: 180, margin: "0 auto 1rem", transform: "rotate(-4deg)" }} />
            <p className="muted">{preview.invited_by} invited you to</p>
            <h1 style={{ margin: "0.3rem 0 0.6rem" }}>{preview.trip_name}</h1>
            <div className="stack small muted" style={{ alignItems: "center", gap: 4, marginBottom: "1.4rem" }}>
              {preview.destination && <span className="row"><MapPin size={14} /> {preview.destination}</span>}
              <span className="row"><CalendarDays size={14} /> {formatRange(preview.start_date, preview.end_date)}</span>
              <span className="chip chip-muted">You&apos;ll join as {preview.role === "viewer" ? "a viewer" : "an editor"}</span>
            </div>
            {error && <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>}
            {!ready ? (
              <Loader2 className="spin" style={{ margin: "0 auto" }} />
            ) : user ? (
              <button className="btn btn-primary btn-lg btn-block" onClick={join} disabled={busy}>
                {busy && <Loader2 size={16} className="spin" />} Join the trip
              </button>
            ) : (
              <div className="stack">
                <Link className="btn btn-primary btn-lg btn-block" href={`/login?mode=signup&next=${next}`}>Create an account to join</Link>
                <Link className="btn btn-block" href={`/login?next=${next}`}>I already have an account</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
