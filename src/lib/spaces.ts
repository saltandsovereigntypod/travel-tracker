// Spaces, modules and templates.
// A space is anything you plan with people: a trip, a wedding, a podcast season, a household.
// A module is a feature you can switch on per space. A template is a starting set of modules.

export type ModuleId =
  | "today"
  | "ideas"
  | "itinerary"
  | "flights"
  | "stays"
  | "budget"
  | "packing"
  | "map"
  | "notes"
  | "photos"
  | "scrapbook";

export interface ModuleDef {
  id: ModuleId;
  /** Generic name used when a template doesn't rename it. */
  label: string;
  description: string;
  /** Route segment under /trips/[id]/ */
  slug: string;
}

export const MODULES: ModuleDef[] = [
  { id: "today", label: "Today", description: "What's happening now and what needs attention", slug: "today" },
  { id: "ideas", label: "Ideas", description: "Everyone's suggestions, with votes and comments", slug: "ideas" },
  { id: "itinerary", label: "Calendar", description: "Plans by day, drag and drop", slug: "itinerary" },
  { id: "budget", label: "Budget", description: "Costs, payments, deposits and who owes whom", slug: "budget" },
  { id: "packing", label: "Checklists", description: "Shared and private checklists", slug: "packing" },
  { id: "map", label: "Map", description: "Everything with a location, pinned", slug: "map" },
  { id: "notes", label: "Notes & journal", description: "Shared notes, private notes and a journal", slug: "notes" },
  { id: "photos", label: "Photos", description: "A shared photo album", slug: "photos" },
  { id: "scrapbook", label: "Scrapbook", description: "A printable keepsake of it all", slug: "scrapbook" },
  { id: "flights", label: "Getting around", description: "Flights, trains, buses, ferries, rental cars, rides and drives", slug: "flights" },
  { id: "stays", label: "Stays", description: "Hotels, rentals and places to stay", slug: "stays" },
];

export const moduleDef = (id: string) => MODULES.find((m) => m.id === id);
export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug);

export interface ModuleSetting {
  id: ModuleId;
  label?: string;
}

export interface SpaceTemplate {
  kind: string;
  name: string;
  icon: string;
  description: string;
  /** How the app refers to this kind of space ("trip", "wedding", "show"). */
  noun: string;
  /** Labels for the date fields when creating one. */
  dates: { label: string; single?: boolean; optional: boolean };
  /** Label for the location field, or null to hide it. */
  location: string | null;
  modules: ModuleSetting[];
  gradient: string;
}

export const TEMPLATES: SpaceTemplate[] = [
  {
    kind: "trip",
    name: "Trip",
    icon: "✈️",
    description: "Ideas, itinerary, flights, stays, budget, packing and a map",
    noun: "trip",
    dates: { label: "Trip dates", optional: true },
    location: "Where to?",
    gradient: "linear-gradient(135deg, #3D5A80, #E07A5F)",
    modules: [
      { id: "today" },
      { id: "ideas" },
      { id: "itinerary", label: "Itinerary" },
      { id: "flights" },
      { id: "stays" },
      { id: "budget" },
      { id: "packing", label: "Packing" },
      { id: "map" },
      { id: "notes" },
      { id: "photos" },
      { id: "scrapbook" },
    ],
  },
  {
    kind: "wedding",
    name: "Wedding",
    icon: "💍",
    description: "Inspiration, schedule, budget with deposits, to-dos and venues",
    noun: "wedding",
    dates: { label: "Wedding date", single: true, optional: true },
    location: "Where? (optional)",
    gradient: "linear-gradient(135deg, #B5838D, #FFCDB2)",
    modules: [
      { id: "today" },
      { id: "ideas", label: "Inspiration" },
      { id: "itinerary", label: "Schedule" },
      { id: "budget" },
      { id: "packing", label: "To-dos" },
      { id: "map", label: "Venues & places" },
      { id: "notes" },
      { id: "photos" },
      { id: "scrapbook", label: "Memories" },
    ],
  },
  {
    kind: "podcast",
    name: "Podcast production",
    icon: "🎙️",
    description: "Episode ideas, recording calendar, checklists, money and show notes",
    noun: "show",
    dates: { label: "Season dates", optional: true },
    location: null,
    gradient: "linear-gradient(135deg, #2A1F31, #8E6BBF)",
    modules: [
      { id: "today" },
      { id: "ideas", label: "Episode ideas" },
      { id: "itinerary", label: "Calendar" },
      { id: "packing", label: "Checklists" },
      { id: "budget", label: "Money" },
      { id: "notes", label: "Show notes" },
      { id: "photos", label: "Artwork & media" },
    ],
  },
  {
    kind: "household",
    name: "Household",
    icon: "🏡",
    description: "Shared calendar, bills and spending, chores and lists, projects",
    noun: "home",
    dates: { label: "Dates", optional: true },
    location: null,
    gradient: "linear-gradient(135deg, #5B8C51, #F1F4EC)",
    modules: [
      { id: "today" },
      { id: "itinerary", label: "Calendar" },
      { id: "budget", label: "Bills & spending" },
      { id: "packing", label: "Chores & lists" },
      { id: "ideas", label: "Projects & wishlist" },
      { id: "notes" },
      { id: "photos" },
    ],
  },
  {
    kind: "event",
    name: "Event or party",
    icon: "🎉",
    description: "A birthday, reunion or party: ideas, schedule, budget and to-dos",
    noun: "event",
    dates: { label: "Event date", single: true, optional: true },
    location: "Where? (optional)",
    gradient: "linear-gradient(135deg, #F15BB5, #FEE440)",
    modules: [
      { id: "today" },
      { id: "ideas" },
      { id: "itinerary", label: "Schedule" },
      { id: "budget" },
      { id: "packing", label: "To-dos" },
      { id: "map" },
      { id: "notes" },
      { id: "photos" },
    ],
  },
  {
    kind: "blank",
    name: "Blank space",
    icon: "✨",
    description: "Start simple and switch on only what you need",
    noun: "space",
    dates: { label: "Dates", optional: true },
    location: null,
    gradient: "linear-gradient(135deg, #6D597A, #EAAC8B)",
    modules: [{ id: "today" }, { id: "notes" }],
  },
];

export const templateFor = (kind: string | null | undefined): SpaceTemplate =>
  TEMPLATES.find((t) => t.kind === kind) ?? TEMPLATES[0];

export interface ResolvedModule extends ModuleDef {
  /** Name shown in this space (template or custom rename). */
  name: string;
}

/** Modules switched on for a space, in nav order, with their display names. */
export function resolveModules(space: { kind?: string | null; modules?: unknown } | null | undefined): ResolvedModule[] {
  const tpl = templateFor(space?.kind);
  const saved = Array.isArray(space?.modules) ? (space!.modules as ModuleSetting[]) : [];
  const list = saved.length ? saved : tpl.modules;
  return list
    .map((s) => {
      const def = moduleDef(s.id);
      if (!def) return null;
      const tplLabel = tpl.modules.find((m) => m.id === s.id)?.label;
      return { ...def, name: s.label?.trim() || tplLabel || def.label };
    })
    .filter((m): m is ResolvedModule => !!m);
}

export function hasModule(space: Parameters<typeof resolveModules>[0], id: ModuleId) {
  return resolveModules(space).some((m) => m.id === id);
}

/** Capitalized noun ("Trip", "Wedding"). */
export const Noun = (kind: string | null | undefined) => {
  const n = templateFor(kind).noun;
  return n.charAt(0).toUpperCase() + n.slice(1);
};
