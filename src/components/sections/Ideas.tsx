"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, MessageCircle, Plus, ExternalLink, CalendarPlus, MapPin, Lightbulb, Trash2, Pencil } from "lucide-react";
import clsx from "clsx";
import { LinkedMemories } from "../memories/Memories";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { Modal } from "../ui/Modal";
import { Avatar, EmptyState, Field, PlaceSearch, Segmented } from "../ui/Fields";
import { CostEditor, costColumns, costValueFrom, type CostValue } from "../ui/CostEditor";
import { CardOptions, useCardParts } from "../ui/CardOptions";
import { mapsLink } from "@/lib/services";
import { ideaTotal } from "./money";
import { orderForTime, itemsForDay } from "./itinerary-order";
import { pickCost, unitLabel } from "@/lib/costs";
import { CommentThread, useCommentCount } from "./Comments";
import { CATEGORIES, categoryOf } from "@/lib/categories";
import { formatDay, formatMoney, hostname, normalizeUrl, tripDays } from "@/lib/format";
import type { Idea, IdeaStatus, Place } from "@/lib/types";
import { Check } from "lucide-react";

type Filter = "all" | "tovote" | IdeaStatus;

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

/** Has everyone who's going voted yes? */
export function useEveryoneIn() {
  const { rows, goingIds } = useTrip();
  return (ideaId: string) =>
    goingIds.length > 1 && goingIds.every((u) => rows.idea_votes.some((v) => v.idea_id === ideaId && v.user_id === u && v.value > 0));
}

export function IdeasSection({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const { rows, canEdit, tripId, me, trip, goingIds, householdOf } = useTrip();
  const scores = useIdeaScores();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"top" | "new">("top");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState<{ idea: Idea | "new"; edit: boolean } | null>(null);
  const [scheduling, setScheduling] = useState<Idea | null>(null);
  const setEditing = (i: Idea | "new" | null) => setOpen(i ? { idea: i, edit: true } : null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.ideas.length, open: 0, maybe: 0, planned: 0, passed: 0, tovote: 0 };
    rows.ideas.forEach((i) => {
      c[i.status] = (c[i.status] ?? 0) + 1;
      if ((i.status === "open" || i.status === "maybe") && !rows.idea_votes.some((v) => v.idea_id === i.id && v.user_id === me)) c.tovote++;
    });
    return c;
  }, [rows.ideas, rows.idea_votes, me]);
  const wishlist = rows.ideas
    .filter((i) => i.status === "open" || i.status === "maybe")
    .reduce((n, i) => n + (ideaTotal(i, goingIds, householdOf) ?? 0), 0);

  const list = useMemo(() => {
    // "All" hides passed ideas in the compact block so it stays focused.
    let l = rows.ideas.filter((i) =>
      filter === "all"
        ? !(compact && i.status === "passed")
        : filter === "tovote"
          ? (i.status === "open" || i.status === "maybe") && !rows.idea_votes.some((v) => v.idea_id === i.id && v.user_id === me)
          : i.status === filter,
    );
    if (category) l = l.filter((i) => i.category === category);
    l = [...l].sort((a, b) =>
      sort === "top"
        ? (scores[b.id]?.score ?? 0) - (scores[a.id]?.score ?? 0) || b.created_at.localeCompare(a.created_at)
        : b.created_at.localeCompare(a.created_at),
    );
    return limit ? l.slice(0, limit) : l;
  }, [rows.ideas, rows.idea_votes, me, filter, category, sort, scores, limit, compact]);

  return (
    <div>
      {!compact && (
        <div className="section-head">
          <div>
            <ModuleTitle id="ideas" fallback="Ideas" />
            <p>
              Everything anyone wants to do. Vote, comment, then add the winners to the itinerary.
              {wishlist > 0 && <> Doing every open idea would cost about <strong>{formatMoney(wishlist, trip?.currency)}</strong>.</>}
            </p>
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
              { value: "tovote", label: "To vote", count: counts.tovote },
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
          <CardOptions kind="ideas" title="Idea cards" />
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
            <IdeaCard key={idea.id} idea={idea} compact={compact} onOpen={() => setOpen({ idea, edit: false })} onSchedule={() => setScheduling(idea)} />
          ))}
        </div>
      )}
      {compact && (
        <div className="row" style={{ marginTop: "0.8rem" }}>
          {canEdit && <button className="btn btn-sm" onClick={() => setEditing("new")}><Plus size={14} /> Add idea</button>}
          <Link className="btn btn-sm btn-ghost" href={`/trips/${tripId}/ideas`}>See all {rows.ideas.length} →</Link>
        </div>
      )}
      <IdeaPanel open={open} onClose={() => setOpen(null)} onEdit={(i) => setOpen({ idea: i, edit: true })} onView={(i) => setOpen({ idea: i, edit: false })} onSchedule={(i) => { setOpen(null); setScheduling(i); }} />
      <ScheduleModal idea={scheduling} onClose={() => setScheduling(null)} />
    </div>
  );
}

function IdeaCard({ idea, compact, onOpen, onSchedule }: { idea: Idea; compact?: boolean; onOpen: () => void; onSchedule: () => void }) {
  const show = useCardParts("ideas");
  const onEdit = onOpen;
  const { me, rows, vote, nameOf, colorOf, canEdit, trip, goingIds, householdOf } = useTrip();
  const scores = useIdeaScores();
  const everyoneIn = useEveryoneIn()(idea.id);
  const total = ideaTotal(idea, goingIds, householdOf);
  const s = scores[idea.id] ?? { up: 0, down: 0, score: 0 };
  const mine = rows.idea_votes.find((v) => v.idea_id === idea.id && v.user_id === me)?.value ?? 0;
  const comments = useCommentCount("idea", idea.id);
  const cat = categoryOf(idea.category);
  const voters = rows.idea_votes.filter((v) => v.idea_id === idea.id && v.value > 0).map((v) => v.user_id);

  return (
    <article className={clsx("card idea-card card-hover", `status-${idea.status}`)}>
      {!compact && show("photo") && (
        <button
          className={clsx("idea-img", !idea.image_url && "noimg")}
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
            <h3>
              {compact || !show("photo") ? <span style={{ marginRight: 6 }}>{cat.emoji}</span> : !idea.image_url && <span className="show-phone" style={{ marginRight: 6 }}>{cat.emoji}</span>}
              {idea.title}
            </h3>
          </button>
          {idea.status === "planned" && <span className="chip chip-ok">Planned</span>}
          {idea.status === "maybe" && <span className="chip chip-2">Maybe</span>}
          {idea.status !== "planned" && everyoneIn && <span className="chip badge-in"><Check size={12} /> Everyone&apos;s in</span>}
        </div>
        {!compact && show("about") && idea.description && <p className="muted small" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea.description}</p>}
        <div className="chip-row">
          {!compact && show("category") && <span className="chip">{cat.emoji} {cat.label}</span>}
          {show("price") && idea.est_cost != null && (
            <span className="chip chip-muted" title={`${formatMoney(idea.est_cost, trip?.currency)} ${unitLabel(pickCost(idea))}`}>
              {formatMoney(idea.est_cost, trip?.currency)} {idea.cost_unit !== "group" && unitLabel(pickCost(idea))}
              {total != null && idea.cost_unit !== "group" && <> · ≈{formatMoney(total, trip?.currency, true)}</>}
            </span>
          )}
          {show("place") && idea.location?.name && !compact && <span className="chip chip-muted"><MapPin size={12} /> {idea.location.name}</span>}
          {show("link") && idea.url && (
            <a className="chip chip-2" href={idea.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} /> {hostname(idea.url)}
            </a>
          )}
        </div>
        {show("voters") && voters.length > 0 && (
          <span className="voters">
            <span className="avatar-stack">{voters.map((u) => <Avatar key={u} name={nameOf(u)} color={colorOf(u)} size={18} />)}</span>
            {voters.map((u) => nameOf(u).split(" ")[0]).join(", ")} 👍
          </span>
        )}
        {!compact && show("addedBy") && (
          <span className="row tiny muted" style={{ marginTop: "auto" }}>
            <Avatar name={nameOf(idea.created_by)} color={colorOf(idea.created_by)} size={18} /> Added by {nameOf(idea.created_by)}
          </span>
        )}
      </div>
      {(show("votes") || show("comments") || show("schedule")) && <div className="idea-foot">
        {show("votes") && <><button className={clsx("vote-btn vote-big", mine === 1 && "on")} onClick={() => vote(idea.id, mine === 1 ? 0 : 1)} aria-label="Vote up" title={voters.map(nameOf).join(", ") || "Vote up"}>
          <ThumbsUp size={14} /> {s.up}
        </button>
        <button className={clsx("vote-btn vote-big down", mine === -1 && "on")} onClick={() => vote(idea.id, mine === -1 ? 0 : -1)} aria-label="Vote down">
          <ThumbsDown size={14} /> {s.down || ""}
        </button></>}
        {show("comments") && <button className="vote-btn" onClick={onEdit} aria-label="Comments">
          <MessageCircle size={14} /> {comments || ""}
        </button>}
        <div className="grow" />
        {show("schedule") && canEdit && idea.status !== "planned" && (
          <button className="btn btn-sm btn-ghost" onClick={onSchedule} title="Add to itinerary">
            <CalendarPlus size={15} /> {!compact && "Schedule"}
          </button>
        )}
      </div>}
    </article>
  );
}

const blankIdea = {
  title: "", description: "", url: "", image_url: "", category: "activity",
  cost: costValueFrom(null, null, "person") as CostValue, location: {} as Place, status: "open" as IdeaStatus,
};

function IdeaPanel({
  open,
  onClose,
  onEdit,
  onView,
  onSchedule,
}: {
  open: { idea: Idea | "new"; edit: boolean } | null;
  onClose: () => void;
  onEdit: (i: Idea) => void;
  onView: (i: Idea) => void;
  onSchedule: (i: Idea) => void;
}) {
  const { canEdit, rows, remove } = useTrip();
  const live = open && open.idea !== "new" ? rows.ideas.find((x) => x.id === (open.idea as Idea).id) ?? null : null;
  const isNew = open?.idea === "new";
  const editing = !!open && (open.edit || isNew) && canEdit;
  return (
    <Modal
      open={!!open && (isNew || !!live)}
      onClose={onClose}
      variant="panel"
      title={isNew ? "New idea" : live?.title ?? ""}
      actions={!editing && live && canEdit ? <button className="btn btn-sm" onClick={() => onEdit(live)}><Pencil size={14} /> Edit</button> : undefined}
      footer={
        editing ? (
          <>
            {live && (
              <button
                className="btn btn-danger"
                type="button"
                onClick={async () => {
                  if (confirm(`Delete "${live.title}"?`)) {
                    await remove("ideas", live.id);
                    onClose();
                  }
                }}
              >
                <Trash2 size={15} /> Delete
              </button>
            )}
            <span className="spacer" />
            <button className="btn" type="button" onClick={live ? () => onView(live) : onClose}>Cancel</button>
            <button className="btn btn-primary" form="idea-form">{isNew ? "Add idea" : "Save"}</button>
          </>
        ) : undefined
      }
    >
      {editing ? <IdeaForm key={live?.id ?? "new"} existing={live} onDone={live ? () => onView(live) : onClose} /> : live ? <IdeaDetails idea={live} onSchedule={() => onSchedule(live)} /> : null}
    </Modal>
  );
}

function IdeaDetails({ idea, onSchedule }: { idea: Idea; onSchedule: () => void }) {
  const { rows, me, vote, nameOf, colorOf, canEdit, trip, goingIds, householdOf } = useTrip();
  const scores = useIdeaScores();
  const s = scores[idea.id] ?? { up: 0, down: 0, score: 0 };
  const mine = rows.idea_votes.find((v) => v.idea_id === idea.id && v.user_id === me)?.value ?? 0;
  const cat = categoryOf(idea.category);
  const total = ideaTotal(idea, goingIds, householdOf);
  const up = rows.idea_votes.filter((v) => v.idea_id === idea.id && v.value > 0).map((v) => v.user_id);
  const down = rows.idea_votes.filter((v) => v.idea_id === idea.id && v.value < 0).map((v) => v.user_id);
  const where = mapsLink(idea.location);
  const status = { open: "New", maybe: "Maybe", planned: "Planned", passed: "Passed" }[idea.status];
  return (
    <div className="detail">
      {idea.image_url && <div className="detail-photo" style={{ backgroundImage: `url("${idea.image_url.replace(/"/g, "")}")` }} />}
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="chip">{cat.emoji} {cat.label}</span>
        <span className={idea.status === "planned" ? "chip chip-ok" : "chip chip-muted"}>{status}</span>
      </div>
      {idea.description && <p className="detail-notes">{idea.description}</p>}
      <div className="detail-grid">
        <div>
          <small>Rough cost</small>
          {idea.est_cost != null ? (
            <>
              {formatMoney(idea.est_cost, trip?.currency)} {idea.cost_unit !== "group" && unitLabel(pickCost(idea))}
              {total != null && idea.cost_unit !== "group" && <span className="tiny muted" style={{ display: "block" }}>≈ {formatMoney(total, trip?.currency)} for everyone going</span>}
            </>
          ) : "—"}
        </div>
        <div><small>Added by</small><span className="row" style={{ gap: 5 }}><Avatar name={nameOf(idea.created_by)} color={colorOf(idea.created_by)} size={18} /> {nameOf(idea.created_by)}</span></div>
      </div>
      {(idea.location?.name || idea.url) && (
        <div className="row wrap" style={{ gap: 6 }}>
          {idea.location?.name && (where ? <a className="chip chip-2" href={where} target="_blank" rel="noopener noreferrer"><MapPin size={12} /> {idea.location.name}</a> : <span className="chip chip-muted"><MapPin size={12} /> {idea.location.name}</span>)}
          {idea.url && <a className="chip chip-2" href={idea.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> {hostname(idea.url)}</a>}
        </div>
      )}
      <div className="detail-section">
        <h3>Votes</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className={clsx("vote-btn vote-big", mine === 1 && "on")} onClick={() => vote(idea.id, mine === 1 ? 0 : 1)} aria-label="Vote up"><ThumbsUp size={14} /> {s.up}</button>
          <button className={clsx("vote-btn vote-big down", mine === -1 && "on")} onClick={() => vote(idea.id, mine === -1 ? 0 : -1)} aria-label="Vote down"><ThumbsDown size={14} /> {s.down || ""}</button>
          <span className="small muted">
            {up.length ? <>{up.map((u) => nameOf(u).split(" ")[0]).join(", ")} 👍</> : "No votes yet"}
            {down.length > 0 && <> · {down.map((u) => nameOf(u).split(" ")[0]).join(", ")} 👎</>}
          </span>
        </div>
      </div>
      {canEdit && idea.status !== "planned" && (
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={onSchedule}><CalendarPlus size={15} /> Add to itinerary</button>
      )}
      <LinkedMemories type="idea" id={idea.id} />
      <div className="detail-section">
        <h3>Comments</h3>
        <CommentThread entity="idea" id={idea.id} />
      </div>
    </div>
  );
}

function IdeaForm({ existing, onDone }: { existing: Idea | null; onDone: () => void }) {
  const { insert, update, canEdit, trip, me, goingIds, householdOf } = useTrip();
  const [form, setForm] = useState(() =>
    existing
      ? {
          title: existing.title,
          description: existing.description,
          url: existing.url ?? "",
          image_url: existing.image_url ?? "",
          category: existing.category,
          cost: costValueFrom(existing.est_cost, existing),
          location: existing.location ?? {},
          status: existing.status,
        }
      : blankIdea,
  );
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
      ...costColumns(form.cost, "est_cost"),
      location: form.location,
      status: form.status,
    };
    if (!row.title) return;
    const ok = existing ? await update("ideas", existing.id, row) : !!(await insert("ideas", { ...row, created_by: me }));
    if (ok) onDone();
  }

  return (
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
            <CostEditor
              value={form.cost}
              onChange={(v) => set("cost", v)}
              participants={goingIds}
              currency={trip?.currency ?? "USD"}
              householdOf={householdOf}
              label="Rough cost (estimate uses everyone going)"
            />
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
  );
}

/** Turn an idea into an itinerary plan (shared by the Schedule button and drag-to-day). */
export function useScheduleIdea() {
  const { insert, update, rows } = useTrip();
  return async (idea: Idea, day: string | null, time: string | null, participants: string[] = []) => {
    const start = time ? (time.length === 5 ? `${time}:00` : time) : null;
    const item = await insert("itinerary_items", {
      title: idea.title,
      notes: idea.description,
      category: idea.category,
      location: idea.location,
      url: idea.url,
      cost: idea.est_cost,
      ...pickCost(idea),
      participants,
      idea_id: idea.id,
      day,
      start_time: start,
      sort_order: orderForTime(itemsForDay(rows.itinerary_items, day), start),
    });
    if (item) await update("ideas", idea.id, { status: "planned" });
    return item;
  };
}

export function ScheduleModal({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const { trip, rows } = useTrip();
  const schedule = useScheduleIdea();
  const days = tripDays(trip?.start_date ?? null, trip?.end_date ?? null);
  const [day, setDay] = useState<string>("");
  const [time, setTime] = useState("");
  const [who, setWho] = useState<"everyone" | "voters">("everyone");
  const [busy, setBusy] = useState(false);
  const voters = idea ? rows.idea_votes.filter((v) => v.idea_id === idea.id && v.value > 0).map((v) => v.user_id) : [];

  async function save() {
    if (!idea) return;
    setBusy(true);
    await schedule(idea, day || null, time || null, who === "voters" ? voters : []);
    setBusy(false);
    setDay("");
    setTime("");
    setWho("everyone");
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
        <div className="field">
          <span className="field-label">Which day?</span>
          <div className="day-chips">
            {days.map((d, i) => (
              <button key={d} type="button" className={clsx(day === d && "on")} onClick={() => setDay(d)}>
                {formatDay(d, { weekday: "short", month: undefined, day: undefined })} {formatDay(d, { weekday: undefined, month: undefined })}
                <small>Day {i + 1}</small>
              </button>
            ))}
            <button type="button" className={clsx(day === "" && "on")} onClick={() => setDay("")}>
              Later<small>unscheduled</small>
            </button>
          </div>
        </div>
        <Field label="Time (optional)">
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Who's doing it">
          <Segmented<"everyone" | "voters">
            size="sm"
            value={who}
            onChange={setWho}
            options={[{ value: "everyone", label: "Everyone going" }, { value: "voters", label: `Who voted 👍 (${voters.length})` }]}
          />
        </Field>
        {!days.length && <p className="muted small">Tip: set trip dates in Trip settings to schedule by day.</p>}
      </div>
    </Modal>
  );
}
