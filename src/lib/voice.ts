// How each kind of space talks. Every page hint, empty state, button and suggestion
// comes from here, so a podcast doesn't read like a trip in a costume.
// Blank and custom spaces use plain, neutral words that fit anything.

export interface Category {
  id: string;
  label: string;
  emoji: string;
}

export interface Voice {
  /** Ongoing spaces (a show, a home) have no end date: rolling calendar, "next up" instead of a countdown. */
  ongoing: boolean;
  /** Has flights, stays, distances and "where to stay". */
  travel: boolean;
  calendar: {
    hint: string;
    thing: string;
    things: string;
    add: string;
    titlePlaceholder: string;
    notesPlaceholder: string;
    unscheduledKicker: string;
    unscheduledTitle: string;
    drop: string;
    noDates: string;
    empty: string;
  };
  ideas: {
    hint: string;
    thing: string;
    add: string;
    empty: string;
    emptyHint: string;
    titlePlaceholder: string;
    notesPlaceholder: string;
    schedule: string;
    costLabel: string;
  };
  checklists: { hint: string; groupPlaceholder: string; minePlaceholder: string; whoBrings: string; suggestions: Record<string, string[]> };
  notes: { hint: string; journalEmpty: string; journalPrompt: string };
  photos: { hint: string; empty: string; byLinked: string };
  budget: { hint: string; empty: string; expensePlaceholder: string };
  people: { hint: string; memberWord: string };
  today: { hint: string };
  countdown: { until: (noun: string) => string; after: (noun: string) => string };
  attachHint: string;
  scrapbook: { numbersTitle: (noun: string) => string; chapterByStay: boolean };
  ideaCategories: Category[];
  expenseCategories: Category[];
}

const TRIP_CATEGORIES: Category[] = [
  { id: "activity", label: "Activity", emoji: "🎟️" },
  { id: "sight", label: "Sightseeing", emoji: "🏛️" },
  { id: "tour", label: "Tour", emoji: "🕯️" },
  { id: "food", label: "Food", emoji: "🍽️" },
  { id: "drinks", label: "Drinks & cafés", emoji: "☕" },
  { id: "event", label: "Event", emoji: "🎃" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "nature", label: "Outdoors", emoji: "🌲" },
  { id: "nightlife", label: "Nightlife", emoji: "🌙" },
  { id: "transport", label: "Getting around", emoji: "🚆" },
  { id: "rest", label: "Downtime", emoji: "🛋️" },
  { id: "other", label: "Other", emoji: "✨" },
];

const base = (noun: string): Omit<Voice, "ideaCategories" | "expenseCategories"> => ({
  ongoing: false,
  travel: false,
  calendar: {
    hint: "Everything with a date, in one place. Drag things between days.",
    thing: "item",
    things: "items",
    add: "Add to calendar",
    titlePlaceholder: "What's happening?",
    notesPlaceholder: "Details, links, who's doing what…",
    unscheduledKicker: "No date yet",
    unscheduledTitle: "To schedule",
    drop: "Drop things here",
    noDates: `Add dates in settings to see the ${noun} day by day, or just add things with any date.`,
    empty: "Nothing on the calendar yet",
  },
  ideas: {
    hint: "Everything anyone suggests. Vote, comment, then put the winners on the calendar.",
    thing: "idea",
    add: "Add idea",
    empty: "No ideas yet",
    emptyHint: "Anything worth considering goes here. Vote on what to do next.",
    titlePlaceholder: "What's the idea?",
    notesPlaceholder: "Why it's worth it, links, who suggested it…",
    schedule: "Add to calendar",
    costLabel: "Rough cost",
  },
  checklists: {
    hint: "A shared list for the group, and a private one just for you.",
    groupPlaceholder: "Add to the group list…",
    minePlaceholder: "Add to your list…",
    whoBrings: "Who's on it",
    suggestions: {},
  },
  notes: {
    hint: "Shared notes for everyone, private notes for you, and a journal to remember it by.",
    journalEmpty: "Write a little as you go. It becomes your scrapbook later.",
    journalPrompt: "What happened? What do you want to remember?",
  },
  photos: {
    hint: "Everyone's pictures in one place, sorted by day and person automatically. Heart the best ones.",
    empty: "Add pictures, screenshots and anything visual.",
    byLinked: "By what it's for",
  },
  budget: {
    hint: "Costs you add count as still to pay. Mark them paid (or pay a deposit) and they move to spent.",
    empty: "Use “Mark as paid” or “Add deposit” on anything with a cost, or add an expense here.",
    expensePlaceholder: "What was it for?",
  },
  people: { hint: "Who's in, who can edit, and how to invite more people.", memberWord: "member" },
  today: { hint: "A quick look at what needs attention." },
  countdown: { until: (n) => `until the ${n}`, after: (n) => `what a ${n}` },
  attachHint: "Shows with that item, and in its scrapbook chapter.",
  scrapbook: { numbersTitle: (n) => `The ${n} in numbers`, chapterByStay: false },
});

const GENERIC_EXPENSES: Category[] = [
  { id: "supplies", label: "Supplies", emoji: "📦" },
  { id: "services", label: "Services", emoji: "🧾" },
  { id: "food", label: "Food & drink", emoji: "🍽️" },
  { id: "transport", label: "Transport", emoji: "🚕" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "other", label: "Other", emoji: "✨" },
];

export const VOICES: Record<string, Voice> = {
  trip: {
    ...base("trip"),
    travel: true,
    calendar: {
      ...base("trip").calendar,
      hint: "Drag plans between days. Flights and stays appear on their dates automatically.",
      thing: "plan",
      things: "plans",
      add: "Add plan",
      titlePlaceholder: "Dinner at the harbor",
      notesPlaceholder: "Booking details, what to bring…",
      unscheduledKicker: "Unscheduled",
      unscheduledTitle: "Someday / not sure yet",
      drop: "Drop plans here",
      noDates: "Add trip dates to get a day-by-day plan, or just add plans with any date.",
      empty: "Nothing planned yet",
    },
    ideas: {
      ...base("trip").ideas,
      hint: "Everything anyone wants to do. Vote, comment, then add the winners to the itinerary.",
      emptyHint: "Restaurants, tours, shops, that one bookstore… drop it all here.",
      titlePlaceholder: "A museum, a restaurant, a tour…",
      notesPlaceholder: "Notes, opening hours, who recommended it…",
      schedule: "Add to itinerary",
    },
    checklists: {
      hint: "The shared list is for group stuff (“who's bringing the speaker?”). Your list is private to you.",
      groupPlaceholder: "Add to the group list…",
      minePlaceholder: "Add to your packing list…",
      whoBrings: "Who's bringing it",
      suggestions: {
        Essentials: ["ID / passport", "Phone charger", "Wallet & cards", "Medications", "Headphones"],
        Clothes: ["Warm jacket", "Comfortable walking shoes", "Layers", "Rain jacket", "Pajamas"],
        Toiletries: ["Toothbrush", "Skincare", "Hairbrush", "Deodorant"],
        Tech: ["Camera", "Power bank", "Travel adapter"],
      },
    },
    photos: { hint: "Everyone's pictures, sorted by day, plan and person automatically. Heart the best ones for the scrapbook.", empty: "Inspiration shots before, real ones during.", byLinked: "By plan & stay" },
    budget: { ...base("trip").budget, hint: "Plans you schedule count as still to pay. Mark them paid (or pay a deposit) and they move to spent.", empty: "Use “Mark as paid” or “Add deposit” on any plan, flight or stay, or add an expense here.", expensePlaceholder: "Ghost tour tickets" },
    people: { hint: "Who's coming, who can edit, and how to bring more people in.", memberWord: "traveler" },
    today: { hint: "What's happening today, and what needs attention before you go." },
    attachHint: "Shows with that plan, stay or flight, and in its scrapbook chapter.",
    scrapbook: { numbersTitle: () => "The trip in numbers", chapterByStay: true },
    ideaCategories: TRIP_CATEGORIES,
    expenseCategories: [
      { id: "flights", label: "Flights", emoji: "✈️" },
      { id: "lodging", label: "Lodging", emoji: "🏨" },
      { id: "food", label: "Food & drink", emoji: "🍽️" },
      { id: "activities", label: "Activities", emoji: "🎟️" },
      { id: "transport", label: "Transport", emoji: "🚕" },
      { id: "shopping", label: "Shopping", emoji: "🛍️" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
  },
  wedding: {
    ...base("wedding"),
    calendar: {
      ...base("wedding").calendar,
      hint: "Appointments, deadlines and the big day itself. Vendor dates and deposits show up automatically.",
      thing: "event",
      things: "events",
      add: "Add to schedule",
      titlePlaceholder: "Dress fitting, cake tasting, rehearsal…",
      notesPlaceholder: "Address, who's coming, what to bring…",
      unscheduledTitle: "Needs a date",
      drop: "Drop events here",
      noDates: "Add the wedding date in settings to see the countdown, or just add events with any date.",
      empty: "Nothing scheduled yet",
    },
    ideas: {
      ...base("wedding").ideas,
      hint: "Inspiration from everyone: decor, music, food, outfits. Vote, then add the keepers to the plan.",
      thing: "idea",
      empty: "No inspiration yet",
      emptyHint: "Pin colors, flowers, songs, venues and outfits here.",
      titlePlaceholder: "Candlelit aisle, a string quartet, a taco truck…",
      notesPlaceholder: "Links, photos, who loves it…",
      schedule: "Add to schedule",
      costLabel: "Rough cost",
    },
    checklists: {
      hint: "Shared to-dos for the couple and helpers, and a private list just for you.",
      groupPlaceholder: "Add a wedding to-do…",
      minePlaceholder: "Add to your list…",
      whoBrings: "Who's handling it",
      suggestions: {
        "12+ months out": ["Set the budget", "Draft the guest list", "Book the venue", "Pick a date"],
        "9 months out": ["Book photographer", "Book caterer", "Choose wedding party", "Send save-the-dates"],
        "6 months out": ["Order attire", "Book florist", "Book music / DJ", "Plan the honeymoon"],
        "3 months out": ["Send invitations", "Order rings", "Schedule tastings", "Book hair & makeup"],
        "Final month": ["Final guest count", "Seating chart", "Confirm vendors", "Pack for the day"],
      },
    },
    notes: { ...base("wedding").notes, journalPrompt: "What happened today? What do you never want to forget?" },
    photos: { hint: "Inspiration, dress fittings, venue visits and the day itself, all in one place.", empty: "Add inspiration now, the real ones later.", byLinked: "By event or vendor" },
    budget: { ...base("wedding").budget, hint: "Vendor quotes count as still to pay. Track deposits and final payments, and see who owes what.", expensePlaceholder: "Venue deposit" },
    people: { hint: "The couple, family and helpers: who can edit, and how to invite more people.", memberWord: "person" },
    today: { hint: "What needs doing next for the wedding." },
    attachHint: "Shows with that event, vendor or guest, and in the scrapbook.",
    ideaCategories: [
      { id: "ceremony", label: "Ceremony", emoji: "💒" },
      { id: "reception", label: "Reception", emoji: "🥂" },
      { id: "decor", label: "Decor & flowers", emoji: "💐" },
      { id: "food", label: "Food & cake", emoji: "🎂" },
      { id: "attire", label: "Attire", emoji: "👗" },
      { id: "music", label: "Music", emoji: "🎻" },
      { id: "photo", label: "Photo & video", emoji: "📸" },
      { id: "stationery", label: "Stationery", emoji: "💌" },
      { id: "honeymoon", label: "Honeymoon", emoji: "🌴" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
    expenseCategories: [
      { id: "venue", label: "Venue", emoji: "💒" },
      { id: "catering", label: "Catering", emoji: "🍽️" },
      { id: "attire", label: "Attire", emoji: "👗" },
      { id: "flowers", label: "Flowers & decor", emoji: "💐" },
      { id: "photo", label: "Photo & video", emoji: "📸" },
      { id: "music", label: "Music", emoji: "🎻" },
      { id: "rings", label: "Rings", emoji: "💍" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
  },
  podcast: {
    ...base("show"),
    ongoing: true,
    calendar: {
      ...base("show").calendar,
      hint: "Recording sessions and release dates. Episode dates from your lists show up here automatically.",
      thing: "session",
      things: "sessions",
      add: "Add session",
      titlePlaceholder: "Record ep. 12 with a guest",
      notesPlaceholder: "Link to the call, prep notes, equipment…",
      unscheduledKicker: "Not scheduled",
      unscheduledTitle: "To schedule",
      drop: "Drop sessions here",
      noDates: "",
      empty: "Nothing scheduled yet",
    },
    ideas: {
      ...base("show").ideas,
      hint: "Episode ideas from everyone. Vote on what to make next, then turn the winners into episodes.",
      thing: "episode idea",
      add: "Add episode idea",
      empty: "No episode ideas yet",
      emptyHint: "Topics, guests you'd love, segments, series. Vote on what to make next.",
      titlePlaceholder: "A topic, a guest, a segment…",
      notesPlaceholder: "The angle, questions to ask, sources…",
      schedule: "Schedule it",
      costLabel: "Rough cost to make",
    },
    checklists: {
      hint: "Production checklists the whole team shares, and a private list just for you.",
      groupPlaceholder: "Add a production task…",
      minePlaceholder: "Add to your list…",
      whoBrings: "Who's on it",
      suggestions: {
        "Pre-production": ["Research the topic", "Write the outline", "Prep guest questions", "Send guest the prep sheet"],
        "Recording day": ["Test mics and levels", "Record room tone", "Backup recording running", "Note timestamps"],
        "Post-production": ["Edit", "Mix and master", "Export audio", "Write show notes", "Make the episode artwork"],
        Publishing: ["Upload to host", "Schedule release", "Share clips", "Thank the guest"],
      },
    },
    notes: { hint: "Show notes, research and scripts for everyone, private notes for you, and a production journal.", journalEmpty: "Jot down how recordings went and what to try next time.", journalPrompt: "How did today's session go? What worked, what to try next time?" },
    photos: { hint: "Cover art, episode graphics, promo clips and behind-the-scenes shots, sorted by episode and person.", empty: "Add cover art, episode artwork and behind-the-scenes photos.", byLinked: "By episode" },
    budget: { ...base("show").budget, hint: "What the show costs and what it earns: gear, software, hosting, editing and sponsor money in.", empty: "Add an expense, or mark something on an episode or sponsor as paid or received.", expensePlaceholder: "Mic, editing software, hosting…" },
    people: { hint: "Hosts, producers and editors: who can edit, and how to invite more people.", memberWord: "team member" },
    today: { hint: "What's next for the show this week." },
    countdown: { until: () => "until the next release", after: () => "all caught up" },
    attachHint: "Shows with that episode, guest or session.",
    scrapbook: { numbersTitle: () => "The show in numbers", chapterByStay: false },
    ideaCategories: [
      { id: "topic", label: "Topic", emoji: "💡" },
      { id: "interview", label: "Interview", emoji: "🎤" },
      { id: "solo", label: "Solo episode", emoji: "🎙️" },
      { id: "series", label: "Series", emoji: "📚" },
      { id: "segment", label: "Segment", emoji: "🧩" },
      { id: "bonus", label: "Bonus / special", emoji: "⭐" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
    expenseCategories: [
      { id: "equipment", label: "Equipment", emoji: "🎧" },
      { id: "software", label: "Software", emoji: "💻" },
      { id: "hosting", label: "Hosting", emoji: "📡" },
      { id: "editing", label: "Editing", emoji: "✂️" },
      { id: "guests", label: "Guests", emoji: "🎤" },
      { id: "marketing", label: "Marketing", emoji: "📣" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
  },
  household: {
    ...base("home"),
    ongoing: true,
    calendar: {
      ...base("home").calendar,
      hint: "The household calendar. Bills, chores and appointments from your lists show up automatically.",
      thing: "event",
      things: "events",
      add: "Add event",
      titlePlaceholder: "Dentist, plumber visit, date night…",
      notesPlaceholder: "Address, who's going, what to bring…",
      unscheduledTitle: "Needs a date",
      drop: "Drop events here",
      noDates: "",
      empty: "Nothing on the calendar yet",
    },
    ideas: {
      ...base("home").ideas,
      hint: "Projects, purchases and wishes for the home. Vote, then plan the winners.",
      thing: "project",
      add: "Add project or wish",
      empty: "No projects or wishes yet",
      emptyHint: "Repairs, things to buy, recipes to try, places to go together.",
      titlePlaceholder: "Paint the bedroom, new couch, try a recipe…",
      notesPlaceholder: "Links, measurements, who wants it…",
      schedule: "Put it on the calendar",
      costLabel: "Rough cost",
    },
    checklists: {
      hint: "Shared lists for the household (groceries, errands), and a private one just for you.",
      groupPlaceholder: "Add to the shared list…",
      minePlaceholder: "Add to your list…",
      whoBrings: "Who's getting it",
      suggestions: {
        Groceries: ["Milk", "Eggs", "Bread", "Coffee", "Fruit", "Vegetables"],
        Household: ["Paper towels", "Dish soap", "Laundry detergent", "Trash bags"],
        Errands: ["Post office", "Pharmacy pickup", "Dry cleaning"],
      },
    },
    photos: { hint: "Home photos, receipts, manuals and memories, sorted by day and person.", empty: "Add photos of the home, receipts, manuals and memories.", byLinked: "By what it's for" },
    budget: { ...base("home").budget, hint: "Bills and spending for the household, who paid, and who owes what.", expensePlaceholder: "Groceries, utilities…" },
    people: { hint: "Everyone in the household: who can edit, and how to invite more people.", memberWord: "household member" },
    today: { hint: "What's due and whose turn it is." },
    countdown: { until: () => "until the next thing", after: () => "all caught up" },
    ideaCategories: [
      { id: "project", label: "Project", emoji: "🔨" },
      { id: "repair", label: "Repair", emoji: "🧰" },
      { id: "purchase", label: "Purchase", emoji: "🛒" },
      { id: "recipe", label: "Recipe", emoji: "🍲" },
      { id: "outing", label: "Outing", emoji: "🚗" },
      { id: "garden", label: "Garden", emoji: "🌱" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
    expenseCategories: [
      { id: "rent", label: "Rent / mortgage", emoji: "🏠" },
      { id: "utilities", label: "Utilities", emoji: "💡" },
      { id: "groceries", label: "Groceries", emoji: "🛒" },
      { id: "subscriptions", label: "Subscriptions", emoji: "📺" },
      { id: "repairs", label: "Repairs", emoji: "🧰" },
      { id: "transport", label: "Transport", emoji: "🚗" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
  },
  event: {
    ...base("event"),
    calendar: {
      ...base("event").calendar,
      hint: "Setup, the run of show and everything leading up to the day.",
      thing: "item",
      add: "Add to schedule",
      titlePlaceholder: "Pick up the cake, doors open, speeches…",
      unscheduledTitle: "Needs a time",
      drop: "Drop items here",
      noDates: "Add the event date in settings for a countdown, or just add things with any date.",
    },
    ideas: {
      ...base("event").ideas,
      hint: "Ideas for the event from everyone: theme, food, games, music. Vote, then plan the winners.",
      emptyHint: "Themes, food, games, music, decorations…",
      titlePlaceholder: "A photo booth, a taco bar, a playlist…",
      schedule: "Add to schedule",
    },
    checklists: {
      hint: "Shared to-dos for the hosts and helpers, and a private list just for you.",
      groupPlaceholder: "Add a to-do…",
      minePlaceholder: "Add to your list…",
      whoBrings: "Who's handling it",
      suggestions: {
        Planning: ["Set the budget", "Guest list", "Book the venue", "Send invitations"],
        Supplies: ["Plates & cups", "Decorations", "Ice", "Trash bags"],
        "Day of": ["Set up", "Music playing", "Take photos", "Clean up"],
      },
    },
    photos: { hint: "Inspiration and photos from the day, sorted by day and person.", empty: "Add inspiration now and photos on the day.", byLinked: "By what it's for" },
    today: { hint: "What needs doing next for the event." },
    ideaCategories: [
      { id: "theme", label: "Theme", emoji: "🎨" },
      { id: "food", label: "Food & drink", emoji: "🍽️" },
      { id: "games", label: "Games & activities", emoji: "🎲" },
      { id: "music", label: "Music", emoji: "🎶" },
      { id: "decor", label: "Decor", emoji: "🎈" },
      { id: "gifts", label: "Gifts & favors", emoji: "🎁" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
    expenseCategories: [
      { id: "venue", label: "Venue", emoji: "🏛️" },
      { id: "food", label: "Food & drink", emoji: "🍽️" },
      { id: "decor", label: "Decor", emoji: "🎈" },
      { id: "entertainment", label: "Entertainment", emoji: "🎶" },
      { id: "supplies", label: "Supplies", emoji: "📦" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
  },
  blank: {
    ...base("space"),
    ongoing: true,
    ideaCategories: [
      { id: "idea", label: "Idea", emoji: "💡" },
      { id: "task", label: "Task", emoji: "✅" },
      { id: "purchase", label: "Purchase", emoji: "🛒" },
      { id: "event", label: "Event", emoji: "📅" },
      { id: "other", label: "Other", emoji: "✨" },
    ],
    expenseCategories: GENERIC_EXPENSES,
  },
};

export const voiceFor = (kind: string | null | undefined): Voice => VOICES[kind ?? "trip"] ?? VOICES.blank;

/** Every category any space uses, so old data still shows its emoji and name. */
const ALL_IDEA_CATEGORIES: Category[] = Object.values(VOICES).flatMap((v) => v.ideaCategories);
const ALL_EXPENSE_CATEGORIES: Category[] = Object.values(VOICES).flatMap((v) => v.expenseCategories);
export const anyCategory = (id: string | null | undefined): Category =>
  ALL_IDEA_CATEGORIES.find((c) => c.id === id) ?? { id: "other", label: "Other", emoji: "✨" };
export const anyExpenseCategory = (id: string | null | undefined): Category =>
  ALL_EXPENSE_CATEGORIES.find((c) => c.id === id) ?? { id: "other", label: "Other", emoji: "✨" };
