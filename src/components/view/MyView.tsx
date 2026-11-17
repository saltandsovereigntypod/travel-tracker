"use client";

import { useState } from "react";
import { Paintbrush, Check, LayoutList, LayoutDashboard, Wand2 } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { Segmented } from "../ui/Fields";
import { PageCanvas } from "./PageCanvas";
import { BoardCanvas } from "./BoardCanvas";
import { DesignPanel, type SelectedBlock } from "./DesignPanel";
import { blockMeta, newPageBlock, pageToBoard } from "@/lib/blocks";
import type { BlockProps, BlockType, BoardBlock, PageBlock, TripView } from "@/lib/types";

/**
 * The trip home page: each person's own arrangement of the shared trip.
 * Page mode = stacked blocks (Notion-like). Board mode = free placement (Milanote-like).
 */
export function MyView() {
  const { view, saveView } = useTrip();
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mode = view.mode;

  const selected: SelectedBlock | null =
    (mode === "page" ? view.page_layout : view.board_layout).find((b) => b.id === selectedId) ?? null;

  function setPage(page_layout: PageBlock[]) {
    saveView({ page_layout });
  }
  function setBoard(board_layout: BoardBlock[]) {
    saveView({ board_layout });
  }

  function addBlock(type: BlockType, props?: BlockProps) {
    const base = newPageBlock(type);
    if (props) base.props = { ...base.props, ...props };
    if (mode === "page") {
      setPage([...view.page_layout, base]);
    } else {
      const size = blockMeta(type).boardSize;
      const maxZ = Math.max(0, ...view.board_layout.map((b) => b.z));
      const vp = document.querySelector(".board-viewport");
      const x = (vp?.scrollLeft ?? 0) + 80 + Math.round(Math.random() * 60);
      const y = (vp?.scrollTop ?? 0) + 80 + Math.round(Math.random() * 60);
      setBoard([...view.board_layout, { id: base.id, type, x, y, w: size.w, h: size.h, z: maxZ + 1, props: base.props, style: base.style }]);
    }
    setSelectedId(base.id);
    setEditing(true);
  }

  function updateSelected(patch: Partial<SelectedBlock>) {
    if (!selectedId) return;
    if (mode === "page") setPage(view.page_layout.map((b) => (b.id === selectedId ? ({ ...b, ...patch } as PageBlock) : b)));
    else {
      const { width: _w, ...rest } = patch; // eslint-disable-line @typescript-eslint/no-unused-vars
      setBoard(view.board_layout.map((b) => (b.id === selectedId ? ({ ...b, ...rest } as BoardBlock) : b)));
    }
  }

  function applyTemplate(t: Pick<TripView, "theme" | "page_layout" | "board_layout">) {
    saveView({ theme: { ...t.theme, cover: view.theme.cover }, page_layout: t.page_layout, board_layout: t.board_layout });
    setSelectedId(null);
  }

  return (
    <div className={clsx(editing && "with-panel")}>
      <div className="mode-bar no-print">
        <Segmented<TripView["mode"]>
          value={mode}
          onChange={(m) => {
            saveView({ mode: m });
            setSelectedId(null);
          }}
          options={[
            { value: "page", label: <><LayoutList size={15} /> Page</> },
            { value: "board", label: <><LayoutDashboard size={15} /> Board</> },
          ]}
        />
        <div className="row">
          {editing && mode === "board" && (
            <button
              className="btn btn-sm btn-ghost"
              title="Lay out the board to match your page"
              onClick={() => confirm("Rearrange the board to match your page layout?") && setBoard(pageToBoard(view.page_layout))}
            >
              <Wand2 size={14} /> Tidy from page
            </button>
          )}
          <button className={clsx("btn", editing ? "btn-primary" : "")} onClick={() => { setEditing((e) => !e); setSelectedId(null); }}>
            {editing ? <><Check size={16} /> Done</> : <><Paintbrush size={16} /> Customize</>}
          </button>
        </div>
      </div>

      {mode === "page" ? (
        <PageCanvas blocks={view.page_layout} editing={editing} selectedId={selectedId} onSelect={setSelectedId} onChange={setPage} />
      ) : (
        <BoardCanvas blocks={view.board_layout} editing={editing} selectedId={selectedId} onSelect={setSelectedId} onChange={setBoard} />
      )}

      {editing && (
        <DesignPanel
          onClose={() => { setEditing(false); setSelectedId(null); }}
          selected={selected}
          onUpdateSelected={updateSelected}
          onAdd={addBlock}
          onApplyTemplate={applyTemplate}
        />
      )}
    </div>
  );
}
