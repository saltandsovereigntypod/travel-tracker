"use client";

import { useEffect } from "react";
import { AuthProvider } from "./AuthProvider";
import { ToastProvider } from "./ui/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Offline support: cache the app shell so Driftbook opens without a signal.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
