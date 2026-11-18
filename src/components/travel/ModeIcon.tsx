import { Bus, Car, CarTaxiFront, Compass, Plane, Route, Ship, TrainFront } from "lucide-react";
import type { TransportMode } from "@/lib/transport";

const ICONS: Record<TransportMode, typeof Plane> = {
  flight: Plane,
  train: TrainFront,
  bus: Bus,
  ferry: Ship,
  rental: Car,
  rideshare: CarTaxiFront,
  drive: Route,
  other: Compass,
};

/** The icon for how you're getting there. */
export function ModeIcon({ mode, size = 16 }: { mode?: string | null; size?: number }) {
  const Icon = ICONS[(mode as TransportMode) ?? "flight"] ?? Plane;
  return <Icon size={size} aria-hidden />;
}
