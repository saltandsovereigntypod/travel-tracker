// Ready-made lists. Each comes with sensible fields so a new list is useful in one tap,
// and every field can be changed afterwards.

import type { FieldDef, FieldOption, FieldType, ListDef, OptionKind } from "./fields";
import { defaultStatusOptions } from "./fields";

interface TplField {
  key: string;
  name: string;
  type: FieldType;
  options?: [string, OptionKind?][];
  /** relation: key of another template list created alongside. */
  linkTo?: string;
  rollup?: FieldDef["rollup"];
  feeds?: FieldDef["feeds"];
}

export interface ListTemplate {
  key: string;
  name: string;
  icon: string;
  description: string;
  titleLabel: string;
  fields: TplField[];
}

const status = (...opts: [string, OptionKind?][]): TplField["options"] => opts;

export const LIST_TEMPLATES: ListTemplate[] = [
  {
    key: "blank",
    name: "Blank list",
    icon: "📋",
    description: "Start with just a name and notes; add any fields you like",
    titleLabel: "Name",
    fields: [{ key: "notes", name: "Notes", type: "longtext" }],
  },
  {
    key: "tasks",
    name: "To-dos",
    icon: "✅",
    description: "Who's doing what, by when",
    titleLabel: "Task",
    fields: [
      { key: "status", name: "Status", type: "status" },
      { key: "who", name: "Who", type: "person" },
      { key: "due", name: "Due", type: "date" },
      { key: "notes", name: "Notes", type: "longtext" },
    ],
  },
  {
    key: "guests",
    name: "Guests",
    icon: "💌",
    description: "RSVPs, party size, meals and tables",
    titleLabel: "Guest",
    fields: [
      { key: "rsvp", name: "RSVP", type: "status", options: status(["Not sent", "todo"], ["Invited", "doing"], ["Coming", "done"], ["Can't come", "cancelled"]) },
      { key: "size", name: "Party size", type: "number" },
      { key: "side", name: "Side / group", type: "select", options: status(["Family"], ["Friends"], ["Work"]) },
      { key: "meal", name: "Meal", type: "select", options: status(["Chicken"], ["Fish"], ["Vegetarian"], ["Kids"]) },
      { key: "table", name: "Table", type: "select" },
      { key: "email", name: "Email", type: "email" },
      { key: "phone", name: "Phone", type: "phone" },
      { key: "address", name: "Mailing address", type: "place", feeds: { map: false } },
    ],
  },
  {
    key: "vendors",
    name: "Vendors",
    icon: "🤝",
    description: "Venues, photographers, florists: prices, deposits and due dates",
    titleLabel: "Vendor",
    fields: [
      { key: "category", name: "Category", type: "select", options: status(["Venue"], ["Photographer"], ["Catering"], ["Florist"], ["Music"], ["Cake"], ["Attire"], ["Other"]) },
      { key: "status", name: "Status", type: "status", options: status(["Researching", "todo"], ["Contacted", "doing"], ["Booked", "done"], ["Passed", "cancelled"]) },
      { key: "price", name: "Price", type: "money" },
      { key: "deposit_due", name: "Deposit due", type: "date" },
      { key: "final_due", name: "Final payment due", type: "date" },
      { key: "contact", name: "Contact", type: "text" },
      { key: "phone", name: "Phone", type: "phone" },
      { key: "email", name: "Email", type: "email" },
      { key: "website", name: "Website", type: "url" },
      { key: "where", name: "Location", type: "place" },
    ],
  },
  {
    key: "episodes",
    name: "Episodes",
    icon: "🎧",
    description: "From idea to published: guests, recording and release dates",
    titleLabel: "Episode",
    fields: [
      { key: "number", name: "Episode #", type: "number" },
      { key: "status", name: "Status", type: "status", options: status(["Idea", "todo"], ["Scheduled", "doing"], ["Recorded", "doing"], ["Editing", "doing"], ["Published", "done"], ["Shelved", "cancelled"]) },
      { key: "guests", name: "Guests", type: "relation", linkTo: "podcast_guests" },
      { key: "record", name: "Recording", type: "datetime" },
      { key: "release", name: "Release date", type: "date" },
      { key: "host", name: "Hosts", type: "people" },
      { key: "editor", name: "Editor", type: "person" },
      { key: "topic", name: "Topic & notes", type: "longtext" },
    ],
  },
  {
    key: "podcast_guests",
    name: "Guests",
    icon: "🎤",
    description: "Who you're booking, their topics and contact info",
    titleLabel: "Guest",
    fields: [
      { key: "status", name: "Status", type: "status", options: status(["Pitched", "todo"], ["Confirmed", "doing"], ["Recorded", "done"], ["Declined", "cancelled"]) },
      { key: "topic", name: "Topic", type: "text" },
      { key: "email", name: "Email", type: "email" },
      { key: "socials", name: "Website / socials", type: "url" },
    ],
  },
  {
    key: "sponsors",
    name: "Sponsors",
    icon: "💸",
    description: "Deals, amounts and deliverables",
    titleLabel: "Sponsor",
    fields: [
      { key: "status", name: "Status", type: "status", options: status(["Prospect", "todo"], ["Negotiating", "doing"], ["Signed", "done"], ["Lost", "cancelled"]) },
      // Sponsor money is income, so it doesn't count as spending.
      { key: "amount", name: "Deal amount", type: "money", feeds: { budget: false } },
      { key: "due", name: "Invoice due", type: "date" },
      { key: "contact", name: "Contact", type: "text" },
      { key: "email", name: "Email", type: "email" },
      { key: "episodes", name: "Episodes", type: "relation", linkTo: "episodes" },
    ],
  },
  {
    key: "bills",
    name: "Bills",
    icon: "🧾",
    description: "What's due, how much, and who's paying",
    titleLabel: "Bill",
    fields: [
      { key: "amount", name: "Amount", type: "money" },
      { key: "due", name: "Due", type: "date" },
      { key: "paid", name: "Paid", type: "checkbox" },
      { key: "who", name: "Paid by", type: "person" },
      { key: "how", name: "How often", type: "select", options: status(["Once"], ["Weekly"], ["Monthly"], ["Yearly"]) },
    ],
  },
  {
    key: "chores",
    name: "Chores",
    icon: "🧹",
    description: "Who's on what, and when it's due",
    titleLabel: "Chore",
    fields: [
      { key: "who", name: "Who", type: "person" },
      { key: "due", name: "Due", type: "date" },
      { key: "done", name: "Done", type: "checkbox" },
      { key: "how", name: "How often", type: "select", options: status(["Daily"], ["Weekly"], ["Monthly"]) },
    ],
  },
  {
    key: "restaurants",
    name: "Restaurants",
    icon: "🍽️",
    description: "Places to eat, reservations and verdicts",
    titleLabel: "Restaurant",
    fields: [
      { key: "status", name: "Status", type: "status", options: status(["Want to try", "todo"], ["Booked", "doing"], ["Been there", "done"]) },
      { key: "where", name: "Where", type: "place" },
      { key: "cuisine", name: "Cuisine", type: "select" },
      { key: "price", name: "Price level", type: "select", options: status(["$"], ["$$"], ["$$$"], ["$$$$"]) },
      { key: "reservation", name: "Reservation", type: "datetime" },
      { key: "rating", name: "Rating", type: "rating" },
    ],
  },
  {
    key: "costumes",
    name: "Costumes & outfits",
    icon: "🎭",
    description: "Who's wearing what, links and costs",
    titleLabel: "Outfit",
    fields: [
      { key: "who", name: "Who", type: "people" },
      { key: "status", name: "Status", type: "status", options: status(["Idea", "todo"], ["Ordered", "doing"], ["Ready", "done"]) },
      { key: "link", name: "Link", type: "url" },
      { key: "cost", name: "Cost", type: "money" },
    ],
  },
  {
    key: "gifts",
    name: "Gifts",
    icon: "🎁",
    description: "Gift ideas, who they're for, bought or not",
    titleLabel: "Gift",
    fields: [
      { key: "for", name: "For", type: "text" },
      { key: "link", name: "Link", type: "url" },
      { key: "cost", name: "Cost", type: "money" },
      { key: "bought", name: "Bought", type: "checkbox" },
    ],
  },
];

export const listTemplate = (key: string) => LIST_TEMPLATES.find((t) => t.key === key) ?? LIST_TEMPLATES[0];

/** Starter lists created along with each kind of space. */
export const SPACE_LISTS: Record<string, string[]> = {
  wedding: ["guests", "vendors", "tasks"],
  podcast: ["episodes", "podcast_guests", "sponsors"],
  household: ["bills", "chores"],
  event: ["guests", "tasks"],
  trip: [],
  blank: [],
};

/**
 * Build list rows for one or more templates, resolving links between them
 * (e.g. Episodes ↔ Guests) when they're created together, or to existing lists.
 */
export function buildLists(
  keys: string[],
  tripId: string,
  existing: Pick<ListDef, "id" | "settings">[] = [],
  startOrder = 0,
): Omit<ListDef, "created_at" | "updated_at" | "created_by">[] {
  const ids: Record<string, string> = {};
  // Existing lists made from a template can be linked to as well.
  for (const l of existing) {
    const k = (l.settings as { template?: string })?.template;
    if (k && !ids[k]) ids[k] = l.id;
  }
  for (const k of keys) ids[k] = crypto.randomUUID();
  return keys.map((k, n) => {
    const t = listTemplate(k);
    const fields: FieldDef[] = t.fields
      .filter((f) => f.type !== "relation" || (f.linkTo && ids[f.linkTo]))
      .map((f) => {
        const def: FieldDef = { id: f.key, name: f.name, type: f.type };
        if (f.type === "status") {
          def.options = f.options
            ? f.options.map(([label, kind], i) => opt(label, i, kind))
            : defaultStatusOptions();
        } else if (f.options) def.options = f.options.map(([label], i) => opt(label, i));
        else if (f.type === "select" || f.type === "multiselect") def.options = [];
        if (f.linkTo) def.listId = ids[f.linkTo];
        if (f.feeds) def.feeds = f.feeds;
        if (f.rollup) def.rollup = f.rollup;
        return def;
      });
    return {
      id: ids[k],
      trip_id: tripId,
      name: t.name,
      icon: t.icon,
      description: t.description,
      fields,
      settings: { template: k, titleLabel: t.titleLabel },
      sort_order: startOrder + n,
    };
  });
}

const COLORS = ["#3D5A80", "#E07A5F", "#81B29A", "#F2CC8F", "#9B5DE5", "#F15BB5", "#00BBF9", "#6D597A"];
function opt(label: string, i: number, kind?: OptionKind): FieldOption {
  const color = kind === "done" ? "#81B29A" : kind === "cancelled" ? "#A3A3A3" : kind === "doing" ? "#F2CC8F" : kind === "todo" ? "#C9C9C9" : COLORS[i % COLORS.length];
  return { id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `o${i}`, label, color, ...(kind ? { kind } : {}) };
}
