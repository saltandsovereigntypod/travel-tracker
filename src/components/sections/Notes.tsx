"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pin, Lock, Trash2, NotebookPen, BookOpen, Users } from "lucide-react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { AutoTextarea, Avatar, EmptyState, Segmented } from "../ui/Fields";
import { formatDayLong, todayString } from "@/lib/format";
import { AttachPicker, AttachedChip, VisibilityControl } from "../memories/Memories";
import { visibilityLabel } from "@/lib/memories";
import { Field } from "../ui/Fields";
import type { Note } from "@/lib/types";

type Tab = "shared" | "private" | "journal";

export function NotesSection({ compact = false }: { compact?: boolean }) {
  const { rows, me, canEdit, insert, tripId, voice } = useTrip();
  const [tab, setTab] = useState<Tab>("shared");
  const [openId, setOpenId] = useState<string | null>(null);
  // Opened from a plan or stay ("Photos & notes").
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("note");
    if (!id) return;
    queueMicrotask(() => {
      const n = rows.notes.find((x) => x.id === id);
      if (n) {
        setTab(n.kind === "journal" ? "journal" : n.visibility === "private" ? "private" : "shared");
        setOpenId(id);
      }
    });
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.notes.length > 0]);

  const lists = useMemo(() => {
    const sort = (l: Note[]) => [...l].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
    return {
      // Shared: with everyone, or with a chosen few that includes you.
      shared: sort(rows.notes.filter((n) => n.kind === "note" && (n.visibility ?? (n.is_private ? "private" : "everyone")) !== "private")),
      private: sort(rows.notes.filter((n) => n.kind === "note" && (n.visibility ?? (n.is_private ? "private" : "everyone")) === "private" && n.created_by === me)),
      journal: [...rows.notes.filter((n) => n.kind === "journal")].sort((a, b) => (b.entry_date ?? "").localeCompare(a.entry_date ?? "") || b.created_at.localeCompare(a.created_at)),
    };
  }, [rows.notes, me]);
  const list = lists[tab];
  const open = list.find((n) => n.id === openId) ?? null;
  const canCreate = tab === "shared" ? canEdit : true;

  async function create() {
    const isJournal = tab === "journal";
    const n = await insert("notes", {
      title: isJournal ? "" : "Untitled note",
      kind: isJournal ? "journal" : "note",
      visibility: tab === "private" || (isJournal && !canEdit) ? "private" : "everyone",
      entry_date: isJournal ? todayString() : null,
      created_by: me,
    });
    if (n) setOpenId(n.id);
  }

  if (compact) {
    const recent = [...lists.shared, ...lists.journal].slice(0, 4);
    return (
      <div className="stack" style={{ gap: "0.5rem" }}>
        {recent.length === 0 && <p className="muted small">No notes yet.</p>}
        {recent.map((n) => (
          <Link key={n.id} href={`/trips/${tripId}/notes`} className="check-row" style={{ textDecoration: "none", alignItems: "flex-start" }}>
            {n.kind === "journal" ? <BookOpen size={16} /> : <NotebookPen size={16} />}
            <div className="grow">
              <strong className="small">{n.title || (n.kind === "journal" ? formatDayLong(n.entry_date) : "Untitled")}</strong>
              <p className="tiny muted truncate">{n.body || "Empty"}</p>
            </div>
          </Link>
        ))}
        <Link className="btn btn-sm btn-ghost" href={`/trips/${tripId}/notes`}>All notes →</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <ModuleTitle id="notes" fallback="Notes & journal" />
          <p>{voice.notes.hint}</p>
        </div>
        {canCreate && <button className="btn btn-primary" onClick={create}><Plus size={16} /> {tab === "journal" ? "New entry" : "New note"}</button>}
      </div>
      <Segmented<Tab>
        value={tab}
        onChange={(t) => { setTab(t); setOpenId(null); }}
        options={[
          { value: "shared", label: <><Users size={14} /> Shared</>, count: lists.shared.length },
          { value: "private", label: <><Lock size={14} /> Private</>, count: lists.private.length },
          { value: "journal", label: <><BookOpen size={14} /> Journal</>, count: lists.journal.length },
        ]}
      />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 300px) minmax(0, 1fr)", gap: "1rem", marginTop: "1rem" }} className="notes-grid">
        <div className="stack" style={{ gap: "0.4rem" }}>
          {list.length === 0 && (
            <div className="card">
              <EmptyState icon={tab === "journal" ? <BookOpen /> : <NotebookPen />} title={tab === "journal" ? "No entries yet" : "No notes yet"}>
                {tab === "journal" ? voice.notes.journalEmpty : "Ideas, reminders, anything worth keeping…"}
              </EmptyState>
            </div>
          )}
          {list.map((n) => <NoteListItem key={n.id} note={n} active={n.id === open?.id} onClick={() => setOpenId(n.id)} />)}
        </div>
        <div>{open ? <NoteEditor key={open.id} note={open} onDeleted={() => setOpenId(null)} /> : list.length > 0 && <div className="card muted">Pick a note to read or edit.</div>}</div>
      </div>
    </div>
  );
}

function NoteListItem({ note, active, onClick }: { note: Note; active: boolean; onClick: () => void }) {
  const { nameOf, colorOf } = useTrip();
  return (
    <button className={clsx("card card-tight", active && "avatar-ring")} style={{ textAlign: "left", cursor: "pointer", color: "inherit", outline: active ? "2px solid var(--accent)" : undefined }} onClick={onClick}>
      <div className="row-between">
        <strong className="truncate small">{note.title || (note.kind === "journal" ? formatDayLong(note.entry_date) : "Untitled")}</strong>
        {note.pinned && <Pin size={13} />}
      </div>
      <p className="tiny muted truncate">{note.body || "Empty"}</p>
      <span className="row tiny muted" style={{ marginTop: 4 }}>
        <Avatar name={nameOf(note.created_by)} color={colorOf(note.created_by)} size={16} />
        {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
        {note.visibility === "private" ? <Lock size={11} /> : note.visibility === "people" ? <Users size={11} /> : null}
      </span>
    </button>
  );
}

function NoteEditor({ note, onDeleted }: { note: Note; onDeleted: () => void }) {
  const { update, remove, canEdit, me, nameOf, voice } = useTrip();
  const editable = note.created_by === me || (canEdit && note.visibility !== "private");
  const [title, setTitle] = useState(note.title);
  return (
    <div className="card stack">
      <div className="row">
        {note.kind === "journal" ? (
          <input className="input" type="date" style={{ width: "auto" }} value={note.entry_date ?? ""} disabled={!editable} onChange={(e) => update("notes", note.id, { entry_date: e.target.value || null })} />
        ) : null}
        <input
          className="input heading"
          style={{ fontSize: "1.3rem", fontWeight: 700, border: 0, background: "transparent", paddingLeft: 0 }}
          value={title}
          disabled={!editable}
          placeholder={note.kind === "journal" ? "Give today a title (optional)" : "Title"}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== note.title && update("notes", note.id, { title })}
        />
        {editable && (
          <>
            <button className={clsx("icon-btn", note.pinned && "on")} aria-label="Pin" title="Pin to top" onClick={() => update("notes", note.id, { pinned: !note.pinned })}><Pin size={16} /></button>
            <button className="icon-btn" aria-label="Delete" onClick={async () => { if (confirm("Delete this note?")) { await remove("notes", note.id); onDeleted(); } }}><Trash2 size={16} /></button>
          </>
        )}
      </div>
      <AutoTextarea
        value={note.body}
        onSave={(body) => update("notes", note.id, { body })}
        rows={16}
        disabled={!editable}
        className="journal-body"
        placeholder={note.kind === "journal" ? voice.notes.journalPrompt : "Start typing. It saves automatically."}
      />
      <div className="note-meta">
        <Field label="Who can see it">
          <VisibilityControl
            value={note.visibility ?? (note.is_private ? "private" : "everyone")}
            people={note.visible_to ?? []}
            owner={note.created_by}
            onChange={(v) => update("notes", note.id, v)}
          />
        </Field>
        <Field label="Attached to" hint={voice.attachHint}>
          {editable ? (
            <AttachPicker type={note.linked_type} id={note.linked_id} onChange={(t, id) => update("notes", note.id, { linked_type: t, linked_id: id })} />
          ) : (
            <AttachedChip type={note.linked_type} id={note.linked_id} />
          )}
        </Field>
      </div>
      <span className="tiny muted">
        {visibilityLabel({ visibility: note.visibility ?? (note.is_private ? "private" : "everyone"), visible_to: note.visible_to, created_by: note.created_by }, (id) => nameOf(id), me)} · by {nameOf(note.created_by)} · Saves automatically
      </span>
    </div>
  );
}
