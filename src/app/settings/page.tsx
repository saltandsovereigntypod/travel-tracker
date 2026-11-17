"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { RequireAuth, TopBar } from "@/components/AppChrome";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, Field } from "@/components/ui/Fields";
import { useToast } from "@/components/ui/Toast";
import { shrinkImage } from "@/components/sections/Photos";
import { HouseholdCard } from "@/components/settings/HouseholdCard";
import { friendlyError, supabase } from "@/lib/supabase";

function SettingsInner() {
  const { profile, user, refreshProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState("");

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().from("profiles").update({ display_name: name.trim() || "Traveler" }).eq("id", user!.id);
    setBusy(false);
    if (error) toast.error(friendlyError(error));
    else {
      toast.success("Saved");
      await refreshProfile();
    }
  }

  async function uploadAvatar(file: File) {
    setBusy(true);
    try {
      const { blob, ext } = await shrinkImage(file, 512);
      const path = `${user!.id}/avatar-${crypto.randomUUID()}.${ext}`;
      const sb = supabase();
      const up = await sb.storage.from("user-assets").upload(path, blob, { contentType: blob.type || file.type });
      if (up.error) throw up.error;
      const { data } = await sb.storage.from("user-assets").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      await sb.from("profiles").update({ avatar_url: data?.signedUrl ?? null }).eq("id", user!.id);
      await refreshProfile();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().auth.updateUser({ password: pw });
    if (error) toast.error(friendlyError(error));
    else {
      setPw("");
      toast.success("Password updated");
    }
  }

  return (
    <>
      <TopBar />
      <main className="main main-narrow" style={{ maxWidth: 640 }}>
        <h1 style={{ marginBottom: "1.2rem" }}>Settings</h1>
        <div className="stack" style={{ gap: "1.2rem" }}>
          <div className="card stack">
            <h3>Profile</h3>
            <div className="row">
              <Avatar name={profile?.display_name ?? "?"} src={profile?.avatar_url} size={64} />
              <label className="btn btn-sm">
                {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Change photo
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </label>
            </div>
            <form className="row" onSubmit={saveName}>
              <Field label="Display name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
              <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} disabled={busy}>Save</button>
            </form>
            <p className="tiny muted">Signed in as {user?.email}</p>
          </div>
          <HouseholdCard />
          <form className="card stack" onSubmit={changePassword}>
            <h3>Password</h3>
            <Field label="New password" hint="At least 8 characters."><input className="input" type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
            <button className="btn" style={{ alignSelf: "flex-start" }} disabled={pw.length < 8}>Update password</button>
          </form>
          <div className="card">
            <h3>Your designs</h3>
            <p className="muted small" style={{ marginTop: 4 }}>Themes and layouts are saved per trip. Save one as a template from any trip&apos;s My view → Customize → Templates to reuse it.</p>
          </div>
        </div>
      </main>
    </>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsInner />
    </RequireAuth>
  );
}
