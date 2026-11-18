import { anyCategory, anyExpenseCategory } from "./voice";

export const CATEGORIES: { id: string; label: string; emoji: string }[] = [
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

// Any space's categories resolve (a podcast's "Interview", a wedding's "Venue"…).
export const categoryOf = (id: string | null | undefined) => CATEGORIES.find((c) => c.id === id) ?? anyCategory(id);

export const EXPENSE_CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: "flights", label: "Flights", emoji: "✈️" },
  { id: "lodging", label: "Lodging", emoji: "🏨" },
  { id: "food", label: "Food & drink", emoji: "🍽️" },
  { id: "activities", label: "Activities", emoji: "🎟️" },
  { id: "transport", label: "Transport", emoji: "🚕" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "other", label: "Other", emoji: "✨" },
];

export const expenseCategoryOf = (id: string | null | undefined) => EXPENSE_CATEGORIES.find((c) => c.id === id) ?? anyExpenseCategory(id);

export const STAY_KINDS: { id: string; label: string; emoji: string }[] = [
  { id: "hotel", label: "Hotel", emoji: "🏨" },
  { id: "hostel", label: "Hostel", emoji: "🛏️" },
  { id: "rental", label: "Rental / Airbnb", emoji: "🏡" },
  { id: "bnb", label: "B&B / Inn", emoji: "🫖" },
  { id: "friends", label: "With friends", emoji: "🫶" },
  { id: "camping", label: "Camping", emoji: "⛺" },
  { id: "other", label: "Other", emoji: "📍" },
];

export const stayKindOf = (id: string | null | undefined) => STAY_KINDS.find((k) => k.id === id) ?? STAY_KINDS[STAY_KINDS.length - 1];

export const PACKING_SUGGESTIONS: Record<string, string[]> = {
  Essentials: ["ID / passport", "Phone charger", "Wallet & cards", "Medications", "Headphones"],
  Clothes: ["Warm jacket", "Comfortable walking shoes", "Layers", "Rain jacket", "Pajamas"],
  Toiletries: ["Toothbrush", "Skincare", "Hairbrush", "Deodorant"],
  "Halloween 🎃": ["Costume", "Face paint", "Fake blood", "Candy bag", "Flashlight for ghost tours"],
  Tech: ["Camera", "Power bank", "Travel adapter"],
};
