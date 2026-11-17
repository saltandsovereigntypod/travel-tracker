"use client";

import { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTrip } from "../TripProvider";
import { Avatar } from "../ui/Fields";
import type { CommentEntity } from "@/lib/types";

export function useCommentCount(entity: CommentEntity, id: string) {
  const { rows } = useTrip();
  return rows.comments.filter((c) => c.entity_type === entity && c.entity_id === id).length;
}

export function CommentThread({ entity, id }: { entity: CommentEntity; id: string }) {
  const { rows, me, insert, remove, nameOf, colorOf, isOwner } = useTrip();
  const [text, setText] = useState("");
  const list = rows.comments
    .filter((c) => c.entity_type === entity && c.entity_id === id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    await insert("comments", { entity_type: entity, entity_id: id, body, created_by: me });
  }

  return (
    <div className="stack" style={{ gap: "0.6rem" }}>
      {list.length === 0 && <p className="muted small">No comments yet. Start the conversation.</p>}
      {list.map((c) => (
        <div key={c.id} className="comment">
          <Avatar name={nameOf(c.created_by)} color={colorOf(c.created_by)} size={28} />
          <div className="comment-bubble">
            <div className="row-between">
              <strong className="small">{nameOf(c.created_by)}</strong>
              <span className="tiny muted">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{c.body}</p>
          </div>
          {(c.created_by === me || isOwner) && (
            <button className="icon-btn" aria-label="Delete comment" onClick={() => remove("comments", c.id)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <form onSubmit={send} className="row">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" maxLength={4000} />
        <button className="btn btn-primary" aria-label="Send" disabled={!text.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
