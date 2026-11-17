"use client";

import { use } from "react";
import { PageDoc } from "@/components/pages/PageDoc";

export default function Page({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = use(params);
  // Keyed so switching pages starts fresh (pending edits are flushed on the way out).
  return <PageDoc key={pageId} pageId={pageId} />;
}
