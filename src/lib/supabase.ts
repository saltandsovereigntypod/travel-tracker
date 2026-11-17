"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values: safe to ship to the browser. Data is protected by Row Level Security.
// Override with env vars to point a preview build at a different Supabase project.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tcvuopqaybukkfwaevug.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_-UuiAE64TombooeHj8rq_A_aj3277Yq";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/** Turn a Supabase/Postgres error into a sentence a person can read. */
export function friendlyError(err: unknown): string {
  if (!err) return "Something went wrong.";
  if (typeof err === "string") return err;
  const e = err as { message?: string; code?: string };
  const msg = e.message ?? "Something went wrong.";
  if (e.code === "42501" || /row-level security/i.test(msg)) {
    return "You don't have permission to change that. Ask the trip owner to make you an editor.";
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return msg;
}
