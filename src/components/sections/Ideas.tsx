"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, MessageCircle, Plus, ExternalLink, CalendarPlus, MapPin, Lightbulb, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "../TripProvider";
import { Modal } from "../ui/Modal";
import { Avatar, EmptyState, Field, PlaceSearch, Segmented } from "../ui/Fields";
import { CommentThread, useCommentCount } from "./Comments";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { formatDay, formatMoney, hostname, normalizeUrl, tripDays } from "@/lib/format";
import type { Idea, IdeaStatus, Place } from "@/lib/types";

type Filter = "all" | IdeaStatus;

export function useIdeaScores() {
  const { rows } = useTrip();
  return useMemo(() => {
    const m: Record<string, { up: number; down: number; score: number }> = {};
    for (const v of rows.idea_votes) {
      const s = (m[v.idea_id] ??= { up: 0, down: 0, score: 0 });
      if (v.value > 0) s.up++;
      else s.down++;
      s.score += v.value;
    }
    return m;
  }, [rows.idea_votes]);
}

export function IdeasSection({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const { rows, canEdit, tripId } = useTrip();
  const scores = useIdeaScores();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"top" | "new">("top");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Idea | "new" | null>(null);
  const [scheduling, setScheduling] = useState<Idea | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.ideas.length, open: 0, maybe: 0, planned: 0, passed: 0 };
    rows.ideas.forEach((i) => (c[i.status] = (c[i.status] ?? 0) + 1));
    return c;
  }, [rows.ideas]);

  const list = useMemo(() => {
    // "All" hides passed ideas in the compact block so it stays focused.
    let l = rows.ideas.filter((i) => (filter === "all" ? !(compact && i.status === "passed") : i.status === filter));
    if (category) l = l.filter((i) => i.category === category);
    l = [...l].sort((a, b) =>
      sort === "top"
        ? (scores[b.id]?.score ?? 0) - (scores[a.id]?.score ?? 0) || b.created_at.localeCompare(a.created_at)
        : b.created_at.localeCompare(a.created_at),
    );
    return limit ? l.slice(0, limit) : l;
  }, [rows.ideas, filter, category, sort, scores, limit, compact]);

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <h1>Ideas</h1>
            <p>Everything anyone wants to do. Vote, comment, then add the winners to the itinerary.</p>
          </div>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus size={16} /> Add idea
            </button>
          )}
        </div>
      )}
      {!compact && (
        <div className="toolbar" style={{ marginBottom: "1rem" }}>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "open", label: "New", count: counts.open },
              { value: "maybe", label: "Maybe", count: counts.maybe },
              { value: "planned", label: "Planned", count: counts.planned },
              { value: "passed", label: "Passed", count: counts.passed },
            ]}
          />
          <div className="grow" />
          <select className="input" style={{ width: "auto" }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
          <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: "top", label: "Top voted" }, { value: "new", label: "Newest" }]} />
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={<Lightbulb />}
          title={rows.ideas.length ? "Nothing matches" : "No ideas yet"}
          action={canEdit && <button className="btn btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add the first idea</button>}
        >
          {rows.ideas.length ? "Try a different filter." : "Restaurants, tours, shops, that one bookstore… drop it all here."}
        </EmptyState>
      ) : (
        <div className="grid-cards" style={compact ? { gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" } : undefined}>
          {list.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} compact={compact} onEdit={() => setEditing(idea)} onSchedule={() => setScheduling(idea)} />
          ))}
        </div>
      )}
      {compact && (
        <div className="row" style={{ marginTop: "0.8rem" }}>
          {canEdit && <button className="btn btn-sm" onClick={() => setEditing("new")}><Plus size={14} /> Add idea</button>}
          <Link className="btn btn-sm btn-ghost" href={`/trips/${tripId}/ideas`}>See all {rows.ideas.length} →</Link>
        </div>
      )}
      <IdeaModal idea={editing} onClose={() => setEditing(null)} onSchedule={(i) => { setEditing(null); setScheduling(i); }} />
      <ScheduleModal idea={scheduling} onClose={() => setScheduling(null)} />
    </div>
  );
}

function IdeaCard({ idea, compact, onEdit, onSchedule }: { idea: Idea; compact?: boolean; onEdit: () => void; onSchedule: () => void }) {
  const { me, rows, vote, nameOf, colorOf, canEdit, trip } = useTrip();
  const scores = useIdeaScores();
  const s = scores[idea.id] ?? { up: 0, down: 0, score: 0 };
  const mine = rows.idea_votes.find((v) => v.idea_id === idea.id && v.user_id === me)?.value ?? 0;
  const comments = useCommentCount("idea", idea.id);
  const cat = categoryOf(idea.category);
  const voters = rows.idea_votes.filter((v) => v.idea_id === idea.id && v.value > 0).map((v) => v.user_id);

  return (
    <article className={clsx("card idea-card card-hover", `status-${idea.status}`)}>
      {!compact && (
        <button
          className="idea-img"
          onClick={onEdit}
          style={{ border: 0, cursor: "pointer", ...(idea.image_url ? { backgroundImage: `url("${idea.image_url.replace(/"/g, "")}")` } : {}) }}
          aria-label={`Open ${idea.title}`}
        >
          {!idea.image_url && cat.emoji}
        </button>
      )}
      <div className="idea-body">
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <button onClick={onEdit} style={{ all: "unset", cursor: "pointer" }}>
            <h3>{compact && <span style={{ marginRight: 6 }}>{cat.emoji}</span>}{idea.title}</h3>
          </button>
          {idea.status === "planned" && <span className="chip chip-ok">Planned</span>}
          {idea.status === "maybe" && <span className="chip chip-2">Maybe</span>}
        </div>
        {!compact && idea.description && <p className="muted small" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.description}</p>}
        <div className="chip-row">
          {!compact && <span className="chip">{cat.emoji} {cat.label}</span>}
          {idea.est_cost != null && <span className="chip chip-muted">{formatMoney(idea.est_cost, trip?.currency)}</span>}
          {idea.location?.name && !compact && <span className="chip chip-muted"><MapPin size={12} /> {idea.location.name}</span>}
          {idea.url && (
            <a className="chip chip-2" href={idea.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} /> {hostname(idea.url)}
            </a>
          )}
        </div>
        {!compact && (
          <span className="row tiny muted" style={{ marginTop: "auto" }}>
            <Avatar name={nameOf(idea.created_by)} color={colorOf(idea.created_by)} size={18} /> Added by {nameOf(idea.created_by)}
          </span>
        )}
      </div>
      <div className="idea-foot">
        <button className={clsx("vote-btn", mine === 1 && "on")} onClick={() => vote(idea.id, mine === 1 ? 0 : 1)} aria-label="Vote up" title={voters.map(nameOf).join(", ") || "Vote up"}>
          <ThumbsUp size={14} /> {s.up}
        </button>
        <button className={clsx("vote-btn down", mine === -1 && "on")} onClick={() => vote(idea.id, mine === -1 ? 0 : -1)} aria-label="Vote down">
          <ThumbsDown size={14} /> {s.down || ""}
        </button>
        <button className="vote-btn" onClick={onEdit} aria-label="Comments">
          <MessageCircle size={14} /> {comments || ""}
        </button>
        <div className="grow" />
        {canEdit && idea.status !== "planned" && (
          <button className="btn btn-sm btn-ghost" onClick={onSchedule} title="Add to itinerary">
            <CalendarPlus size={15} /> {!compact && "Schedule"}
          </button>
        )}
      </div>
    </article>
  );
}

const blankIdea = { title: "", description: "", url: "", image_url: "", category: "activity", est_cost: "", location: {} as Place, status: "open" as IdeaStatus };

function IdeaModal({ idea, onClose, onSchedule }: { idea: Idea | "new" | null; onClose: () => void; onSchedule: (i: Idea) => void }) {
  const { insert, update, remove, canEdit, trip, me } = useTrip();
  const isNew = idea === "new";
  const existing = idea && idea !== "new" ? idea : null;
  const [form, setForm] = useState(blankIdea);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const key = isNew ? "new" : existing?.id ?? null;
  if (key !== loadedFor) {
    setLoadedFor(key);
    setForm(
      existing
        ? {
            title: existing.title,
            description: existing.description,
            url: existing.url ?? "",
            image_url: existing.image_url ?? "",
            category: existing.category,
            est_cost: existing.est_cost?.toString() ?? "",
            location: existing.location ?? {},
            status: existing.status,
          }
        : blankIdea,
    );
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const near = trip?.lat != null && trip?.lng != null ? { lat: trip.lat, lng: trip.lng } : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = {
      title: form.title.trim(),
      description: form.description.trim(),
      url: normalizeUrl(form.url),
      image_url: normalizeUrl(form.image_url),
      category: form.category,
      est_cost: form.est_cost === "" ? null : Number(form.est_cost),
      location: form.location,
      status: form.status,
    };
    if (!row.title) return;
    const ok = existing ? await update("ideas", existing.id, row) : !!(await insert("ideas", { ...row, created_by: me }));
    if (ok) onClose();
  }

  return (
    <Modal
      open={!!idea}
      onClose={onClose}
      title={isNew ? "New idea" : canEdit ? "Edit idea" : existing?.title}
      size="lg"
      footer={
        canEdit && (
          <>
            {existing && (
              <button
                className="btn btn-danger"
                type="button"
                onClick={async () => {
                  if (confirm(`Delete "${existing.title}"?`)) {
                    await remove("ideas", existing.id);
                    onClose();
                  }
                }}
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
            {existing && existing.status !== "planned" && (
              <button className="btn" type="button" onClick={() => onSchedule(existing)}>
                <CalendarPlus size={15} /> Add to itinerary
              </button>
            )}
            <span className="spacer" />
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" form="idea-form" disabled={!form.title.trim()}>{isNew ? "Add idea" : "Save"}</button>
          </>
        )
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: existing ? "minmax(0, 1.4fr) minmax(0, 1fr)" : "1fr", gap: "1.4rem" }} className="idea-modal-grid">
        <form id="idea-form" className="form-grid" onSubmit={save}>
          <fieldset disabled={!canEdit} style={{ display: "contents" }}>
            <Field label="What is it?" full>
              <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Salem Witch Museum" required maxLength={200} />
            </Field>
            <Field label="Category">
              <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </Field>
            <Field label={`Rough cost (${trip?.currency ?? "USD"})`}>
              <input className="input" type="number" min="0" step="0.01" value={form.est_cost} onChange={(e) => set("est_cost", e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Link" full>
              <input className="input" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="Website, TikTok, Instagram, review…" />
            </Field>
            <Field label="Where" full>
              <PlaceSearch value={form.location} onChange={(p) => set("location", p)} near={near} />
            </Field>
            <Field label="Why it's worth it" full>
              <textarea className="input textarea" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Notes, opening hours, who recommended it…" />
            </Field>
            <Field label="Picture link" hint="Paste an image address to give the card a photo." full>
              <input className="input" value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…jpg" />
            </Field>
            {existing && (
              <Field label="Status" full>
                <Segmented<IdeaStatus>
                  value={form.status}
                  onChange={(v) => set("status", v)}
                  options={[
                    { value: "open", label: "New" },
                    { value: "maybe", label: "Maybe" },
                    { value: "planned", label: "Planned" },
                    { value: "passed", label: "Pass" },
                  ]}
                />
              </Field>
            )}
          </fieldset>
        </form>
        {existing && (
          <div>
            <h3 style={{ marginBottom: "0.8rem" }}>Comments</h3>
            <CommentThread entity="idea" id={existing.id} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ScheduleModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const { trip, insert, update, rows } = useTrip();
  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!idea) return;
    setBusy(true);
    const order = rows.itinerary_items.filter((i) => i.day === (day || null)).length;
    const item = await insert("itinerary_items", {
      title: idea.title,
      notes: idea.description,
      category: idea.category,
      location: idea.location,
      url: idea.url,
      cost: idea.est_cost,
      idea_id: idea.id,
      day: day || null,
      start_time: time || null,
      sort_order: order,
    });
    if (item) await update("ideas", idea.id, { status: "planned" });
    setBusy(false);
    setDay("");
    setTime("");
    onClose();
  }

  return (
    <Modal
      open={!!idea}
      onClose={onClose}
      title={`Schedule "${idea?.title ?? ""}"`}
      size="sm"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>Add to itinerary</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Day">
          <select className="input" value={day} onChange={(e) => setDay(e.target.value)}>
            <option value="">Not sure yet (unscheduled)</option>
            {days.map((d, i) => (
              <option key={d} value={d}>Day {i + 1} · {formatDay(d)}</option>
            ))}
          </select>
        </Field>
        <Field label="Time (optional)">
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {!days.length && <p className="muted small">Tip: set trip dates in Trip settings to schedule by day.</p>}
      </div>
    </Modal>
  );
}
