"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  variant = "dialog",
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** "panel": a side drawer on computers and a full-height sheet on phones, for reading details. */
  variant?: "dialog" | "panel";
  /** Buttons next to the close button (e.g. Edit). */
  actions?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // With modals stacked (e.g. a payment opened from a plan), Escape closes only the top one.
      if (e.key !== "Escape") return;
      const all = document.querySelectorAll(".modal-backdrop");
      if (all[all.length - 1]?.contains(panel.current)) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first field for quick typing.
    // (Skip it if the person already clicked into a field.)
    setTimeout(() => {
      if (panel.current?.contains(document.activeElement)) return;
      // Reading panels shouldn't pop the keyboard open on phones.
      if (panel.current?.classList.contains("modal-panel") && !panel.current.querySelector("form")) {
        panel.current.focus();
        return;
      }
      panel.current?.querySelector<HTMLElement>("input, textarea, select, button.btn-primary")?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  // Portal into the themed trip shell when present so modals inherit the person's theme.
  const host = document.getElementById("theme-root") ?? document.body;
  return createPortal(
    <div className={`modal-backdrop${variant === "panel" ? " backdrop-panel" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        className={variant === "panel" ? "modal modal-panel" : `modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <div className="row" style={{ gap: 6, flex: "none" }}>
            {actions}
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    host,
  );
}
