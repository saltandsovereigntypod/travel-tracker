"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrip } from "../TripProvider";
import { useToast } from "../ui/Toast";
import { friendlyError, supabase } from "@/lib/supabase";
import { applyOps, descendants, newBlock, pushOp, type BlockOp, type DocBlock, type Page } from "@/lib/pages";

const SAVE_DELAY = 600;

/**
 * Editing state for one page. Local edits are queued as small operations and laid
 * over the latest saved copy, so someone else's changes to other blocks show up
 * live while you type, and saving re-reads the page first so nobody's blocks get lost.
 */
export function usePageDoc(page: Page | undefined) {
  const { update } = useTrip();
  const toast = useToast();
  const [ops, setOps] = useState<BlockOp[]>([]);
  const opsRef = useRef<BlockOp[]>([]);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageId = page?.id;

  const base = useMemo(() => (Array.isArray(page?.blocks) ? page!.blocks : []), [page]);
  const blocks = useMemo(() => applyOps(base, ops), [base, ops]);

  const save = useCallback(async () => {
    if (!pageId || saving.current || !opsRef.current.length) return;
    saving.current = true;
    const sending = opsRef.current;
    try {
      const { data, error } = await supabase().from("pages").select("blocks").eq("id", pageId).maybeSingle();
      if (error) throw error;
      if (!data) return; // deleted meanwhile
      const merged = applyOps((data.blocks as DocBlock[]) ?? [], sending);
      // update() applies locally right away, so drop the ops it now contains in the same tick.
      const done = update("pages", pageId, { blocks: merged });
      opsRef.current = opsRef.current.slice(sending.length);
      setOps(opsRef.current);
      if (!(await done)) {
        opsRef.current = [...sending, ...opsRef.current];
        setOps(opsRef.current);
      }
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      saving.current = false;
      if (opsRef.current.length) timer.current = setTimeout(() => void saveRef.current(), SAVE_DELAY);
    }
  }, [pageId, update, toast]);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const queue = useCallback(
    (op: BlockOp) => {
      opsRef.current = pushOp(opsRef.current, op);
      setOps(opsRef.current);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), SAVE_DELAY);
    },
    [save],
  );

  // Save straight away when leaving the page or hiding the app.
  useEffect(() => {
    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      void save();
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [save]);

  const api = useMemo(
    () => ({
      set: (block: DocBlock) => queue({ kind: "set", block }),
      insertAfter: (after: string | null, block: DocBlock) => queue({ kind: "set", block, after }),
      remove: (id: string) => queue({ kind: "del", id }),
      move: (id: string, after: string | null) => queue({ kind: "move", id, after }),
    }),
    [queue],
  );

  return { blocks, pending: ops.length > 0, ...api };
}

/** Create a page (optionally inside another one) and open it. */
export function useCreatePage() {
  const { rows, insert, tripId, update } = useTrip();
  const router = useRouter();
  return useCallback(
    async (parentId: string | null = null, init: Partial<Page> = {}, { open = true, linkInParent = true }: { open?: boolean; linkInParent?: boolean } = {}) => {
      const siblings = rows.pages.filter((p) => (p.parent_id ?? null) === parentId);
      const page = await insert("pages", {
        parent_id: parentId,
        title: "",
        icon: "📄",
        blocks: [newBlock("text")],
        sort_order: Math.max(0, ...siblings.map((p) => p.sort_order)) + 1,
        ...init,
      });
      if (!page) return null;
      // Show the new subpage inside its parent, like Notion.
      const parent = parentId ? rows.pages.find((p) => p.id === parentId) : undefined;
      if (parent && linkInParent) {
        const { data } = await supabase().from("pages").select("blocks").eq("id", parent.id).maybeSingle();
        const blocks = ((data?.blocks as DocBlock[]) ?? parent.blocks ?? []).filter((b) => b.pageId !== page.id);
        await update("pages", parent.id, { blocks: [...blocks, newBlock("page", { pageId: page.id })] });
      }
      if (open) router.push(`/trips/${tripId}/pages/${page.id}`);
      return page;
    },
    [rows.pages, insert, tripId, router, update],
  );
}

/** Delete a page and everything inside it. */
export function useDeletePage() {
  const { rows, remove } = useTrip();
  return useCallback(
    (id: string) => ({ subpages: descendants(rows.pages, id).length, run: () => remove("pages", id) }),
    [rows.pages, remove],
  );
}
