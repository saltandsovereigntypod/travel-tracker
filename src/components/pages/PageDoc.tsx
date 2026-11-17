"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FilePlus2, ImagePlus, Link2, Loader2, MoreHorizontal, Smile, Trash2 } from "lucide-react";
import { useTrip } from "../TripProvider";
import { useToast } from "../ui/Toast";
import { EmptyState } from "../ui/Fields";
import { Modal } from "../ui/Modal";
import { CommentThread } from "../sections/Comments";
import { shrinkImage } from "../sections/Photos";
import { DocEditor } from "./DocEditor";
import { useCreatePage, useDeletePage, usePageDoc } from "./usePageDoc";
import { breadcrumbs, childPages } from "@/lib/pages";
import { timeAgo } from "@/lib/format";
import { friendlyError, supabase } from "@/lib/supabase";

export const COVERS = [
  "linear-gradient(135deg, #3D5A80, #E07A5F)",
  "linear-gradient(135deg, #B5838D, #FFCDB2)",
  "linear-gradient(135deg, #2A1F31, #8E6BBF)",
  "linear-gradient(135deg, #5B8C51, #F1F4EC)",
  "linear-gradient(135deg, #F15BB5, #FEE440)",
  "linear-gradient(135deg, #1B1B1E, #FF7518)",
  "linear-gradient(135deg, #0F4C5C, #9AD1D4)",
  "linear-gradient(135deg, #FFD6A5, #FDFFB6)",
];

const ICONS = ["📄", "📝", "🗒️", "📌", "⭐", "💡", "✅", "📅", "🗺️", "✈️", "🏨", "🎃", "👻", "🕯️", "💍", "💐", "🎙️", "🎧", "🏡", "🧹", "💸", "🎉", "📔", "🍽️", "🧳", "📸", "❤️", "🌿", "⚖️", "⏱️"];

export function PageDoc({ pageId }: { pageId: string }) {
  const { rows, loading, canEdit, update, nameOf, tripId, photoUrl, ensurePhotoUrls } = useTrip();
  const router = useRouter();
  const toast = useToast();
  const page = rows.pages.find((p) => p.id === pageId);
  const doc = usePageDoc(page);
  const createPage = useCreatePage();
  const deletePage = useDeletePage();
  const [menu, setMenu] = useState(false);
  const [iconPick, setIconPick] = useState(false);
  const [coverPick, setCoverPick] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [title, setTitle] = useState(page?.title ?? "");
  const [titleDirty, setTitleDirty] = useState(false);
  const [lastTitle, setLastTitle] = useState(page?.title ?? "");
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  // Take a collaborator's title change unless you're mid-edit.
  if (page && page.title !== lastTitle) {
    setLastTitle(page.title);
    if (!titleDirty) setTitle(page.title);
  }
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const coverPath = page?.cover.startsWith("storage:") ? page.cover.slice(8) : null;
  useEffect(() => {
    if (coverPath) void ensurePhotoUrls([coverPath]);
  }, [coverPath, ensurePhotoUrls]);

  if (!page) {
    return loading ? null : <EmptyState title="This page doesn't exist anymore">It may have been deleted.</EmptyState>;
  }

  const crumbs = breadcrumbs(rows.pages, page.id).slice(0, -1);
  const linked = new Set(doc.blocks.filter((b) => b.type === "page").map((b) => b.pageId));
  const loose = childPages(rows.pages, page.id).filter((p) => !linked.has(p.id));
  const coverStyle = page.cover
    ? page.cover.startsWith("linear-gradient")
      ? { background: page.cover }
      : { backgroundImage: `url("${coverPath ? photoUrl(coverPath) ?? "" : page.cover}")` }
    : undefined;

  function changeTitle(v: string) {
    setTitle(v);
    setTitleDirty(true);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      await update("pages", page!.id, { title: v.slice(0, 200) });
      setTitleDirty(false);
    }, 500);
  }

  async function uploadCover(f: File) {
    setUploading(true);
    try {
      const { blob, ext } = await shrinkImage(f, 2400);
      const p = `${tripId}/pages/${crypto.randomUUID()}.${ext}`;
      const up = await supabase().storage.from("trip-media").upload(p, blob, { contentType: blob.type || f.type });
      if (up.error) throw up.error;
      await update("pages", page!.id, { cover: `storage:${p}` });
      setCoverPick(false);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setUploading(false);
    }
  }

  const del = deletePage(page.id);

  return (
    <article className="doc">
      {coverStyle && (
        <div className="doc-cover" style={coverStyle}>
          {canEdit && <button className="btn btn-sm doc-cover-btn" onClick={() => setCoverPick(true)}>Change cover</button>}
        </div>
      )}
      <div className="doc-head">
        {crumbs.length > 0 && (
          <nav className="doc-crumbs" aria-label="Page path">
            {crumbs.map((c) => (
              <span key={c.id} className="row" style={{ gap: 2 }}>
                <Link href={`/trips/${tripId}/pages/${c.id}`}>{c.icon} {c.title || "Untitled"}</Link>
                <ChevronRight size={13} />
              </span>
            ))}
          </nav>
        )}
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <button className="doc-icon" onClick={() => canEdit && setIconPick(true)} disabled={!canEdit} aria-label="Change page icon" type="button">{page.icon}</button>
          <div className="row" style={{ gap: 4 }}>
            {doc.pending && <span className="tiny muted row" style={{ gap: 4 }}><Loader2 size={12} className="spin" /> Saving</span>}
            {canEdit && !coverStyle && (
              <button className="btn btn-ghost btn-sm hide-phone" onClick={() => setCoverPick(true)}><ImagePlus size={15} /> Cover</button>
            )}
            <div style={{ position: "relative" }}>
              <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Page options" aria-expanded={menu}><MoreHorizontal size={18} /></button>
              {menu && (
                <div className="block-menu page-menu" role="menu" onMouseLeave={() => setMenu(false)}>
                  {canEdit && <button className="block-menu-item" onClick={() => { setMenu(false); void createPage(page.id); }}><FilePlus2 size={15} /> Add a page inside</button>}
                  {canEdit && <button className="block-menu-item" onClick={() => { setMenu(false); setIconPick(true); }}><Smile size={15} /> Change icon</button>}
                  {canEdit && <button className="block-menu-item" onClick={() => { setMenu(false); setCoverPick(true); }}><ImagePlus size={15} /> {coverStyle ? "Change cover" : "Add cover"}</button>}
                  <button className="block-menu-item" onClick={() => { setMenu(false); void navigator.clipboard?.writeText(location.href).then(() => toast.success("Link copied. Anyone in this space can open it.")); }}><Link2 size={15} /> Copy link</button>
                  {canEdit && <button className="block-menu-item danger" onClick={() => { setMenu(false); setConfirmDel(true); }}><Trash2 size={15} /> Delete page</button>}
                </div>
              )}
            </div>
          </div>
        </div>
        {canEdit ? (
          <textarea
            ref={titleRef}
            className="doc-title"
            value={title}
            rows={1}
            onChange={(e) => changeTitle(e.target.value.replace(/\n/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (document.querySelector(".doc-body .doc-input") as HTMLTextAreaElement | null)?.focus();
              }
            }}
            placeholder="Untitled"
            aria-label="Page title"
            maxLength={200}
          />
        ) : (
          <h1 className="doc-title">{page.title || "Untitled"}</h1>
        )}
        <p className="tiny muted doc-meta">
          Edited {timeAgo(page.updated_at)}{page.updated_by && <> by {nameOf(page.updated_by)}</>}
        </p>
      </div>

      <DocEditor page={page} blocks={doc.blocks} api={doc} canEdit={canEdit} />

      {loose.length > 0 && (
        <div className="doc-loose">
          <div className="nav-label">Pages inside</div>
          {loose.map((p) => (
            <Link key={p.id} href={`/trips/${tripId}/pages/${p.id}`} className="doc-pagelink"><span aria-hidden>{p.icon}</span> <span className="truncate">{p.title || "Untitled"}</span></Link>
          ))}
        </div>
      )}

      <section className="doc-comments">
        <CommentThread entity="page" id={page.id} />
      </section>

      <Modal open={iconPick} onClose={() => setIconPick(false)} title="Page icon" size="sm">
        <div className="emoji-grid">
          {ICONS.map((e) => (
            <button key={e} className="emoji-btn" onClick={() => { void update("pages", page.id, { icon: e }); setIconPick(false); }} aria-label={`Use ${e}`}>{e}</button>
          ))}
        </div>
        <label className="row small" style={{ gap: 8, marginTop: "0.8rem" }}>
          Or type any emoji:
          <input className="input" style={{ width: 70, textAlign: "center", fontSize: "1.2rem" }} maxLength={4} onChange={(e) => e.target.value.trim() && void update("pages", page.id, { icon: e.target.value.trim() })} aria-label="Custom icon" />
        </label>
      </Modal>

      <Modal open={coverPick} onClose={() => setCoverPick(false)} title="Cover" size="sm">
        <div className="cover-grid">
          {COVERS.map((c) => (
            <button key={c} className="cover-swatch" style={{ background: c }} onClick={() => { void update("pages", page.id, { cover: c }); setCoverPick(false); }} aria-label="Use this gradient" />
          ))}
        </div>
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); e.target.value = ""; }} />
        <div className="row wrap" style={{ gap: 8, marginTop: "0.9rem" }}>
          <button className="btn" onClick={() => coverInput.current?.click()} disabled={uploading}>{uploading ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />} Upload a picture</button>
          {page.cover && <button className="btn btn-ghost" onClick={() => { void update("pages", page.id, { cover: "" }); setCoverPick(false); }}>Remove cover</button>}
        </div>
      </Modal>

      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        title="Delete this page?"
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDel(false)}>Keep it</button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                const parent = page.parent_id;
                if (await del.run()) router.push(parent ? `/trips/${tripId}/pages/${parent}` : `/trips/${tripId}/pages`);
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p>
          “{page.title || "Untitled"}” will be deleted for everyone
          {del.subpages > 0 && <>, along with the {del.subpages} page{del.subpages === 1 ? "" : "s"} inside it</>}. Lists and items it shows are not affected.
        </p>
      </Modal>
    </article>
  );
}
