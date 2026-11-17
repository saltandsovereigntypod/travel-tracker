"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Modal } from "./Modal";
import { CARD_PARTS, partShown, type CardKind } from "@/lib/card-parts";

/** `show("link")` → whether this person wants that part on this kind of card. */
export function useCardParts(kind: CardKind, scope?: string) {
  const { view } = useTrip();
  const key = scope ? `${kind}:${scope}` : kind;
  const prefs = view.card_prefs?.[key];
  return (id: string) => partShown(prefs, kind, id);
}

/**
 * "Card options": pick what shows on this kind of card. Just for you; others keep their own.
 * `extra` adds more switches (e.g. a list's own fields).
 */
export function CardOptions({ kind, scope, title = "Card options", extra }: { kind: CardKind; scope?: string; title?: string; extra?: { id: string; label: string; on: boolean }[] }) {
  const { view, saveView } = useTrip();
  const [open, setOpen] = useState(false);
  const key = scope ? `${kind}:${scope}` : kind;
  const prefs = view.card_prefs?.[key] ?? {};
  const set = (id: string, on: boolean) => saveView({ card_prefs: { ...(view.card_prefs ?? {}), [key]: { ...prefs, [id]: on } } });
  const parts = [...CARD_PARTS[kind].map((p) => ({ id: p.id, label: p.label, on: partShown(prefs, kind, p.id) })), ...(extra ?? [])];
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)} aria-label={title} title={title}>
        <SlidersHorizontal size={15} /> <span className="hide-phone">Card options</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="sm">
        <p className="small muted" style={{ marginBottom: "0.8rem" }}>Choose what shows on these cards. This is just for you; everyone else keeps their own.</p>
        <div className="toggle-list">
          {parts.map((p) => (
            <label key={p.id} className="toggle-row">
              <span>{p.label}</span>
              <input type="checkbox" role="switch" className="switch" checked={p.on} onChange={(e) => set(p.id, e.target.checked)} />
            </label>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: "0.8rem" }} onClick={() => saveView({ card_prefs: { ...(view.card_prefs ?? {}), [key]: {} } })}>
          Show everything again
        </button>
      </Modal>
    </>
  );
}
