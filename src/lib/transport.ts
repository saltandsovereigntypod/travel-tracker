// Every way of getting from A to B: flights, trains, buses, ferries, rental cars,
// rideshares and driving. They share one table (`flights`); `mode` picks the words.

import type { LatLng } from "./geo";
import type { Flight } from "./types";

export type TransportMode = "flight" | "train" | "bus" | "ferry" | "rental" | "rideshare" | "drive" | "other";

export interface ModeInfo {
  id: TransportMode;
  label: string;
  emoji: string;
  /** "flight", "train", "rental car"… */
  noun: string;
  /** The company, and what to call it (null = not asked). */
  carrier: string | null;
  carrierPlaceholder: string;
  /** Flight/train number, car type… (null = not asked). */
  number: string | null;
  numberPlaceholder: string;
  from: string;
  to: string;
  fromPlaceholder: string;
  toPlaceholder: string;
  /** "Departs" / "Pick up". */
  depart: string;
  arrive: string;
  /** What arriving reads like on the calendar ("lands in", "arrives in"). */
  arrivesIn: string;
  seats: string | null;
  seatsPlaceholder: string;
  confirmation: boolean;
  /** "Who's on this flight". */
  who: string;
  price: string;
  /** Uses the airport lookup instead of a place search. */
  airports: boolean;
  /** Budget category for payments. */
  category: "flights" | "transport";
  notesPlaceholder: string;
}

const base = {
  confirmation: true,
  airports: false,
  category: "transport" as const,
  seats: null,
  seatsPlaceholder: "",
  arrivesIn: "arrives in",
};

export const MODES: Record<TransportMode, ModeInfo> = {
  flight: {
    ...base,
    id: "flight", label: "Flight", emoji: "✈️", noun: "flight",
    carrier: "Airline", carrierPlaceholder: "JetBlue", number: "Flight number", numberPlaceholder: "B6 1234",
    from: "From", to: "To", fromPlaceholder: "LAX or Los Angeles", toPlaceholder: "BOS or Boston",
    depart: "Departs", arrive: "Arrives", arrivesIn: "lands in",
    seats: "Seats", seatsPlaceholder: "14A, 14B",
    who: "Who's on this flight", price: "Ticket price", airports: true, category: "flights",
    notesPlaceholder: "Baggage, terminal, layover…",
  },
  train: {
    ...base,
    id: "train", label: "Train", emoji: "🚆", noun: "train",
    carrier: "Train company", carrierPlaceholder: "Amtrak, Eurostar…", number: "Train number", numberPlaceholder: "Acela 2153",
    from: "From station", to: "To station", fromPlaceholder: "Penn Station", toPlaceholder: "South Station",
    depart: "Departs", arrive: "Arrives",
    seats: "Car & seats", seatsPlaceholder: "Car 4, seats 12–13",
    who: "Who's on this train", price: "Ticket price",
    notesPlaceholder: "Platform, quiet car, bags…",
  },
  bus: {
    ...base,
    id: "bus", label: "Bus", emoji: "🚌", noun: "bus",
    carrier: "Bus company", carrierPlaceholder: "FlixBus, Greyhound…", number: "Route or bus number", numberPlaceholder: "N1234",
    from: "From", to: "To", fromPlaceholder: "Where it leaves from", toPlaceholder: "Where it drops you",
    depart: "Departs", arrive: "Arrives",
    seats: "Seats", seatsPlaceholder: "14, 15",
    who: "Who's on this bus", price: "Ticket price",
    notesPlaceholder: "Stop details, bags…",
  },
  ferry: {
    ...base,
    id: "ferry", label: "Ferry / boat", emoji: "⛴️", noun: "ferry",
    carrier: "Ferry line", carrierPlaceholder: "Steamship Authority", number: "Sailing", numberPlaceholder: "9:30 sailing",
    from: "From port", to: "To port", fromPlaceholder: "Woods Hole terminal", toPlaceholder: "Vineyard Haven",
    depart: "Departs", arrive: "Arrives",
    seats: "Cabin or seats", seatsPlaceholder: "Cabin 212",
    who: "Who's on this boat", price: "Ticket price",
    notesPlaceholder: "Bringing a car? Check-in time…",
  },
  rental: {
    ...base,
    id: "rental", label: "Rental car", emoji: "🚗", noun: "rental car",
    carrier: "Rental company", carrierPlaceholder: "Hertz, Turo…", number: "Car", numberPlaceholder: "Midsize SUV",
    from: "Pick up at", to: "Drop off at", fromPlaceholder: "Airport counter or address", toPlaceholder: "Leave empty if it's the same place",
    depart: "Pick up", arrive: "Drop off", arrivesIn: "drop off at",
    who: "Who's driving", price: "Rental price",
    notesPlaceholder: "Insurance, fuel policy, toll pass…",
  },
  rideshare: {
    ...base,
    id: "rideshare", label: "Rideshare / taxi", emoji: "🚕", noun: "ride",
    carrier: "Service", carrierPlaceholder: "Uber, Lyft, taxi…", number: null, numberPlaceholder: "",
    from: "Pick up at", to: "Going to", fromPlaceholder: "Airport, hotel…", toPlaceholder: "Where you're headed",
    depart: "Pick up", arrive: "Drop off", arrivesIn: "drop off at",
    confirmation: false,
    who: "Who's riding", price: "Fare",
    notesPlaceholder: "Meeting spot, how many bags…",
  },
  drive: {
    ...base,
    id: "drive", label: "Driving", emoji: "🛣️", noun: "drive",
    carrier: "Whose car", carrierPlaceholder: "Sam's car", number: null, numberPlaceholder: "",
    from: "Leaving from", to: "Driving to", fromPlaceholder: "Home, hotel…", toPlaceholder: "Where you're headed",
    depart: "Leave", arrive: "Arrive",
    confirmation: false,
    who: "Who's in the car", price: "Gas, tolls & parking",
    notesPlaceholder: "Stops on the way, who drives which leg…",
  },
  other: {
    ...base,
    id: "other", label: "Other", emoji: "🧭", noun: "trip",
    carrier: "Company", carrierPlaceholder: "", number: "Number", numberPlaceholder: "",
    from: "From", to: "To", fromPlaceholder: "Where it starts", toPlaceholder: "Where it ends",
    depart: "Leaves", arrive: "Arrives",
    seats: "Seats", seatsPlaceholder: "",
    who: "Who's going", price: "Price",
    notesPlaceholder: "",
  },
};

export const MODE_LIST: ModeInfo[] = Object.values(MODES);

export const modeOf = (f: { mode?: string | null }): ModeInfo => MODES[(f.mode as TransportMode) ?? "flight"] ?? MODES.flight;

type Ends = Pick<Flight, "from_code" | "from_name" | "to_code" | "to_name">;

/** A short name for one end: the airport code, else the first part of the place name. */
export function endLabel(f: Ends, side: "from" | "to"): string {
  const code = (side === "from" ? f.from_code : f.to_code)?.trim();
  if (code) return code;
  const name = (side === "from" ? f.from_name : f.to_name)?.trim() ?? "";
  return name.split(",")[0].trim();
}

/** Rental cars go back where they came from unless a drop-off is set. */
export function dropOff(f: Ends & { mode?: string | null }): string {
  return endLabel(f, "to") || (f.mode === "rental" ? endLabel(f, "from") : "");
}

/** "BOS → JFK", "Penn Station → South Station", "Rental at LAX". */
export function routeText(f: Ends & { mode?: string | null }): string {
  const a = endLabel(f, "from");
  const b = dropOff(f);
  if (f.mode === "rental" && (!b || b === a)) return a ? `at ${a}` : "";
  if (!a && !b) return "";
  return `${a || "?"} → ${b || "?"}`;
}

/** "JetBlue B6 1234", "Amtrak Acela 2153", else "Train: Penn Station → South Station". */
export function transportTitle(f: Ends & Pick<Flight, "airline" | "flight_number"> & { mode?: string | null }): string {
  const m = modeOf(f);
  const named = [f.airline, m.number ? f.flight_number : ""].filter(Boolean).join(" ");
  if (named) return m.id === "flight" || m.id === "train" || m.id === "bus" ? named : `${m.label}: ${named}`;
  const r = routeText(f);
  return r ? `${m.label} ${r.startsWith("at ") ? r : `· ${r}`}` : m.label;
}

/** Where an end is on the map: an airport, else the pinned place. */
export function endPoint(
  f: Ends & Pick<Flight, "from_lat" | "from_lng" | "to_lat" | "to_lng"> & { mode?: string | null },
  side: "from" | "to",
  airport: (code: string) => LatLng | null,
): LatLng | null {
  const lat = side === "from" ? f.from_lat : f.to_lat;
  const lng = side === "from" ? f.from_lng : f.to_lng;
  if (lat != null && lng != null) return { lat, lng };
  const code = side === "from" ? f.from_code : f.to_code;
  if (code?.trim()) return airport(code.trim().toUpperCase());
  // A rental with no drop-off goes back to the pick-up.
  if (side === "to" && f.mode === "rental") return endPoint(f, "from", airport);
  return null;
}
