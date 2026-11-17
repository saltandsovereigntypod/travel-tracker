"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pin, Lock, Trash2, NotebookPen, BookOpen, Users } from "lucide-react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useTrip } from "../TripProvider";
import { ModuleTitle } from "../ModuleTitle";
import { AutoTextarea, Avatar, EmptyState, Segmented } from "../ui/Fields";
import { formatDayLong, todayString } from "@/lib/format";
import type { Note } from "@/lib/types";

type Tab = "shared" | "private" | "journal";

export function NotesSection({ compact = false }: { compact?: boolean }) {
  const { rows, me, canEdit, insert, tripId } = useTrip();
  const [tab, setTab] = useState<Tab>("shared");
  const [openId, setOpenId] = useState<string | null>(null);

  const lists = useMemo(() => {
    const sort = (l: Note[]) => [...l].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
    return {
      shared: sort(rows.notes.filter((n) => n.kind === "note" && !n.is_private)),
      private: sort(rows.notes.filter((n) => n.kind === "note" && n.is_private && n.created_by === me)),
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
      is_private: tab === "private" || (isJournal && !canEdit),
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
          <p>Shared notes for the group, private notes for you, and a journal for the memories.</p>
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
                {tab === "journal" ? "Write a little each day. It becomes your scrapbook later." : "Door codes, ideas, reminders…"}
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
        {note.is_private && <Lock size={11} />}
      </span>
    </button>
  );
}

function NoteEditor({ note, onDeleted }: { note: Note; onDeleted: () => void }) {
  const { update, remove, canEdit, me, nameOf } = useTrip();
  const editable = note.is_private ? note.created_by === me : canEdit;
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
        placeholder={note.kind === "journal" ? "What happened today? What did it smell like, taste like, feel like?" : "Start typing. It saves automatically."}
      />
      <span className="tiny muted">
        {note.is_private ? "🔒 Only you can see this." : `Shared with everyone on the trip · by ${nameOf(note.created_by)}`} · Saves automatically
      </span>
    </div>
  );
}
