"use client";

import { useEffect, useState } from "react";
import { Share, X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KEY = "driftbook:install-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Nudges phone users to add Driftbook to their home screen so it opens
 * full-screen like an app. Android/Chrome gets a real Install button;
 * iPhone gets the two-tap instructions (Apple doesn't allow a button).
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<"none" | "android" | "ios">("none");
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage blocked */
    }
    if (dismissed || isStandalone()) return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const phoneSized = window.matchMedia("(max-width: 900px)").matches;
    if (ios && phoneSized) queueMicrotask(() => setMode("ios"));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setMode("none");
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setMode("none");
  };

  if (mode === "none") return null;
  return (
    <div className="install-bar" role="region" aria-label="Install Driftbook">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" />
      <div className="grow">
        <strong style={{ display: "block" }}>Put Driftbook on your home screen</strong>
        {mode === "ios" ? (
          <span className="small muted">
            Tap <Share size={14} style={{ display: "inline", verticalAlign: "-2px" }} /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>. It opens full-screen and works offline.
          </span>
        ) : (
          <span className="small muted">Opens full-screen like an app and works offline.</span>
        )}
      </div>
      {mode === "android" && evt && (
        <button
          className="btn btn-sm btn-primary"
          onClick={async () => {
            await evt.prompt();
            const choice = await evt.userChoice;
            if (choice.outcome === "accepted") setMode("none");
          }}
        >
          <Download size={14} /> Install
        </button>
      )}
      <button className="icon-btn" onClick={dismiss} aria-label="Not now">
        <X size={16} />
      </button>
    </div>
  );
}
