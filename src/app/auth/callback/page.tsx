"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = params.get("next");
    const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/trips";
    const errDesc = params.get("error_description");
    if (errDesc) {
      setError(errDesc);
      return;
    }
    const sb = supabase();
    // supabase-js exchanges the ?code= automatically (detectSessionInUrl). Wait for the session.
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (session) router.replace(next);
    });
    sb.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
    const timeout = setTimeout(() => setError("That sign-in link didn't work. It may have expired. Try signing in again."), 10000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [params, router]);

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ textAlign: "center", padding: "2rem" }}>
        {error ? (
          <>
            <h2>Hmm.</h2>
            <p className="muted" style={{ margin: "0.6rem 0 1rem" }}>{error}</p>
            <a className="btn btn-primary" href="/login">Back to sign in</a>
          </>
        ) : (
          <>
            <Loader2 className="spin" style={{ margin: "0 auto 0.8rem" }} />
            <p>Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
