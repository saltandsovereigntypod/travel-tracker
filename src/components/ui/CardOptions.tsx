"use client";

import { createContext, useContext, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Modal } from "./Modal";
import { Segmented } from "./Fields";
import { CARD_CHOICES, CARD_PARTS, choiceValue, partShown, prefsKey, type CardKind } from "@/lib/card-parts";

/** Set by My view around each block, so cards inside use (and edit) that block's own choices. */
const BlockScope = createContext<string | null>(null);
export const CardBlockScope = BlockScope.Provider;
export const useInBlock = () => useContext(BlockScope);

function usePrefs(kind: CardKind, scope?: string) {
  const { view } = useTrip();
  const block = useContext(BlockScope);
  const key = prefsKey(kind, scope, block);
  return { key, prefs: view.card_prefs?.[key], inBlock: !!block };
}

/** `show("link")`: does this person want that part on this card, here? */
export function useCardParts(kind: CardKind, scope?: string) {
  const { prefs, inBlock } = usePrefs(kind, scope);
  return (id: string) => partShown(prefs, kind, id, inBlock);
}

/** `choice("group")`: how this person wants these cards arranged, here. */
export function useCardChoice(kind: CardKind, scope?: string) {
  const { prefs, inBlock } = usePrefs(kind, scope);
  return (id: string) => choiceValue(prefs, kind, id, inBlock);
}

/** Change one choice from elsewhere on the page (e.g. the Ideas page's own sort switch). */
export function useSetCardPref(kind: CardKind, scope?: string) {
  const { view, saveView } = useTrip();
  const { key, prefs } = usePrefs(kind, scope);
  return (id: string, value: boolean | string) => saveView({ card_prefs: { ...(view.card_prefs ?? {}), [key]: { ...(prefs ?? {}), [id]: value } } });
}

/**
 * "Card options": what shows on these cards and how they're arranged. Just for you.
 * On a page it changes the page; inside a My view block it changes only that block.
 * `extra` adds more switches (e.g. a list's own fields).
 */
export function CardOptions({
  kind,
  scope,
  title = "Card options",
  extra,
  iconOnly,
}: {
  kind: CardKind;
  scope?: string;
  title?: string;
  extra?: { id: string; label: string; on: boolean }[];
  iconOnly?: boolean;
}) {
  const { view, saveView } = useTrip();
  const { key, prefs, inBlock } = usePrefs(kind, scope);
  const [open, setOpen] = useState(false);
  const set = (id: string, v: boolean | string) => saveView({ card_prefs: { ...(view.card_prefs ?? {}), [key]: { ...(prefs ?? {}), [id]: v } } });
  const parts = [...CARD_PARTS[kind].map((p) => ({ id: p.id, label: p.label, on: partShown(prefs, kind, p.id, inBlock) })), ...(extra ?? [])];
  const choices = (CARD_CHOICES[kind] ?? []).filter((c) => !c.only || c.only === (inBlock ? "block" : "page"));
  return (
    <>
      <button
        className={iconOnly ? "icon-btn card-opt-btn" : "btn btn-sm"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={title}
        title={title}
      >
        <SlidersHorizontal size={iconOnly ? 15 : 15} />
        {!iconOnly && <span className="card-opt-label">Card options</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="sm">
        <p className="small muted" style={{ marginBottom: "0.8rem" }}>
          {inBlock
            ? "Just for this block on your My view. The full page keeps its own settings, and nobody else is affected."
            : "Choose what shows on these cards. This is just for you; everyone else keeps their own. Blocks on My view have their own settings too."}
        </p>
        {choices.length > 0 && (
          <div className="stack" style={{ gap: "0.7rem", marginBottom: "0.9rem" }}>
            {choices.map((c) => (
              <div key={c.id} className="stack" style={{ gap: 4 }}>
                <span className="tiny muted" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</span>
                <Segmented<string> size="sm" value={choiceValue(prefs, kind, c.id, inBlock)} onChange={(v) => set(c.id, v)} options={c.options} />
              </div>
            ))}
          </div>
        )}
        <div className="toggle-list">
          {parts.map((p) => (
            <label key={p.id} className="toggle-row">
              <span>{p.label}</span>
              <input type="checkbox" role="switch" className="switch" checked={p.on} onChange={(e) => set(p.id, e.target.checked)} />
            </label>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: "0.8rem" }} onClick={() => saveView({ card_prefs: { ...(view.card_prefs ?? {}), [key]: {} } })}>
          Back to the defaults
        </button>
      </Modal>
    </>
  );
}
