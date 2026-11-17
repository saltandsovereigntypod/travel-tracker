"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUpToLine, ArrowDownToLine, RotateCw, RotateCcw, Copy, Trash2, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { BlockRenderer } from "./BlockRenderer";
import { uid } from "@/lib/format";
import type { BlockProps, BoardBlock, BlockType } from "@/lib/types";

const SNAP = 8;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;
// Decorations can be dragged by their body; info blocks use the "move" pill so their buttons still work.
const BODY_DRAG: BlockType[] = ["sticker", "image", "heading", "divider", "countdown", "hero"];

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function BoardCanvas({
  blocks,
  editing,
  selectedId,
  onSelect,
  onChange,
}: {
  blocks: BoardBlock[];
  editing: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (blocks: BoardBlock[]) => void;
}) {
  const narrow = useIsNarrow();
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState<BoardBlock[] | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const items = draft ?? blocks;

  // Phones: show the board as a tidy stack in reading order (top-to-bottom, left-to-right).
  if (narrow) {
    const ordered = [...blocks].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <div className="board-stack">
        {editing && <p className="small muted card card-tight">Board editing works best on a computer or tablet. Here&apos;s your board in reading order.</p>}
        {ordered.map((b) => (
          <div key={b.id} style={{ transform: b.rotate ? `rotate(${Math.max(-3, Math.min(3, b.rotate))}deg)` : undefined }}>
            <BlockRenderer block={b} />
          </div>
        ))}
      </div>
    );
  }

  const width = Math.max(1400, ...items.map((b) => b.x + b.w + 400));
  const height = Math.max(1000, ...items.map((b) => b.y + b.h + 400));

  function startDrag(e: React.PointerEvent, b: BoardBlock, kind: "move" | "resize") {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(b.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...b };
    let latest = blocks;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      latest = blocks.map((x) =>
        x.id !== b.id
          ? x
          : kind === "move"
            ? { ...x, x: Math.max(0, snap(origin.x + dx)), y: Math.max(0, snap(origin.y + dy)) }
            : { ...x, w: Math.max(80, snap(origin.w + dx)), h: Math.max(40, snap(origin.h + dy)) },
      );
      setDraft(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraft(null);
      if (latest !== blocks) onChange(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const patch = (id: string, p: Partial<BoardBlock>) => onChange(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const maxZ = Math.max(0, ...blocks.map((b) => b.z));
  const minZ = Math.min(0, ...blocks.map((b) => b.z));

  return (
    <div style={{ position: "relative" }}>
      <div className="row" style={{ position: "absolute", right: 12, top: 12, zIndex: 8 }}>
        <div className="card card-tight row" style={{ padding: 4, gap: 2 }}>
          <button className="icon-btn" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}><ZoomOut size={16} /></button>
          <span className="tiny" style={{ minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}><ZoomIn size={16} /></button>
          <button
            className="icon-btn"
            aria-label="Fit to screen"
            onClick={() => {
              const vw = viewport.current?.clientWidth ?? 1000;
              const contentW = Math.max(600, ...blocks.map((b) => b.x + b.w + 40));
              setZoom(Math.max(0.3, Math.min(1, +(vw / contentW).toFixed(2))));
            }}
          >
            <Maximize size={15} />
          </button>
        </div>
      </div>
      <div ref={viewport} className="board-viewport" onPointerDown={(e) => editing && e.target === e.currentTarget && onSelect(null)}>
        <div
          className={clsx("board-canvas", editing && "editing")}
          style={{ width: width * zoom, height: height * zoom }}
          onPointerDown={(e) => editing && e.target === e.currentTarget && onSelect(null)}
        >
          <div style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0", position: "relative" }} onPointerDown={(e) => editing && e.target === e.currentTarget && onSelect(null)}>
            {items.map((b) => {
              const selected = selectedId === b.id;
              return (
                <div
                  key={b.id}
                  className={clsx("board-item block", selected && editing && "selected")}
                  style={{ left: b.x, top: b.y, width: b.w, height: b.h, zIndex: b.z, transform: b.rotate ? `rotate(${b.rotate}deg)` : undefined }}
                  onPointerDown={(e) => {
                    if (!editing) return;
                    onSelect(b.id);
                    if (BODY_DRAG.includes(b.type) && !(e.target as HTMLElement).closest("input, textarea, button, a, select")) startDrag(e, b, "move");
                  }}
                >
                  {editing && (
                    <>
                      <div className="board-move" onPointerDown={(e) => startDrag(e, b, "move")}>move</div>
                      <div className="board-resize" onPointerDown={(e) => startDrag(e, b, "resize")} aria-label="Resize" />
                      {selected && (
                        <div className="block-chrome" style={{ display: "flex", top: -46, right: 0 }}>
                          <button className="icon-btn" title="Bring to front" aria-label="Bring to front" onClick={() => patch(b.id, { z: maxZ + 1 })}><ArrowUpToLine size={15} /></button>
                          <button className="icon-btn" title="Send to back" aria-label="Send to back" onClick={() => patch(b.id, { z: minZ - 1 })}><ArrowDownToLine size={15} /></button>
                          <button className="icon-btn" title="Rotate left" aria-label="Rotate left" onClick={() => patch(b.id, { rotate: (b.rotate ?? 0) - 3 })}><RotateCcw size={15} /></button>
                          <button className="icon-btn" title="Rotate right" aria-label="Rotate right" onClick={() => patch(b.id, { rotate: (b.rotate ?? 0) + 3 })}><RotateCw size={15} /></button>
                          <button className="icon-btn" title="Duplicate" aria-label="Duplicate" onClick={() => onChange([...blocks, { ...structuredClone(b), id: uid(b.type), x: b.x + 24, y: b.y + 24, z: maxZ + 1 }])}><Copy size={15} /></button>
                          <button className="icon-btn" title="Remove" aria-label="Remove" onClick={() => { onChange(blocks.filter((x) => x.id !== b.id)); onSelect(null); }}><Trash2 size={15} /></button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="block-inner">
                    <BlockRenderer block={b} editing={editing} selected={selected} onProps={(p: BlockProps) => patch(b.id, { props: p })} fill />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
