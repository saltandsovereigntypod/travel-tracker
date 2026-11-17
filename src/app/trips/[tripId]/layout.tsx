"use client";

import { use } from "react";
import { RequireAuth } from "@/components/AppChrome";
import { TripProvider } from "@/components/TripProvider";
import { TripShell } from "@/components/TripShell";

export default function TripLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  return (
    <RequireAuth>
      <TripProvider tripId={tripId}>
        <TripShell>{children}</TripShell>
      </TripProvider>
    </RequireAuth>
  );
}
