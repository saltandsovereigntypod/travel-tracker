"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, friendlyError, supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Field } from "@/components/ui/Fields";

type Mode = "signin" | "signup" | "forgot";

function safeNext(next: string | null): string {
  // Only allow internal paths so a link can't bounce people to another site.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/trips";
}

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, ready } = useAuth();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googleOn, setGoogleOn] = useState(false);

  // Only offer Google once it's switched on in Supabase; otherwise the button
  // leads to a raw "provider is not enabled" error page.
  useEffect(() => {
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } })
      .then((r) => r.json())
      .then((d: { external?: Record<string, boolean> }) => setGoogleOn(!!d.external?.google))
      .catch(() => setGoogleOn(false));
  }, []);

  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const sb = supabase();
    try {
      if (mode === "signin") {
        const { error: err } = await sb.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.replace(next);
      } else if (mode === "signup") {
        const { data, error: err } = await sb.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() || email.split("@")[0] }, emailRedirectTo: redirectTo() },
        });
        if (err) throw err;
        if (data.session) router.replace(next);
        else setMessage("Check your email for a confirmation link, then come back and sign in.");
      } else {
        const { error: err } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (err) throw err;
        setMessage("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      const msg = friendlyError(err);
      setError(/Invalid login credentials/i.test(msg) ? "That email and password don't match." : msg);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const { error: err } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (err) setError(/not enabled|Unsupported provider/i.test(err.message) ? "Google sign-in isn't switched on yet. Use email for now." : friendlyError(err));
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ padding: "2rem" }}>
        <Link href="/" className="brand" style={{ marginBottom: "1.4rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="brand-mark" />
          Driftbook
        </Link>
        <h1>{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}</h1>
        <p className="muted" style={{ marginBottom: "1.2rem" }}>
          {mode === "signup" ? "Plan together, design your own way." : mode === "forgot" ? "We'll email you a link." : "Sign in to your trips."}
        </p>

        {mode !== "forgot" && googleOn && (
          <>
            <button type="button" className="btn btn-block oauth-btn" onClick={google}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
              </svg>
              Continue with Google
            </button>
            <div className="or">or with email</div>
          </>
        )}

        <form onSubmit={submit} className="stack">
          {mode === "signup" && (
            <Field label="Your name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ashley" autoComplete="name" required />
            </Field>
          )}
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          {mode !== "forgot" && (
            <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
            </Field>
          )}
          {error && <p style={{ color: "var(--danger)" }} role="alert">{error}</p>}
          {message && <p className="chip-ok" style={{ padding: "0.6rem 0.8rem", borderRadius: 10 }}>{message}</p>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy && <Loader2 size={18} className="spin" />}
            {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </button>
        </form>

        <div className="stack small" style={{ marginTop: "1.2rem", gap: "0.4rem", textAlign: "center" }}>
          {mode === "signin" && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setMode("signup")}>New here? Create an account</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setMode("forgot")}>Forgot your password?</button>
            </>
          )}
          {mode !== "signin" && (
            <button className="btn btn-ghost btn-sm" onClick={() => setMode("signin")}>Already have an account? Sign in</button>
          )}
          <p className="tiny muted" style={{ marginTop: "0.6rem" }}>
            By continuing you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
