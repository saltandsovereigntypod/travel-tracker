"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, ArrowUpRight, Link2 } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Modal } from "../ui/Modal";
import { CommentThread } from "../sections/Comments";
import { PaymentPanel } from "../sections/Payments";
import { FieldInput, LinkPicker } from "./FieldInput";
import { FieldValue } from "./FieldValue";
import { listHref, useEngine } from "./engine";
import { useCommitItem } from "./automation";
import {
  asIds, backlinksFor, fieldTypeMeta, itemFeeds, itemIncomeTotal, itemMoneyTotal, linkedItems, stripLinks,
  type FieldDef, type FieldOption, type ListDef, type ListItem,
} from "@/lib/fields";

/** Adds a new choice to a dropdown/tags field from inside an item. */
export function useAddOption(list: ListDef) {
  const { update } = useTrip();
  return (field: FieldDef, option: FieldOption) =>
    update("lists", list.id, { fields: list.fields.map((f) => (f.id === field.id ? { ...f, options: [...(f.options ?? []), option] } : f)) });
}

export function ListItemModal({ list, item, onClose }: { list: ListDef; item: ListItem | null; onClose: () => void }) {
  const { update, remove, canEdit, tripId, rows } = useTrip();
  const { ctx, money, itemById } = useEngine();
  const addOption = useAddOption(list);
  const commit = useCommitItem();
  // Always show the freshest copy (others may be editing live).
  const live = item ? itemById(item.id) ?? item : null;
  const [title, setTitle] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if ((live?.id ?? null) !== loadedFor) {
    setLoadedFor(live?.id ?? null);
    setTitle(live?.title ?? "");
  }
  if (!live) return null;

  const setValue = (fieldId: string, value: unknown) => commit(list, live, { ...live.values, [fieldId]: value });
  const total = itemMoneyTotal(live, list, money);
  const income = itemIncomeTotal(live, list, money);
  const feeds = itemFeeds(live, list);
  const backlinks = backlinksFor(list, ctx);
  const titleLabel = (list.settings as { titleLabel?: string })?.titleLabel ?? "Name";

  async function del() {
    if (!live || !confirm(`Delete "${live.title || "this item"}"?`)) return;
    // Remove links pointing at this item from other lists first.
    for (const other of ctx.items) {
      if (other.id === live.id) continue;
      const l = ctx.lists.find((x) => x.id === other.list_id);
      const cleaned = l && stripLinks(other.values, l, live.id);
      if (cleaned) await update("list_items", other.id, { values: cleaned });
    }
    await remove("list_items", live.id);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={<span className="row" style={{ fontSize: "1rem" }}>{list.icon} <span className="truncate muted">{list.name}</span></span>}
      footer={
        canEdit && (
          <>
            <button className="btn btn-danger" onClick={del}><Trash2 size={15} /> Delete</button>
            <span className="spacer" />
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </>
        )
      }
    >
      <div className="stack" style={{ gap: "0.4rem" }}>
        <input
          className="input heading"
          style={{ fontSize: "1.35rem", fontWeight: 700 }}
          value={title}
          disabled={!canEdit}
          placeholder={titleLabel}
          aria-label={titleLabel}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== live.title && update("list_items", live.id, { title })}
        />
        {feeds.length > 0 && (
          <div className="feeds-row" title="Where this shows up automatically">
            <span className="tiny muted">Feeds:</span>
            {feeds.map((f) => <span key={f} className="feed-chip">{f}</span>)}
          </div>
        )}

        {list.fields.map((f) => (
          <div key={f.id} className="field-row">
            <span className="field-name"><span aria-hidden>{fieldTypeMeta(f.type).icon}</span> {f.name}</span>
            <div>
              {f.type === "rollup" ? (
                <div style={{ paddingTop: "0.5rem" }}><FieldValue field={f} item={live} list={list} /> {f.rollup?.via ? null : <span className="tiny muted">Set this up in list settings.</span>}</div>
              ) : (
                <FieldInput field={f} item={live} list={list} disabled={!canEdit} onChange={(v) => setValue(f.id, v)} onAddOption={addOption} />
              )}
            </div>
          </div>
        ))}

        {/* Links other lists made to this item, editable from this side too. */}
        {backlinks.map((b) => {
          const linked = linkedItems(live, b.key, ctx);
          const sources = ctx.items.filter((i) => i.list_id === b.fromList.id);
          return (
            <div key={b.key} className="field-row">
              <span className="field-name"><Link2 size={13} /> {b.fromList.name}</span>
              <div>
                <LinkPicker
                  targetName={b.fromList.name}
                  options={sources}
                  selected={linked.map((i) => i.id)}
                  disabled={!canEdit}
                  onToggle={(id) => {
                    const src = sources.find((s) => s.id === id);
                    if (!src) return;
                    const ids = asIds(src.values[b.field.id]);
                    const next = ids.includes(live.id) ? ids.filter((x) => x !== live.id) : [...ids, live.id];
                    void update("list_items", src.id, { values: { ...src.values, [b.field.id]: next } });
                  }}
                />
                {linked.length > 0 && (
                  <div className="row wrap" style={{ marginTop: 6, gap: 6 }}>
                    {linked.map((i) => (
                      <Link key={i.id} className="tiny row" style={{ gap: 2, color: "var(--accent2)" }} href={listHref(tripId, b.fromList.id, i.id)} onClick={onClose}>
                        Open {i.title || "item"} <ArrowUpRight size={11} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {total != null && (
          <div style={{ marginTop: "0.8rem" }}>
            <PaymentPanel type="list_item" id={live.id} category="other" />
          </div>
        )}
        {income != null && (
          <div style={{ marginTop: "0.8rem" }}>
            <PaymentPanel type="list_item" id={live.id} category="other" income />
          </div>
        )}
        {(list.settings as { autoPay?: boolean })?.autoPay && total != null && (
          <p className="tiny muted">Ticking it done records the payment automatically{list.fields.some((f) => f.type === "repeat") ? " and, if it repeats, moves it to the next due date" : ""}.</p>
        )}

        {list.fields.some((f) => f.type === "relation") && rows.lists.length < 2 && (
          <p className="tiny muted">Tip: add another list, then a &quot;Link to another list&quot; field, to connect them.</p>
        )}

        <h3 style={{ marginTop: "1rem" }}>Comments</h3>
        <CommentThread entity="list_item" id={live.id} />
      </div>
    </Modal>
  );
}
