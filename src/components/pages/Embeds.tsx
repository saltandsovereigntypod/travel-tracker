"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, Link2, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useTrip } from "../TripProvider";
import { useToast } from "../ui/Toast";
import { Segmented } from "../ui/Fields";
import { BoardView, CardsView, ChecklistView, ItemCard, TableView } from "../lists/Views";
import { ListItemModal } from "../lists/ItemModal";
import { useCommitItem } from "../lists/automation";
import { BlockRenderer } from "../view/BlockRenderer";
import { shrinkImage } from "../sections/Photos";
import { BLOCKS } from "@/lib/blocks";
import { moduleBySlug } from "@/lib/spaces";
import { defaultGroupField, filterItems, sortItems } from "@/lib/views";
import { statusField, type ListItem } from "@/lib/fields";
import { friendlyError, supabase } from "@/lib/supabase";
import { normalizeUrl } from "@/lib/format";
import type { DocBlock, EmbedView } from "@/lib/pages";
import type { BlockType } from "@/lib/types";

type Change = (b: DocBlock) => void;

// ---------------------------------------------------------------- list view
export function ListEmbed({ block, onChange, canEdit, bare }: { block: DocBlock; onChange: Change; canEdit: boolean; bare?: boolean }) {
  const { rows, me, insert } = useTrip();
  const commit = useCommitItem();
  const [open, setOpen] = useState<string | null>(null);
  const [quick, setQuick] = useState("");
  const [all, setAll] = useState(false);
  const list = rows.lists.find((l) => l.id === block.listId);
  const items = useMemo(() => {
    if (!list) return [];
    const mine = rows.list_items.filter((i) => i.list_id === list.id);
    return sortItems(filterItems(mine, list, { mine: block.mine, hideDone: block.hideDone }, me, ""), list);
  }, [list, rows.list_items, block.mine, block.hideDone, me]);

  if (!list) {
    return (
      <div className="doc-embed doc-embed-empty">
        {rows.lists.length ? (
          canEdit ? (
            <label className="row wrap" style={{ gap: 8 }}>
              <span className="small">Show a list here:</span>
              <select className="input" style={{ width: "auto" }} value="" onChange={(e) => onChange({ ...block, listId: e.target.value })}>
                <option value="" disabled>Pick a list…</option>
                {rows.lists.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
              </select>
            </label>
          ) : (
            <span className="small muted">This list was deleted.</span>
          )
        ) : (
          <span className="small muted">This space has no lists yet. Make one from the sidebar (“New list”), then pick it here.</span>
        )}
      </div>
    );
  }

  const view: EmbedView = block.view ?? "cards";
  const limit = block.limit ?? 6;
  const shown = all || view === "board" ? items : items.slice(0, limit);
  const openItem = open ? rows.list_items.find((i) => i.id === open) ?? null : null;
  const canCheck = !!statusField(list) || list.fields.some((f) => f.type === "checkbox");

  function toggleDone(item: ListItem, done: boolean) {
    const sf = statusField(list!);
    if (sf) {
      const target = done ? sf.options?.find((o) => o.kind === "done") : sf.options?.find((o) => o.kind === "todo") ?? sf.options?.[0];
      void commit(list!, item, { ...item.values, [sf.id]: target?.id ?? null });
    } else {
      const cb = list!.fields.find((f) => f.type === "checkbox")!;
      void commit(list!, item, { ...item.values, [cb.id]: done });
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setQuick("");
    const values: Record<string, unknown> = {};
    if (block.mine) {
      const pf = list!.fields.find((f) => f.type === "person" || f.type === "people");
      if (pf) values[pf.id] = pf.type === "people" ? [me] : me;
    }
    const last = rows.list_items.filter((i) => i.list_id === list!.id).at(-1);
    await insert("list_items", { list_id: list!.id, title, values, sort_order: (last?.sort_order ?? 0) + 1 });
  }

  return (
    <div className={bare ? "list-block" : "doc-embed"}>
      <div className="doc-embed-head">
        {bare ? (
          <span className="tiny muted">{items.length} {items.length === 1 ? "item" : "items"}</span>
        ) : (
          <Link href={`/trips/${list.trip_id}/lists/${list.id}`} className="row doc-embed-title">
            <span aria-hidden>{list.icon}</span> {list.name}
            <span className="tiny muted">{items.length}</span>
          </Link>
        )}
        {canEdit && (
          <div className="row wrap doc-embed-controls" style={{ gap: 6 }}>
            <Segmented<EmbedView>
              size="sm"
              value={view}
              onChange={(v) => onChange({ ...block, view: v })}
              options={[
                { value: "cards", label: "Cards" },
                { value: "table", label: "Table" },
                ...(canCheck ? [{ value: "checklist" as const, label: "Checks" }] : []),
                ...(defaultGroupField(list) ? [{ value: "board" as const, label: "Board" }] : []),
              ]}
            />
            {list.fields.some((f) => f.type === "person" || f.type === "people") && (
              <label className="row tiny" style={{ gap: 4 }}><input type="checkbox" checked={!!block.mine} onChange={(e) => onChange({ ...block, mine: e.target.checked })} /> Only mine</label>
            )}
            {canCheck && (
              <label className="row tiny" style={{ gap: 4 }}><input type="checkbox" checked={!!block.hideDone} onChange={(e) => onChange({ ...block, hideDone: e.target.checked })} /> Hide done</label>
            )}
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p className="small muted" style={{ padding: "0.4rem 0" }}>{block.mine || block.hideDone ? "Nothing matches these filters." : "Nothing here yet."}</p>
      ) : view === "table" ? (
        <TableView list={list} items={shown} onOpen={setOpen} onSort={() => {}} />
      ) : view === "checklist" ? (
        <ChecklistView list={list} items={shown} onOpen={setOpen} canEdit={canEdit} onToggle={toggleDone} />
      ) : view === "board" ? (
        <BoardView
          list={list}
          items={shown}
          onOpen={setOpen}
          groupField={defaultGroupField(list)}
          canEdit={canEdit}
          onMove={(id, value) => {
            const gf = defaultGroupField(list)!;
            const it = items.find((x) => x.id === id);
            if (it) void commit(list, it, { ...it.values, [gf.id]: gf.type === "people" ? (value ? [value] : []) : value });
          }}
        />
      ) : (
        <CardsView list={list} items={shown} onOpen={setOpen} />
      )}
      {items.length > shown.length && (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setAll(true)}>Show all {items.length}</button>
      )}
      {canEdit && (
        <form className="quick-add doc-embed-add" onSubmit={add}>
          <input className="input" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={`Add to ${list.name}…`} aria-label={`Add to ${list.name}`} />
          <button className="btn btn-sm" disabled={!quick.trim()} aria-label="Add"><Plus size={15} /></button>
        </form>
      )}
      {openItem && <ListItemModal list={list} item={openItem} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- one linked item
export function ItemEmbed({ block, onChange, canEdit }: { block: DocBlock; onChange: Change; canEdit: boolean }) {
  const { rows } = useTrip();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const item = rows.list_items.find((i) => i.id === block.itemId);
  const list = item ? rows.lists.find((l) => l.id === item.list_id) : undefined;

  if (!item || !list) {
    if (!canEdit) return block.itemId ? <p className="small muted">This item was deleted.</p> : null;
    const needle = q.trim().toLowerCase();
    const matches = rows.list_items.filter((i) => !needle || i.title.toLowerCase().includes(needle)).slice(0, 8);
    return (
      <div className="doc-embed doc-embed-empty stack" style={{ gap: 6 }}>
        <div className="input-icon">
          <Search size={15} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an item from any list…" aria-label="Find an item" />
        </div>
        {rows.list_items.length === 0 && <span className="small muted">No list items in this space yet.</span>}
        <div className="stack" style={{ gap: 2 }}>
          {matches.map((i) => {
            const l = rows.lists.find((x) => x.id === i.list_id);
            return (
              <button key={i.id} className="pick-row" onClick={() => onChange({ ...block, itemId: i.id })}>
                <span aria-hidden>{l?.icon}</span> <span className="truncate grow">{i.title || "Untitled"}</span> <span className="tiny muted">{l?.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  const sf = statusField(list);
  const fields = list.fields.filter((f) => f !== sf && !["longtext", "rollup"].includes(f.type) && item.values[f.id] != null && item.values[f.id] !== "").slice(0, 5);
  return (
    <div className="doc-item">
      <div className="tiny muted row" style={{ gap: 4, marginBottom: 4 }}><span aria-hidden>{list.icon}</span> {list.name}</div>
      <ItemCard list={list} item={item} fields={fields} status={sf} onOpen={() => setOpen(true)} />
      {open && <ListItemModal list={list} item={item} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- live widget
const WIDGETS = BLOCKS.filter((b) => b.group === "Trip info");

export function WidgetEmbed({ block, onChange, canEdit }: { block: DocBlock; onChange: Change; canEdit: boolean }) {
  const { hasModule, moduleName, noun } = useTrip();
  const available = WIDGETS.filter((w) => {
    const m = w.section ? moduleBySlug(w.section) : undefined;
    return !m || hasModule(m.id);
  });
  const label = (t: BlockType) => {
    const w = WIDGETS.find((x) => x.type === t)!;
    const m = w.section ? moduleBySlug(w.section) : undefined;
    if (m) return moduleName(m.id);
    if (t === "hero") return `${noun[0].toUpperCase()}${noun.slice(1)} header`;
    if (t === "people") return "People";
    return w.label;
  };
  const type = block.widget as BlockType | undefined;
  if (!type || !WIDGETS.some((w) => w.type === type)) {
    if (!canEdit) return null;
    return (
      <div className="doc-embed doc-embed-empty">
        <span className="small" style={{ display: "block", marginBottom: 6 }}>Show something live from this {noun}:</span>
        <div className="row wrap" style={{ gap: 6 }}>
          {available.map((w) => <button key={w.type} className="chip" onClick={() => onChange({ ...block, widget: w.type })}>{label(w.type)}</button>)}
        </div>
      </div>
    );
  }
  return (
    <div className="doc-widget">
      <BlockRenderer block={{ id: block.id, type, props: type === "ideas" ? { limit: 4 } : undefined }} />
    </div>
  );
}

// ---------------------------------------------------------------- image
export function ImageEmbed({ block, onChange, canEdit }: { block: DocBlock; onChange: Change; canEdit: boolean }) {
  const { tripId, photoUrl, ensurePhotoUrls } = useTrip();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const path = block.url?.startsWith("storage:") ? block.url.slice(8) : null;
  useEffect(() => {
    if (path) void ensurePhotoUrls([path]);
  }, [path, ensurePhotoUrls]);
  const src = path ? photoUrl(path) : block.url;

  async function upload(f: File) {
    setBusy(true);
    try {
      const { blob, ext } = await shrinkImage(f, 2000);
      const p = `${tripId}/pages/${crypto.randomUUID()}.${ext}`;
      const up = await supabase().storage.from("trip-media").upload(p, blob, { contentType: blob.type || f.type });
      if (up.error) throw up.error;
      onChange({ ...block, url: `storage:${p}` });
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!block.url) {
    if (!canEdit) return null;
    return (
      <div className="doc-embed doc-embed-empty row wrap" style={{ gap: 8 }}>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        <button className="btn btn-sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />} Upload a picture
        </button>
        <form className="row grow" style={{ gap: 6, minWidth: 200 }} onSubmit={(e) => { e.preventDefault(); const u = normalizeUrl(link); if (u) onChange({ ...block, url: u }); }}>
          <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste an image link" aria-label="Image link" />
          <button className="btn btn-sm" disabled={!link.trim()} aria-label="Use link"><Link2 size={15} /></button>
        </form>
      </div>
    );
  }
  return (
    <figure className="doc-image">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={block.caption || ""} loading="lazy" />
      ) : (
        <div className="doc-image-loading"><Loader2 className="spin" /></div>
      )}
      {canEdit ? (
        <input className="doc-caption" value={block.caption ?? ""} onChange={(e) => onChange({ ...block, caption: e.target.value })} placeholder="Add a caption" aria-label="Caption" />
      ) : (
        block.caption && <figcaption className="doc-caption">{block.caption}</figcaption>
      )}
      {canEdit && (
        <button className="icon-btn doc-image-remove" onClick={() => onChange({ ...block, url: undefined })} aria-label="Remove picture"><Trash2 size={15} /></button>
      )}
    </figure>
  );
}

