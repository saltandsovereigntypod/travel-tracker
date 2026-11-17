"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut, Settings, Plane } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./ui/Fields";

/** Sends signed-out visitors to the login page, then back here afterwards. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname]);
  if (!ready || !user) {
    return (
      <div className="auth-wrap">
        <Loader2 className="spin" />
      </div>
    );
  }
  return <>{children}</>;
}

export function UserMenu() {
  const { profile, user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const name = profile?.display_name ?? user?.email ?? "You";
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        <Avatar name={name} src={profile?.avatar_url} size={32} />
      </button>
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: 44, width: 220, padding: "0.4rem", zIndex: 50 }}>
          <div style={{ padding: "0.5rem 0.6rem" }}>
            <strong className="truncate" style={{ display: "block" }}>{name}</strong>
            <span className="tiny muted truncate" style={{ display: "block" }}>{user?.email}</span>
          </div>
          <div className="divider-line" />
          <Link className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start" }} href="/trips" onClick={() => setOpen(false)}>
            <Plane size={16} /> Home
          </Link>
          <Link className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start" }} href="/settings" onClick={() => setOpen(false)}>
            <Settings size={16} /> Settings
          </Link>
          <button
            className="btn btn-ghost btn-block"
            style={{ justifyContent: "flex-start" }}
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <Link href="/trips" className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="brand-mark" />
        <span className="hide-sm">Driftbook</span>
      </Link>
      <div className="grow row" style={{ minWidth: 0 }}>{children}</div>
      <UserMenu />
    </header>
  );
}
