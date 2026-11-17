"use client";

import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Copy, Trash2, Columns2, Paintbrush } from "lucide-react";
import clsx from "clsx";
import { BlockRenderer } from "./BlockRenderer";
import { WIDTH_SPAN } from "@/lib/blocks";
import { uid } from "@/lib/format";
import type { BlockProps, BlockWidth, PageBlock } from "@/lib/types";

const WIDTHS: BlockWidth[] = ["full", "two-thirds", "half", "third"];
const WIDTH_LABEL: Record<BlockWidth, string> = { full: "Full width", "two-thirds": "2/3 width", half: "Half width", third: "1/3 width" };

export function PageCanvas({
  blocks,
  editing,
  selectedId,
  onSelect,
  onChange,
}: {
  blocks: PageBlock[];
  editing: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (blocks: PageBlock[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = blocks.findIndex((b) => b.id === e.active.id);
    const to = blocks.findIndex((b) => b.id === e.over!.id);
    onChange(arrayMove(blocks, from, to));
  }

  const patch = (id: string, p: Partial<PageBlock>) => onChange(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={rectSortingStrategy}>
        <div className={clsx("page-grid", editing && "editing")} onClick={(e) => editing && e.target === e.currentTarget && onSelect(null)}>
          {blocks.map((b) => (
            <SortableBlock
              key={b.id}
              block={b}
              editing={editing}
              selected={selectedId === b.id}
              onSelect={() => onSelect(b.id)}
              onProps={(p) => patch(b.id, { props: p })}
              onWidth={() => patch(b.id, { width: WIDTHS[(WIDTHS.indexOf(b.width) + 1) % WIDTHS.length] })}
              onDuplicate={() => {
                const i = blocks.findIndex((x) => x.id === b.id);
                const copy = { ...structuredClone(b), id: uid(b.type) };
                onChange([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
              }}
              onDelete={() => {
                onChange(blocks.filter((x) => x.id !== b.id));
                onSelect(null);
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableBlock({
  block, editing, selected, onSelect, onProps, onWidth, onDuplicate, onDelete,
}: {
  block: PageBlock;
  editing: boolean;
  selected: boolean;
  onSelect: () => void;
  onProps: (p: BlockProps) => void;
  onWidth: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: !editing });
  return (
    <div
      ref={setNodeRef}
      className={clsx("block", `span-${WIDTH_SPAN[block.width]}`, selected && "selected")}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.85 : 1 }}
      onClickCapture={() => editing && onSelect()}
    >
      {editing && (
        <div className="block-chrome">
          <button ref={setActivatorNodeRef} className="icon-btn drag-handle" aria-label="Drag to move" {...attributes} {...listeners}>
            <GripVertical size={15} />
          </button>
          <button className="icon-btn" aria-label={`Width: ${WIDTH_LABEL[block.width]}`} title={`${WIDTH_LABEL[block.width]} (click to change)`} onClick={onWidth}>
            <Columns2 size={15} />
          </button>
          <button className="icon-btn" aria-label="Style this block" title="Style" onClick={onSelect}>
            <Paintbrush size={15} />
          </button>
          <button className="icon-btn" aria-label="Duplicate" title="Duplicate" onClick={onDuplicate}>
            <Copy size={15} />
          </button>
          <button className="icon-btn" aria-label="Remove block" title="Remove from my view" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        </div>
      )}
      <BlockRenderer block={block} editing={editing} selected={selected} onProps={onProps} />
    </div>
  );
}
