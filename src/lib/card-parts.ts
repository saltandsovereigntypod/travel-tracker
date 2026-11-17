// What each kind of card can show. Everyone picks their own (saved in their view);
// everything is on unless they switch it off.

export interface CardPart {
  id: string;
  label: string;
  /** Off unless someone switches it on. */
  off?: boolean;
}

export const CARD_PARTS = {
  ideas: [
    { id: "photo", label: "Photo" },
    { id: "about", label: "About" },
    { id: "category", label: "Category" },
    { id: "price", label: "Price" },
    { id: "place", label: "Place" },
    { id: "link", label: "Link" },
    { id: "voters", label: "Who voted" },
    { id: "addedBy", label: "Added by" },
    { id: "votes", label: "Vote buttons" },
    { id: "comments", label: "Comments" },
    { id: "schedule", label: "Schedule button" },
  ],
  plans: [
    { id: "place", label: "Place" },
    { id: "distance", label: "Distance from your stay" },
    { id: "price", label: "Price" },
    { id: "payment", label: "Payment status" },
    { id: "comments", label: "Comments" },
    { id: "about", label: "Notes", off: true },
    { id: "link", label: "Link", off: true },
  ],
  flights: [
    { id: "travelers", label: "Who's flying" },
    { id: "confirmation", label: "Confirmation code" },
    { id: "seats", label: "Seats" },
    { id: "price", label: "Price & payment" },
  ],
  stays: [
    { id: "address", label: "Address" },
    { id: "dates", label: "Check-in & check-out" },
    { id: "distance", label: "Distances" },
    { id: "price", label: "Price & payment" },
    { id: "confirmation", label: "Confirmation" },
    { id: "links", label: "Map, call & website" },
    { id: "guests", label: "Who's staying" },
  ],
  expenses: [
    { id: "category", label: "Category" },
    { id: "paidBy", label: "Who paid" },
    { id: "split", label: "Split" },
    { id: "date", label: "Date" },
  ],
  lists: [
    { id: "feeds", label: "Where it feeds (budget, calendar…)" },
    { id: "comments", label: "Comments" },
    { id: "status", label: "Status" },
  ],
} satisfies Record<string, CardPart[]>;

export type CardKind = keyof typeof CARD_PARTS;

/** Is this part shown? Prefs hold only what someone changed from the default. */
export function partShown(prefs: Record<string, boolean> | undefined, kind: CardKind, id: string): boolean {
  const v = prefs?.[id];
  if (typeof v === "boolean") return v;
  return !(CARD_PARTS[kind] as CardPart[]).find((p) => p.id === id)?.off;
}
