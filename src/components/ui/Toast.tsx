"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

interface ToastApi {
  info: (text: string) => void;
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"]) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);
  const api = useMemo<ToastApi>(
    () => ({
      info: (t) => push(t, "info"),
      success: (t) => push(t, "success"),
      error: (t) => push(t, "error"),
    }),
    [push],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
