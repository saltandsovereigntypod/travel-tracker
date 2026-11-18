"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Trash2, Plus, X } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Modal } from "../ui/Modal";
import { Field } from "../ui/Fields";
import { useEngine } from "./engine";
import {
  FIELD_TYPES, OPTION_COLORS, fid, fieldTypeMeta, linkPaths, linkTarget, newField, stepsFromText, stepsToText,
  type Cadence, type FieldDef, type FieldOption, type FieldType, type ListDef, type OptionKind, type RollupOp,
} from "@/lib/fields";
import { useToast } from "../ui/Toast";
import { LIST_TEMPLATES, buildLists } from "@/lib/list-templates";
import { PAGE_TEMPLATES } from "@/lib/page-templates";

const ROLLUP_OPS: { op: RollupOp; label: string; needs: "none" | "number" | "date" | "done" }[] = [
  { op: "count", label: "Count linked items", needs: "none" },
  { op: "sum", label: "Total of…", needs: "number" },
  { op: "avg", label: "Average of…", needs: "number" },
  { op: "min", label: "Lowest…", needs: "number" },
  { op: "max", label: "Highest…", needs: "number" },
  { op: "checked", label: "How many are done", needs: "done" },
  { op: "earliest", label: "Earliest date of…", needs: "date" },
  { op: "latest", label: "Latest date of…", needs: "date" },
];

/** Edit a list's name, icon and fields. Changes save as you go. */
export function ListSettings({ list, open, onClose }: { list: ListDef; open: boolean; onClose: () => void }) {
  const { update, remove, rows, tripId, canEdit } = useTrip();
  const { ctx } = useEngine();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [openField, setOpenField] = useState<string | null>(null);
  const templateKey = (list.settings as { template?: string })?.template;

  const saveFields = (fields: FieldDef[]) => update("lists", list.id, { fields });
  const patchField = (id: string, p: Partial<FieldDef>) => saveFields(list.fields.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const move = (i: number, d: number) => {
    const next = list.fields.slice();
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void saveFields(next);
  };

  function addField(type: FieldType) {
    const f = newField(type);
    if (type === "relation") {
      const other = rows.lists.find((l) => l.id !== list.id);
      if (other) {
        f.listId = other.id;
        f.name = other.name;
      }
    }
    void saveFields([...list.fields, f]);
    setAdding(false);
    setOpenField(f.id);
  }

  return (
    <Modal open={open} onClose={onClose} title="List settings" size="lg" footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}>
      <fieldset disabled={!canEdit} style={{ display: "contents" }}>
        <div className="form-grid">
          <Field label="Name" full>
            <div className="row">
              <input className="input" style={{ width: 64, textAlign: "center", fontSize: "1.3rem" }} defaultValue={list.icon} aria-label="Icon" onBlur={(e) => e.target.value !== list.icon && update("lists", list.id, { icon: e.target.value.slice(0, 4) || "📋" })} />
              <input className="input grow" defaultValue={list.name} onBlur={(e) => e.target.value.trim() && e.target.value !== list.name && update("lists", list.id, { name: e.target.value.trim() })} />
            </div>
          </Field>
          <Field label="What each item is called" hint="Shown as the first field, e.g. Guest, Episode, Bill.">
            <input
              className="input"
              defaultValue={(list.settings as { titleLabel?: string })?.titleLabel ?? "Name"}
              onBlur={(e) => update("lists", list.id, { settings: { ...list.settings, titleLabel: e.target.value.trim() || "Name" } })}
            />
          </Field>
        </div>

        {list.fields.some((f) => f.type === "money") && (list.fields.some((f) => f.type === "checkbox") || list.fields.some((f) => f.type === "status")) && (
          <label className="row small" style={{ marginTop: "0.8rem" }}>
            <input
              type="checkbox"
              checked={!!(list.settings as { autoPay?: boolean })?.autoPay}
              onChange={(e) => update("lists", list.id, { settings: { ...list.settings, autoPay: e.target.checked } })}
            />
            When an item is marked done, record its payment automatically
          </label>
        )}

        {templateKey && canEdit && <TemplateUpdate list={list} templateKey={templateKey} />}

        <h3 style={{ margin: "1.2rem 0 0.6rem" }}>Fields</h3>
        <div className="stack" style={{ gap: 6 }}>
          {list.fields.map((f, i) => (
            <div key={f.id} className="field-edit">
              <div className="row">
                <span aria-hidden style={{ width: 24, textAlign: "center" }}>{fieldTypeMeta(f.type).icon}</span>
                <input className="input grow" defaultValue={f.name} aria-label="Field name" onBlur={(e) => e.target.value.trim() && e.target.value !== f.name && patchField(f.id, { name: e.target.value.trim() })} />
                <span className="tiny muted hide-phone" style={{ width: 110 }}>{fieldTypeMeta(f.type).label}</span>
                <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={16} /></button>
                <button type="button" className="icon-btn" aria-label="Move down" disabled={i === list.fields.length - 1} onClick={() => move(i, 1)}><ChevronDown size={16} /></button>
                <button type="button" className="btn btn-sm" onClick={() => setOpenField(openField === f.id ? null : f.id)}>{openField === f.id ? "Close" : "Options"}</button>
              </div>
              {openField === f.id && (
                <FieldOptions
                  field={f}
                  list={list}
                  onPatch={(p) => patchField(f.id, p)}
                  onDelete={() => {
                    if (confirm(`Delete the "${f.name}" field? Its values will be removed from every item.`)) void saveFields(list.fields.filter((x) => x.id !== f.id));
                  }}
                />
              )}
            </div>
          ))}
        </div>
        {linkPaths(list, ctx).some((p) => p.key.startsWith("back:")) && (
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Also linked from: {linkPaths(list, ctx).filter((p) => p.key.startsWith("back:")).map((p) => p.name).join(", ")} (shown on every item automatically).
          </p>
        )}

        {adding ? (
          <div className="card card-tight" style={{ marginTop: 10 }}>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <strong className="small">Add a field</strong>
              <button type="button" className="icon-btn" onClick={() => setAdding(false)} aria-label="Cancel"><X size={16} /></button>
            </div>
            {(["Basics", "Choices", "People & places", "Connections"] as const).map((g) => (
              <div key={g} style={{ marginBottom: 8 }}>
                <div className="tiny muted" style={{ fontWeight: 700, margin: "4px 0" }}>{g}</div>
                <div className="add-grid">
                  {FIELD_TYPES.filter((t) => t.group === g).map((t) => (
                    <button
                      type="button"
                      key={t.type}
                      onClick={() => addField(t.type)}
                      disabled={(t.type === "relation" && rows.lists.length < 2) || (t.type === "rollup" && !linkPaths(list, ctx).length)}
                      title={t.feeds ? `Feeds: ${t.feeds}` : undefined}
                    >
                      <span aria-hidden>{t.icon}</span> {t.label}
                      {t.feeds && <span className="tiny muted" style={{ marginLeft: "auto" }}>→ {t.feeds}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {rows.lists.length < 2 && <p className="tiny muted">Make another list to link lists together.</p>}
          </div>
        ) : (
          canEdit && <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => setAdding(true)}><Plus size={15} /> Add field</button>
        )}

        {canEdit && (
          <div style={{ marginTop: "1.6rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                const n = rows.list_items.filter((i) => i.list_id === list.id).length;
                if (!confirm(`Delete the "${list.name}" list and its ${n} item${n === 1 ? "" : "s"}? This can't be undone.`)) return;
                // Unhook fields in other lists that link here.
                for (const other of rows.lists.filter((l) => l.id !== list.id)) {
                  if (other.fields.some((f) => f.type === "relation" && f.listId === list.id)) {
                    await update("lists", other.id, { fields: other.fields.filter((f) => !(f.type === "relation" && f.listId === list.id)) });
                  }
                }
                await remove("lists", list.id);
                onClose();
                router.replace(`/trips/${tripId}`);
              }}
            >
              <Trash2 size={15} /> Delete list
            </button>
          </div>
        )}
      </fieldset>
    </Modal>
  );
}

function FieldOptions({ field, list, onPatch, onDelete }: { field: FieldDef; list: ListDef; onPatch: (p: Partial<FieldDef>) => void; onDelete: () => void }) {
  const { rows } = useTrip();
  const { ctx } = useEngine();
  const paths = linkPaths(list, ctx);
  const hasOptions = field.type === "select" || field.type === "multiselect" || field.type === "status";
  const target = field.rollup?.via ? linkTarget(list, field.rollup.via, ctx) : undefined;
  const opNeeds = ROLLUP_OPS.find((o) => o.op === field.rollup?.op)?.needs ?? "none";

  return (
    <div className="stack" style={{ gap: 8, paddingLeft: 30 }}>
      {hasOptions && <OptionsEditor field={field} onChange={(options) => onPatch({ options })} />}

      {field.type === "relation" && (
        <Field label="Links to">
          <select className="input" value={field.listId ?? ""} onChange={(e) => onPatch({ listId: e.target.value })}>
            {rows.lists.filter((l) => l.id !== list.id).map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
          </select>
        </Field>
      )}

      {field.type === "rollup" && (
        <div className="form-grid">
          <Field label="Follow the link">
            <select className="input" value={field.rollup?.via ?? ""} onChange={(e) => onPatch({ rollup: { op: field.rollup?.op ?? "count", via: e.target.value } })}>
              <option value="">Choose…</option>
              {paths.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="And show">
            <select className="input" value={field.rollup?.op ?? "count"} onChange={(e) => onPatch({ rollup: { via: field.rollup?.via ?? "", target: field.rollup?.target, op: e.target.value as RollupOp } })}>
              {ROLLUP_OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
            </select>
          </Field>
          {target && opNeeds !== "none" && opNeeds !== "done" && (
            <Field label="Of which field" full>
              <select className="input" value={field.rollup?.target ?? ""} onChange={(e) => onPatch({ rollup: { ...field.rollup!, target: e.target.value } })}>
                <option value="">Choose…</option>
                {target.fields
                  .filter((f) => (opNeeds === "number" ? ["number", "money", "rating"].includes(f.type) : ["date", "datetime"].includes(f.type)))
                  .map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          )}
        </div>
      )}

      {field.type === "money" && (
        <>
          <Field label="This money is">
            <select className="input" value={field.moneyKind ?? "cost"} onChange={(e) => onPatch({ moneyKind: e.target.value as "cost" | "income" })}>
              <option value="cost">Spending (counts toward the budget)</option>
              <option value="income">Money coming in (sponsors, gifts, refunds)</option>
            </select>
          </Field>
          {field.moneyKind !== "income" && (
            <label className="row small"><input type="checkbox" checked={field.feeds?.budget !== false} onChange={(e) => onPatch({ feeds: { ...field.feeds, budget: e.target.checked } })} /> Count this in the budget</label>
          )}
        </>
      )}
      {(field.type === "date" || field.type === "datetime") && (
        <>
          <label className="row small"><input type="checkbox" checked={field.feeds?.calendar !== false} onChange={(e) => onPatch({ feeds: { ...field.feeds, calendar: e.target.checked } })} /> Show on the calendar</label>
          <Field label="How often do you expect one?" hint="Flags the weeks or months with nothing scheduled, e.g. a weekly release.">
            <select className="input" value={field.cadence ?? ""} onChange={(e) => onPatch({ cadence: (e.target.value || undefined) as Cadence | undefined })}>
              <option value="">No set rhythm</option>
              <option value="week">Every week</option>
              <option value="2weeks">Every 2 weeks</option>
              <option value="month">Every month</option>
            </select>
          </Field>
        </>
      )}
      {field.type === "checklist" && (
        <>
          <Field label="Steps" hint="One step per line. Start a line with # to begin a stage, e.g. “# Recorded”. Every item gets these steps.">
            <textarea className="input textarea" rows={8} defaultValue={stepsToText(field.steps ?? [])} onBlur={(e) => onPatch({ steps: stepsFromText(e.target.value, field.steps ?? []) })} placeholder={"# Written\nResearch\nOutline\n# Recorded\nRecord\nBack up files"} />
          </Field>
          {list.fields.some((f) => f.type === "status") && (
            <label className="row small">
              <input type="checkbox" checked={!!field.autoAdvance} onChange={(e) => onPatch({ autoAdvance: e.target.checked })} />
              When a stage&apos;s steps are all ticked, move the status to that stage (stages match statuses by name)
            </label>
          )}
        </>
      )}
      {field.type === "page" && (
        <Field label="New pages start from">
          <select className="input" value={field.pageTemplate ?? "blank"} onChange={(e) => onPatch({ pageTemplate: e.target.value })}>
            {PAGE_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.icon} {t.name}</option>)}
          </select>
        </Field>
      )}
      {field.type === "place" && (
        <label className="row small"><input type="checkbox" checked={field.feeds?.map !== false} onChange={(e) => onPatch({ feeds: { ...field.feeds, map: e.target.checked } })} /> Pin on the map</label>
      )}

      <button type="button" className="btn btn-sm btn-ghost btn-danger" style={{ alignSelf: "flex-start" }} onClick={onDelete}><Trash2 size={14} /> Delete field</button>
    </div>
  );
}

function OptionsEditor({ field, onChange }: { field: FieldDef; onChange: (o: FieldOption[]) => void }) {
  const options = field.options ?? [];
  const [label, setLabel] = useState("");
  const set = (i: number, p: Partial<FieldOption>) => onChange(options.map((o, j) => (j === i ? { ...o, ...p } : o)));
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="field-label">Choices</span>
      {options.map((o, i) => (
        <div key={o.id} className="row">
          <input type="color" value={o.color} onChange={(e) => set(i, { color: e.target.value })} aria-label="Color" style={{ width: 34, height: 34, border: "1px solid var(--border)", borderRadius: 8, padding: 2, background: "none" }} />
          <input className="input grow" defaultValue={o.label} onBlur={(e) => e.target.value.trim() && e.target.value !== o.label && set(i, { label: e.target.value.trim() })} />
          {field.type === "status" && (
            <select className="input" style={{ width: 130 }} value={o.kind ?? "todo"} onChange={(e) => set(i, { kind: e.target.value as OptionKind })} aria-label="Counts as">
              <option value="todo">Not started</option>
              <option value="doing">In progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
          <button type="button" className="icon-btn" aria-label={`Remove ${o.label}`} onClick={() => onChange(options.filter((_, j) => j !== i))}><X size={15} /></button>
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          onChange([...options, { id: fid("o"), label: label.trim(), color: OPTION_COLORS[options.length % OPTION_COLORS.length], ...(field.type === "status" ? { kind: "todo" as OptionKind } : {}) }]);
          setLabel("");
        }}
      >
        <input className="input grow" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add a choice" />
        <button className="btn btn-sm" disabled={!label.trim()}><Plus size={14} /></button>
      </form>
      {field.type === "status" && <span className="tiny muted">&quot;Done&quot; choices count toward progress; &quot;Cancelled&quot; ones drop out of the budget and calendar.</span>}
    </div>
  );
}

/** Lists made from a template can pick up fields the template has gained since (nothing is removed). */
function TemplateUpdate({ list, templateKey }: { list: ListDef; templateKey: string }) {
  const { rows, update, tripId } = useTrip();
  const toast = useToast();
  const tpl = LIST_TEMPLATES.find((t) => t.key === templateKey);
  if (!tpl) return null;
  const fresh = buildLists([templateKey], tripId, rows.lists.filter((l) => l.id !== list.id))[0];
  const missing = fresh.fields.filter((f) => !list.fields.some((x) => x.id === f.id || x.name.trim().toLowerCase() === f.name.trim().toLowerCase()));
  if (!missing.length) return null;
  return (
    <div className="template-update">
      <span className="small">
        The {tpl.name} template has {missing.length} newer field{missing.length === 1 ? "" : "s"}: {missing.map((f) => f.name).join(", ")}.
      </span>
      <button
        type="button"
        className="btn btn-sm"
        onClick={async () => {
          await update("lists", list.id, { fields: [...list.fields, ...missing] });
          toast.success(`Added ${missing.length} field${missing.length === 1 ? "" : "s"}. Nothing you had was changed.`);
        }}
      >
        Add {missing.length === 1 ? "it" : "them"}
      </button>
    </div>
  );
}
