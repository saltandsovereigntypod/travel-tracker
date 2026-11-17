"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTrip } from "../TripProvider";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { friendlyError, supabase } from "@/lib/supabase";
import { LIST_TEMPLATES, buildLists } from "@/lib/list-templates";

/** Pick a ready-made list (Guests, Vendors, Episodes, Bills…) or start blank. */
export function NewListModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tripId, rows, reload } = useTrip();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function create(key: string) {
    setBusy(key);
    const maxOrder = Math.max(0, ...rows.lists.map((l) => l.sort_order));
    const [row] = buildLists([key], tripId, rows.lists, maxOrder + 1);
    const { error } = await supabase().from("lists").insert(row);
    setBusy(null);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    await reload();
    onClose();
    router.push(`/trips/${tripId}/lists/${row.id}`);
  }

  return (
    <Modal open={open} onClose={onClose} title="New list" size="lg">
      <p className="muted small" style={{ marginBottom: "0.9rem" }}>
        Start from a ready-made list. Every field can be renamed, removed or added to afterwards. Money, dates, places and people
        flow into the budget, calendar, map and assignments automatically.
      </p>
      <div className="template-grid">
        {LIST_TEMPLATES.map((t) => (
          <button key={t.key} className="template-card" onClick={() => create(t.key)} disabled={!!busy}>
            <span className="template-art" style={{ background: "var(--soft2)", height: 64 }}>{busy === t.key ? <Loader2 className="spin" /> : t.icon}</span>
            <strong>{t.name}</strong>
            <span className="small muted">{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
