"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { BLOCK_MENU, TEXT_BLOCKS, type DocBlockType } from "@/lib/pages";

/**
 * The block picker. Opens from "/" in an empty line, from the + button, or as "Turn into".
 * Arrow keys and Enter work while focus stays in the text you're typing.
 */
export function BlockMenu({
  query = "",
  onPick,
  onClose,
  textOnly,
  keyTarget,
  title,
}: {
  query?: string;
  onPick: (type: DocBlockType) => void;
  onClose: () => void;
  textOnly?: boolean;
  /** Element whose keystrokes drive the menu (the textarea when opened with "/"). */
  keyTarget?: HTMLElement | null;
  title?: string;
}) {
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const items = useMemo(
    () =>
      BLOCK_MENU.filter((b) => !textOnly || TEXT_BLOCKS.includes(b.type) || b.type === "divider")
        .filter((b) => !q || `${b.label} ${b.keywords ?? ""} ${b.type}`.toLowerCase().includes(q))
        // Best match first: "/list" should pick List view, not Bulleted list.
        .map((b, i) => {
          const label = b.label.toLowerCase();
          const rank = !q ? 0 : label.startsWith(q) || b.type === q ? 0 : label.split(" ").some((w) => w.startsWith(q)) ? 1 : 2;
          return { b, rank, i };
        })
        .sort((x, y) => x.rank - y.rank || x.i - y.i)
        .map((x) => x.b),
    [q, textOnly],
  );
  const [lastQ, setLastQ] = useState(q);
  if (lastQ !== q) {
    setLastQ(q);
    setActive(0);
  }

  // Keyboard control, without stealing focus from the text.
  const state = useRef({ items, active, onPick, onClose });
  useEffect(() => {
    state.current = { items, active, onPick, onClose };
  });
  useEffect(() => {
    const target: HTMLElement | Document = keyTarget ?? document;
    const onKey = (ev: Event) => {
      const e = ev as KeyboardEvent;
      const s = state.current;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setActive((a) => Math.min(s.items.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        if (!s.items[s.active]) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        s.onPick(s.items[s.active].type);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        s.onClose();
      }
    };
    target.addEventListener("keydown", onKey, true);
    return () => target.removeEventListener("keydown", onKey, true);
  }, [keyTarget]);

  useEffect(() => {
    box.current?.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Close when tapping elsewhere.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && e.target !== keyTarget) state.current.onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [keyTarget]);

  const groups = ["Basic", "Linked"] as const;
  let n = -1;
  return (
    <div className="block-menu" ref={box} role="listbox" aria-label={title ?? "Add a block"} onPointerDown={(e) => e.preventDefault()}>
      {title && <div className="block-menu-title">{title}</div>}
      {items.length === 0 && <div className="small muted" style={{ padding: "0.5rem 0.7rem" }}>No block called “{query}”</div>}
      {(q ? (["All"] as const) : groups).map((g) => {
        // While searching, show one ranked list so arrow keys follow what you see.
        const list = g === "All" ? items : items.filter((i) => i.group === g);
        if (!list.length) return null;
        return (
          <div key={g}>
            {!textOnly && g !== "All" && <div className="block-menu-group">{g === "Linked" ? "Linked to your space" : "Basic"}</div>}
            {list.map((b) => {
              n++;
              const i = n;
              return (
                <button
                  key={b.type}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={clsx("block-menu-item", i === active && "active")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onPick(b.type)}
                >
                  <span className="block-menu-icon" aria-hidden>{b.icon}</span>
                  <span className="grow">
                    <strong>{b.label}</strong>
                    <span className="tiny muted" style={{ display: "block" }}>{b.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
