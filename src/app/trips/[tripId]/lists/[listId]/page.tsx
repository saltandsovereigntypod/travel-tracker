"use client";

import { use } from "react";
import { ListPage } from "@/components/lists/ListPage";

export default function Page({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = use(params);
  return <ListPage listId={listId} />;
}
