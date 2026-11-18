// What each kind of card can show, and how it can be arranged. Everyone picks their own,
// separately for a section's page and for each block on My view (blocks start out compact).

export interface CardPart {
  id: string;
  label: string;
  /** Off on the full page unless switched on. */
  off?: boolean;
  /** Off in My view blocks unless switched on (they're smaller). */
  blockOff?: boolean;
}

export interface CardChoice {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  def: string;
  blockDef?: string;
  /** Only offered in one place. */
  only?: "page" | "block";
}

export const CARD_PARTS = {
  ideas: [
    { id: "total", label: "Running estimate (what it'd all cost)", off: true },
    { id: "photo", label: "Photo", blockOff: true },
    { id: "about", label: "About (description)", blockOff: true },
    { id: "category", label: "Category", blockOff: true },
    { id: "price", label: "Price" },
    { id: "place", label: "Place", blockOff: true },
    { id: "link", label: "Link" },
    { id: "voters", label: "Who voted" },
    { id: "addedBy", label: "Added by", blockOff: true },
    { id: "votes", label: "Vote buttons" },
    { id: "comments", label: "Comments" },
    { id: "schedule", label: "Schedule button" },
  ],
  plans: [
    { id: "fixed", label: "Dates from flights, stays and lists" },
    { id: "place", label: "Place" },
    { id: "distance", label: "Distance from your stay" },
    { id: "price", label: "Price" },
    { id: "payment", label: "Payment status" },
    { id: "comments", label: "Comments" },
    { id: "about", label: "Notes", off: true, blockOff: true },
    { id: "link", label: "Link", off: true, blockOff: true },
  ],
  flights: [
    { id: "options", label: "Options you're still deciding on" },
    { id: "stops", label: "Stops & layovers" },
    { id: "travelers", label: "Who's going on each" },
    { id: "confirmation", label: "Confirmation code" },
    { id: "seats", label: "Seats", blockOff: true },
    { id: "price", label: "Price & payment" },
  ],
  stays: [
    { id: "options", label: "Places you're still deciding on" },
    { id: "address", label: "Address" },
    { id: "dates", label: "Check-in & check-out" },
    { id: "distance", label: "Distances", blockOff: true },
    { id: "price", label: "Price & payment" },
    { id: "confirmation", label: "Confirmation", blockOff: true },
    { id: "links", label: "Map, call & website", blockOff: true },
    { id: "guests", label: "Who's staying" },
  ],
  expenses: [
    { id: "category", label: "Category" },
    { id: "paidBy", label: "Who paid" },
    { id: "split", label: "Split" },
    { id: "date", label: "Date" },
  ],
  budget: [
    { id: "spent", label: "Spent so far" },
    { id: "toPay", label: "Still to pay" },
    { id: "bar", label: "Budget bar" },
    { id: "notBooked", label: "Not booked yet (estimate)", blockOff: true },
    { id: "balance", label: "What you owe or are owed" },
    { id: "buttons", label: "Buttons" },
  ],
  photos: [
    { id: "captions", label: "Captions", off: true, blockOff: true },
  ],
  lists: [
    { id: "feeds", label: "Where it feeds (budget, calendar…)" },
    { id: "comments", label: "Comments" },
    { id: "status", label: "Status" },
  ],
} satisfies Record<string, CardPart[]>;

export type CardKind = keyof typeof CARD_PARTS;

export const CARD_CHOICES: Partial<Record<CardKind, CardChoice[]>> = {
  ideas: [
    { id: "sort", label: "Order", def: "top", options: [{ value: "top", label: "Top voted" }, { value: "new", label: "Newest" }, { value: "price", label: "Cheapest first" }] },
    { id: "group", label: "Group by", def: "none", options: [{ value: "none", label: "Nothing" }, { value: "category", label: "Category" }, { value: "status", label: "Status" }] },
  ],
  plans: [
    { id: "days", label: "Days to show", def: "3", only: "block", options: [{ value: "1", label: "Next day" }, { value: "3", label: "Next 3" }, { value: "7", label: "Next 7" }, { value: "all", label: "All" }] },
  ],
  flights: [
    { id: "group", label: "Group by", def: "none", options: [{ value: "none", label: "Nothing" }, { value: "direction", label: "There & back" }, { value: "mode", label: "Type (flight, train…)" }, { value: "person", label: "Person" }] },
  ],
  stays: [
    { id: "group", label: "Group by", def: "none", options: [{ value: "none", label: "Nothing" }, { value: "status", label: "Booked & options" }] },
  ],
  photos: [
    { id: "group", label: "Group by", def: "none", options: [{ value: "none", label: "Nothing" }, { value: "day", label: "Day" }, { value: "plan", label: "Plan & stay" }, { value: "person", label: "Person" }, { value: "album", label: "Album" }] },
    { id: "show", label: "Show", def: "all", options: [{ value: "all", label: "All photos" }, { value: "fav", label: "Favorites" }] },
  ],
};

export type CardPrefs = Record<string, boolean | string>;

/** Is this part shown? Prefs hold only what someone changed. */
export function partShown(prefs: CardPrefs | undefined, kind: CardKind, id: string, inBlock = false): boolean {
  const v = prefs?.[id];
  if (typeof v === "boolean") return v;
  const def = (CARD_PARTS[kind] as CardPart[]).find((p) => p.id === id);
  return !(inBlock ? def?.blockOff ?? def?.off : def?.off);
}

export function choiceValue(prefs: CardPrefs | undefined, kind: CardKind, id: string, inBlock = false): string {
  const v = prefs?.[id];
  if (typeof v === "string") return v;
  const c = CARD_CHOICES[kind]?.find((x) => x.id === id);
  return (inBlock ? c?.blockDef ?? c?.def : c?.def) ?? "";
}

/** Where a person's choices for this card live: the page, or one My view block. */
export function prefsKey(kind: CardKind, scope?: string, block?: string | null): string {
  return `${kind}${scope ? `:${scope}` : ""}${block ? `#${block}` : ""}`;
}
