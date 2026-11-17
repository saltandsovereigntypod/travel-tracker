"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError, supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Field } from "@/components/ui/Fields";

export default function ResetPassword() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error: err } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (err) setError(friendlyError(err));
    else router.replace("/trips");
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" style={{ padding: "2rem" }} onSubmit={save}>
        <h1>Choose a new password</h1>
        {ready && !user ? (
          <p className="muted">Open this page from the link in your reset email.</p>
        ) : (
          <>
            <Field label="New password" hint="At least 8 characters.">
              <input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            </Field>
            {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>Save password</button>
          </>
        )}
      </form>
    </div>
  );
}
