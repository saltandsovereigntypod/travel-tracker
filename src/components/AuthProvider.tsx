"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase().from("profiles").select("id, display_name, avatar_url").eq("id", userId).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    const sb = supabase();
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
      void loadProfile(data.session?.user.id);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
      void loadProfile(s?.user.id);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile: () => loadProfile(session?.user.id),
      signOut: async () => {
        await supabase().auth.signOut();
        if (typeof window !== "undefined") {
          Object.keys(localStorage)
            .filter((k) => k.startsWith("driftbook:"))
            .forEach((k) => localStorage.removeItem(k));
        }
      },
    }),
    [ready, session, profile, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
