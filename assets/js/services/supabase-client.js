import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://galveymskdfnxiqcloxf.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_z2oq6U83GQeQ2KfaSdHafA_xWCqIRps';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { headers: { 'x-application-name': 'wayfarer-workspace' } }
});
