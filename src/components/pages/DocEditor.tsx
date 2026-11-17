"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Bold, ChevronDown, ChevronRight, Copy, GripVertical, Italic, Plus, Trash2, Type, X } from "lucide-react";
import { useTrip } from "../TripProvider";
import { useIsPhone, useKeyboardInset } from "../ui/hooks";
import { BlockMenu } from "./BlockMenu";
import { ImageEmbed, ItemEmbed, ListEmbed, WidgetEmbed } from "./Embeds";
import { useCreatePage } from "./usePageDoc";
import { CONTINUING, TEXT_BLOCKS, convertBlock, listNumber, newBlock, parseInline, shortcutFor, type DocBlock, type DocBlockType, type Page } from "@/lib/pages";
import { formatDay } from "@/lib/format";

export interface DocApi {
  set: (b: DocBlock) => void;
  insertAfter: (after: string | null, b: DocBlock) => void;
  remove: (id: string) => void;
  move: (id: string, after: string | null) => void;
}

type MenuState = { id: string; mode: "slash" | "insert" | "turn" | "actions" } | null;

const CALLOUT_EMOJI = ["💡", "📌", "⚠️", "✅", "❤️", "📅", "💸", "🎉", "👻", "🎙️"];

// ---------------------------------------------------------------- inline text
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => {
        switch (t.t) {
          case "b":
            return <strong key={i}>{t.v}</strong>;
          case "i":
            return <em key={i}>{t.v}</em>;
          case "s":
            return <s key={i}>{t.v}</s>;
          case "code":
            return <code key={i}>{t.v}</code>;
          case "link":
            return (
              <a key={i} href={t.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                {t.v}
              </a>
            );
          default:
            return <Fragment key={i}>{t.v}</Fragment>;
        }
      })}
    </>
  );
}

const hasMarkup = (s: string) => parseInline(s).some((t) => t.t !== "text");

/** A line you type into. Shows formatting when you're not editing it, without an extra tap to edit on phones. */
function DocText({
  block,
  canEdit,
  className,
  placeholder,
  focused,
  onText,
  onKeyDown,
  register,
}: {
  block: DocBlock;
  canEdit: boolean;
  className: string;
  placeholder: string;
  focused: boolean;
  onText: (text: string, el: HTMLTextAreaElement) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  register: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const text = block.text ?? "";
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, className]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === w) return;
      w = el.clientWidth;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!canEdit) {
    return <div className={clsx("doc-text-view", className)}>{text ? <Inline text={text} /> : <br />}</div>;
  }
  const overlay = !focused && hasMarkup(text);
  return (
    <div className="doc-text-wrap">
      <textarea
        ref={(el) => {
          ref.current = el;
          register(el);
        }}
        className={clsx("doc-input", className, overlay && "ghost")}
        value={text}
        rows={1}
        placeholder={placeholder}
        onChange={(e) => onText(e.target.value, e.target)}
        onKeyDown={onKeyDown}
        aria-label={placeholder || "Text"}
        spellCheck
      />
      {overlay && (
        <div className={clsx("doc-overlay", className)} aria-hidden>
          <Inline text={text} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- sortable wrapper
function Sortable({ id, disabled, children }: { id: string; disabled: boolean; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = disabled ? null : (
    <button ref={setActivatorNodeRef} className="doc-handle" aria-label="Drag to move, or click for options" {...attributes} {...listeners} type="button">
      <GripVertical size={15} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 5 : undefined, opacity: isDragging ? 0.7 : undefined }}>
      {children(handle)}
    </div>
  );
}

// ---------------------------------------------------------------- editor
export function DocEditor({ page, blocks, api, canEdit }: { page: Page; blocks: DocBlock[]; api: DocApi; canEdit: boolean }) {
  const { rows, nameOf, me } = useTrip();
  const createPage = useCreatePage();
  const phone = useIsPhone();
  const kb = useKeyboardInset();
  const [focused, setFocused] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [openToggles, setOpenToggles] = useState<Set<string>>(new Set());
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  const focusReq = useRef<{ id: string; pos: number | "end" } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const place = (el: HTMLTextAreaElement, pos: number | "end") => {
    if (document.activeElement !== el) el.focus();
    const p = pos === "end" ? el.value.length : Math.min(pos, el.value.length);
    el.setSelectionRange(p, p);
  };
  const focusBlock = useCallback((id: string, pos: number | "end" = "end") => {
    // Try now (keeps the phone keyboard up), and again after the next render in case
    // the block is new or changed type and its text box was replaced.
    focusReq.current = { id, pos };
    const el = inputs.current.get(id);
    if (el?.isConnected) place(el, pos);
  }, []);
  useEffect(() => {
    const r = focusReq.current;
    if (!r) return;
    const el = inputs.current.get(r.id);
    if (el?.isConnected) {
      place(el, r.pos);
      focusReq.current = null;
    }
  });

  const register = (id: string) => (el: HTMLTextAreaElement | null) => {
    if (el) inputs.current.set(id, el);
    else inputs.current.delete(id);
  };

  const isText = (b?: DocBlock) => !!b && TEXT_BLOCKS.includes(b.type);
  const prevText = (i: number) => {
    for (let j = i - 1; j >= 0; j--) if (isText(blocks[j])) return blocks[j];
    return undefined;
  };
  const nextText = (i: number) => {
    for (let j = i + 1; j < blocks.length; j++) if (isText(blocks[j])) return blocks[j];
    return undefined;
  };

  function onText(b: DocBlock, text: string) {
    if (b.type === "text" && !text.includes("\n")) {
      const sc = shortcutFor(text);
      if (sc) {
        if (sc.type === "divider") {
          api.set(newBlock("divider", { id: b.id }));
          const nb = newBlock("text");
          api.insertAfter(b.id, nb);
          focusBlock(nb.id, 0);
        } else {
          const c = { ...convertBlock(b, sc.type), text: sc.rest };
          if (sc.type === "todo") c.checked = !!sc.checked;
          api.set(c);
          focusBlock(b.id, 0);
        }
        return;
      }
    }
    if (text.startsWith("/") && !text.includes("\n") && text.length <= 24) setMenu({ id: b.id, mode: "slash" });
    else if (menu?.mode === "slash" && menu.id === b.id) setMenu(null);
    api.set({ ...b, text });
  }

  function wrapSelection(b: DocBlock, el: HTMLTextAreaElement, mark: string) {
    const t = b.text ?? "";
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const inner = t.slice(s, e) || "text";
    api.set({ ...b, text: `${t.slice(0, s)}${mark}${inner}${mark}${t.slice(e)}` });
    requestAnimationFrame(() => el.setSelectionRange(s + mark.length, s + mark.length + inner.length));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, b: DocBlock, i: number) {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const t = b.text ?? "";
    const pos = el.selectionStart;
    const end = el.selectionEnd;
    if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "i")) {
      e.preventDefault();
      wrapSelection(b, el, e.key === "b" ? "**" : "*");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (CONTINUING.includes(b.type) && t === "") {
        api.set(convertBlock(b, "text"));
        focusBlock(b.id, 0);
        return;
      }
      api.set({ ...b, text: t.slice(0, pos) });
      const nb = newBlock(CONTINUING.includes(b.type) ? b.type : "text", { text: t.slice(end) });
      api.insertAfter(b.id, nb);
      focusBlock(nb.id, 0);
      return;
    }
    if (e.key === "Backspace" && pos === 0 && end === 0) {
      if (b.type !== "text") {
        e.preventDefault();
        api.set(convertBlock(b, "text"));
        focusBlock(b.id, 0);
        return;
      }
      const prev = blocks[i - 1];
      if (isText(prev)) {
        e.preventDefault();
        const len = (prev.text ?? "").length;
        api.set({ ...prev, text: (prev.text ?? "") + t });
        api.remove(b.id);
        focusBlock(prev.id, len);
      } else if (t === "" && blocks.length > 1) {
        e.preventDefault();
        api.remove(b.id);
        const p = prevText(i);
        if (p) focusBlock(p.id);
      }
      return;
    }
    if (e.key === "ArrowUp" && pos === 0 && end === 0) {
      const p = prevText(i);
      if (p) {
        e.preventDefault();
        focusBlock(p.id);
      }
    } else if (e.key === "ArrowDown" && pos === t.length) {
      const n = nextText(i);
      if (n) {
        e.preventDefault();
        focusBlock(n.id, 0);
      }
    }
  }

  async function pick(b: DocBlock, type: DocBlockType, mode: NonNullable<MenuState>["mode"]) {
    setMenu(null);
    if (mode === "turn") {
      api.set(convertBlock(b, type));
      if (TEXT_BLOCKS.includes(type)) focusBlock(b.id);
      return;
    }
    // From "/" the current (empty) line becomes the block; from + it goes underneath.
    const replace = mode === "slash" || (isText(b) && !(b.text ?? "").trim() && b.type === "text");
    let nb = newBlock(type, replace ? { id: b.id } : {});
    if (type === "page") {
      const sub = await createPage(page.id, {}, { open: false, linkInParent: false });
      if (!sub) return;
      nb = { ...nb, pageId: sub.id };
    }
    if (replace) api.set(nb);
    else api.insertAfter(b.id, nb);
    if (TEXT_BLOCKS.includes(type)) {
      focusBlock(nb.id, 0);
    } else if (type === "divider" || type === "page") {
      const after = newBlock("text");
      api.insertAfter(nb.id, after);
      focusBlock(after.id, 0);
    }
  }

  function moveBy(b: DocBlock, i: number, dir: -1 | 1) {
    if (dir === -1 && i > 0) api.move(b.id, i >= 2 ? blocks[i - 2].id : null);
    if (dir === 1 && i < blocks.length - 1) api.move(b.id, blocks[i + 1].id);
    if (isText(b)) requestAnimationFrame(() => focusBlock(b.id));
  }

  function duplicate(b: DocBlock) {
    const c = { ...b, id: newBlock().id };
    api.insertAfter(b.id, c);
  }

  function del(b: DocBlock, i: number) {
    setMenu(null);
    api.remove(b.id);
    const p = prevText(i) ?? nextText(i);
    if (p) focusBlock(p.id);
    if (blocks.length === 1) {
      const nb = newBlock("text");
      api.insertAfter(null, nb);
      focusBlock(nb.id, 0);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const from = blocks.findIndex((b) => b.id === e.active.id);
    const to = blocks.findIndex((b) => b.id === e.over?.id);
    if (from < 0 || to < 0 || from === to) {
      if (from >= 0 && !e.over) return;
      // A click on the handle (no drag): show the block's options.
      if (from === to) setMenu({ id: String(e.active.id), mode: "actions" });
      return;
    }
    const without = blocks.filter((b) => b.id !== e.active.id);
    const idx = without.findIndex((b) => b.id === e.over!.id);
    const after = to > from ? without[idx]?.id ?? null : idx > 0 ? without[idx - 1].id : null;
    api.move(String(e.active.id), after);
  }

  function addAtEnd() {
    const last = blocks[blocks.length - 1];
    if (last && last.type === "text" && !(last.text ?? "")) {
      focusBlock(last.id);
      return;
    }
    const nb = newBlock("text");
    api.insertAfter(last?.id, nb);
    focusBlock(nb.id, 0);
  }

  const menuFor = (b: DocBlock, i: number) => {
    if (!menu || menu.id !== b.id) return null;
    const el = inputs.current.get(b.id) ?? null;
    const body =
      menu.mode === "actions" ? (
        <BlockActions
          onTurn={isText(b) ? () => setMenu({ id: b.id, mode: "turn" }) : undefined}
          onDuplicate={() => { duplicate(b); setMenu(null); }}
          onUp={i > 0 ? () => { moveBy(b, i, -1); setMenu(null); } : undefined}
          onDown={i < blocks.length - 1 ? () => { moveBy(b, i, 1); setMenu(null); } : undefined}
          onDelete={() => del(b, i)}
          onClose={() => setMenu(null)}
        />
      ) : (
        <BlockMenu
          query={menu.mode === "slash" ? (b.text ?? "").slice(1) : ""}
          textOnly={menu.mode === "turn"}
          title={menu.mode === "turn" ? "Turn into" : menu.mode === "insert" ? "Add below" : undefined}
          keyTarget={menu.mode === "slash" ? el : null}
          onPick={(type) => void pick(b, type, menu.mode)}
          onClose={() => {
            setMenu(null);
            if (menu.mode === "slash") api.set({ ...b, text: "" });
          }}
        />
      );
    return <div className={clsx("doc-menu-anchor", phone && "doc-menu-sheet")} style={phone ? { bottom: kb + 56 } : undefined}>{body}</div>;
  };

  const placeholderFor = (b: DocBlock, isFocused: boolean) => {
    if (b.type === "h1") return "Heading 1";
    if (b.type === "h2") return "Heading 2";
    if (b.type === "h3") return "Heading 3";
    if (b.type === "todo") return "To-do";
    if (b.type === "toggle") return "Toggle";
    if (b.type === "quote") return "Quote";
    if (b.type === "callout") return "Something worth noticing";
    if (b.type === "bullet" || b.type === "numbered") return "List";
    return isFocused || blocks.length === 1 ? (phone ? "Write, or tap + for blocks" : "Write, or type / for blocks") : "";
  };

  const renderBlock = (b: DocBlock, i: number) => {
    const isFocused = focused === b.id;
    const text = (cls: string) => (
      <DocText
        block={b}
        canEdit={canEdit}
        className={cls}
        focused={isFocused}
        placeholder={placeholderFor(b, isFocused)}
        onText={(v) => onText(b, v)}
        onKeyDown={(e) => onKeyDown(e, b, i)}
        register={register(b.id)}
      />
    );
    switch (b.type) {
      case "h1":
      case "h2":
      case "h3":
        return text(`doc-${b.type}`);
      case "todo": {
        const showMeta = canEdit ? isFocused || !!b.due || !!b.who : !!b.due || !!b.who;
        return (
          <div className={clsx("doc-todo", b.checked && "done")}>
            <input
              type="checkbox"
              className="doc-check"
              checked={!!b.checked}
              disabled={!canEdit}
              onChange={(e) => api.set({ ...b, checked: e.target.checked })}
              aria-label={b.checked ? "Mark not done" : "Mark done"}
            />
            <div className="grow" style={{ minWidth: 0 }}>
              {text("doc-p")}
              {showMeta && (
                <div className="doc-todo-meta">
                  {canEdit ? (
                    <>
                      <label className="doc-meta-chip">
                        📅
                        <input type="date" value={b.due ?? ""} onChange={(e) => api.set({ ...b, due: e.target.value || null })} aria-label="Due date" />
                      </label>
                      <label className="doc-meta-chip">
                        👤
                        <select value={b.who ?? ""} onChange={(e) => api.set({ ...b, who: e.target.value || null })} aria-label="Who's doing it">
                          <option value="">Anyone</option>
                          <option value={me}>Me</option>
                          {rows.trip_members.filter((m) => m.user_id !== me).map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      {b.due && <span className="doc-meta-chip">📅 {formatDay(b.due)}</span>}
                      {b.who && <span className="doc-meta-chip">👤 {nameOf(b.who)}</span>}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }
      case "bullet":
        return <div className="doc-li"><span className="doc-marker" aria-hidden>•</span>{text("doc-p")}</div>;
      case "numbered":
        return <div className="doc-li"><span className="doc-marker num" aria-hidden>{listNumber(blocks, i)}.</span>{text("doc-p")}</div>;
      case "quote":
        return <div className="doc-quote">{text("doc-p")}</div>;
      case "callout":
        return (
          <div className="doc-callout">
            <button
              className="doc-callout-emoji"
              disabled={!canEdit}
              onClick={() => api.set({ ...b, emoji: CALLOUT_EMOJI[(CALLOUT_EMOJI.indexOf(b.emoji ?? "") + 1) % CALLOUT_EMOJI.length] })}
              aria-label="Change icon"
              type="button"
            >
              {b.emoji ?? "💡"}
            </button>
            <div className="grow" style={{ minWidth: 0 }}>{text("doc-p")}</div>
          </div>
        );
      case "toggle": {
        const open = openToggles.has(b.id);
        return (
          <div className="doc-toggle">
            <div className="doc-li">
              <button
                className="doc-marker doc-toggle-btn"
                onClick={() => setOpenToggles((s) => { const n = new Set(s); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; })}
                aria-expanded={open}
                aria-label={open ? "Hide" : "Show"}
                type="button"
              >
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {text("doc-p")}
            </div>
            {open && (
              <div className="doc-toggle-body">
                {canEdit ? (
                  <ToggleBody value={b.body ?? ""} onChange={(v) => api.set({ ...b, body: v })} />
                ) : (
                  <div className="doc-text-view doc-p">{b.body ? <Inline text={b.body} /> : <span className="muted">Empty</span>}</div>
                )}
              </div>
            )}
          </div>
        );
      }
      case "divider":
        return <hr className="doc-divider" />;
      case "image":
        return <ImageEmbed block={b} onChange={api.set} canEdit={canEdit} />;
      case "list":
        return <ListEmbed block={b} onChange={api.set} canEdit={canEdit} />;
      case "item":
        return <ItemEmbed block={b} onChange={api.set} canEdit={canEdit} />;
      case "widget":
        return <WidgetEmbed block={b} onChange={api.set} canEdit={canEdit} />;
      case "page": {
        const sub = rows.pages.find((p) => p.id === b.pageId);
        if (!sub) return canEdit ? <p className="small muted row" style={{ gap: 6 }}>A page that was deleted <button className="btn btn-ghost btn-sm" onClick={() => api.remove(b.id)}>Remove</button></p> : null;
        return (
          <Link href={`/trips/${page.trip_id}/pages/${sub.id}`} className="doc-pagelink">
            <span aria-hidden>{sub.icon}</span>
            <span className="truncate">{sub.title || "Untitled"}</span>
          </Link>
        );
      }
      default:
        return text("doc-p");
    }
  };

  const focusedIndex = blocks.findIndex((b) => b.id === focused);
  const fb = focusedIndex >= 0 ? blocks[focusedIndex] : null;

  return (
    <div className="doc-body">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((b, i) => (
            <Sortable key={b.id} id={b.id} disabled={!canEdit || phone}>
              {(handle) => (
                <div
                  className={clsx("doc-block", `doc-block-${b.type}`, focused === b.id && "focused")}
                  data-block={b.id}
                  onFocus={() => setFocused(b.id)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused((f) => (f === b.id ? null : f));
                  }}
                >
                  {canEdit && !phone && (
                    <div className="doc-gutter">
                      <button className="doc-handle" onClick={() => setMenu({ id: b.id, mode: "insert" })} aria-label="Add a block below" type="button">
                        <Plus size={15} />
                      </button>
                      {handle}
                    </div>
                  )}
                  <div className="doc-content">{renderBlock(b, i)}</div>
                  {menuFor(b, i)}
                </div>
              )}
            </Sortable>
          ))}
        </SortableContext>
      </DndContext>
      {canEdit && <button className="doc-tail" onClick={addAtEnd} aria-label="Add a line at the end" type="button" />}

      {canEdit && phone && fb && (
        <div className="doc-toolbar" style={{ bottom: kb }} onPointerDown={(e) => e.preventDefault()}>
          <button type="button" onClick={() => setMenu({ id: fb.id, mode: "insert" })} aria-label="Add a block"><Plus size={20} /></button>
          {isText(fb) && <button type="button" onClick={() => setMenu({ id: fb.id, mode: "turn" })} aria-label="Turn into"><Type size={19} /></button>}
          {isText(fb) && (
            <>
              <button type="button" onClick={() => { const el = inputs.current.get(fb.id); if (el) wrapSelection(fb, el, "**"); }} aria-label="Bold"><Bold size={18} /></button>
              <button type="button" onClick={() => { const el = inputs.current.get(fb.id); if (el) wrapSelection(fb, el, "*"); }} aria-label="Italic"><Italic size={18} /></button>
            </>
          )}
          <button type="button" onClick={() => moveBy(fb, focusedIndex, -1)} disabled={focusedIndex === 0} aria-label="Move up"><ArrowUp size={19} /></button>
          <button type="button" onClick={() => moveBy(fb, focusedIndex, 1)} disabled={focusedIndex === blocks.length - 1} aria-label="Move down"><ArrowDown size={19} /></button>
          <button type="button" onClick={() => del(fb, focusedIndex)} aria-label="Delete block"><Trash2 size={18} /></button>
          <div className="grow" />
          <button type="button" className="doc-toolbar-done" onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); setFocused(null); setMenu(null); }}>Done</button>
        </div>
      )}
    </div>
  );
}

function ToggleBody({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} className="doc-input doc-p" rows={1} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Details…" aria-label="Toggle details" />;
}

function BlockActions({
  onTurn,
  onDuplicate,
  onUp,
  onDown,
  onDelete,
  onClose,
}: {
  onTurn?: () => void;
  onDuplicate: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="block-menu block-actions" ref={box} role="menu">
      {onTurn && <button className="block-menu-item" role="menuitem" onClick={onTurn}><Type size={15} /> Turn into…</button>}
      <button className="block-menu-item" role="menuitem" onClick={onDuplicate}><Copy size={15} /> Duplicate</button>
      {onUp && <button className="block-menu-item" role="menuitem" onClick={onUp}><ArrowUp size={15} /> Move up</button>}
      {onDown && <button className="block-menu-item" role="menuitem" onClick={onDown}><ArrowDown size={15} /> Move down</button>}
      <button className="block-menu-item danger" role="menuitem" onClick={onDelete}><Trash2 size={15} /> Delete</button>
      <button className="block-menu-item" role="menuitem" onClick={onClose}><X size={15} /> Close</button>
    </div>
  );
}
