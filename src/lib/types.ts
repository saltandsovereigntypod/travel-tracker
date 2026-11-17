// Row shapes for Driftbook's Supabase tables. Kept in sync with supabase/migrations.

export type Role = "owner" | "editor" | "viewer";
export type Attendance = "going" | "maybe" | "not_going";
export type BookingStatus = "idea" | "booked" | "cancelled";

export interface Place {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export type CostUnit = "person" | "pair" | "people" | "group" | "night" | "hour" | "car" | "room" | "custom";

/** Price plus what it's "per". Shared by ideas, plans, flights and stays. */
export interface CostFields {
  cost_unit: CostUnit;
  cost_unit_size: number | null;
  cost_qty: number | null;
  cost_unit_label: string;
}

export type SplitMode = "equal" | "shares" | "exact";
export type LinkedType = "itinerary" | "flight" | "stay" | "list_item";

export interface Household {
  id: string;
  name: string;
  created_by: string | null;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  status: "pending" | "accepted";
  invited_by: string | null;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  budget: number;
  cover_image: string | null;
  lat: number | null;
  lng: number | null;
  share_token: string | null;
  /** Space kind (trip, wedding, podcast…). See lib/spaces.ts. */
  kind: string;
  icon: string;
  /** Enabled modules in nav order; empty = template defaults. */
  modules: { id: string; label?: string }[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  trip_id: string;
  user_id: string;
  role: Role;
  attendance: Attendance;
  color: string;
  joined_at: string;
}

export interface Invite {
  id: string;
  trip_id: string;
  token: string;
  role: "editor" | "viewer";
  label: string;
  created_by: string | null;
  expires_at: string;
  revoked: boolean;
  uses: number;
  created_at: string;
}

export type IdeaStatus = "open" | "planned" | "maybe" | "passed";

export interface Idea extends CostFields {
  id: string;
  trip_id: string;
  title: string;
  description: string;
  url: string | null;
  image_url: string | null;
  category: string;
  est_cost: number | null;
  location: Place;
  status: IdeaStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  idea_id: string;
  trip_id: string;
  user_id: string;
  value: 1 | -1;
}

export interface ItineraryItem extends CostFields {
  id: string;
  trip_id: string;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  title: string;
  notes: string;
  category: string;
  location: Place;
  url: string | null;
  cost: number | null;
  idea_id: string | null;
  participants: string[];
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Flight extends CostFields {
  id: string;
  trip_id: string;
  airline: string;
  flight_number: string;
  from_code: string;
  from_name: string;
  to_code: string;
  to_name: string;
  depart_local: string | null;
  arrive_local: string | null;
  confirmation: string;
  seats: string;
  status: BookingStatus;
  travelers: string[];
  cost: number | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type StayKind = "hotel" | "hostel" | "rental" | "bnb" | "friends" | "camping" | "other";

export interface Stay extends CostFields {
  id: string;
  trip_id: string;
  name: string;
  kind: StayKind;
  address: string;
  location: Place;
  check_in: string | null;
  check_out: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  confirmation: string;
  url: string | null;
  phone: string;
  status: BookingStatus;
  guests: string[];
  cost: number | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  title: string;
  amount: number;
  currency: string;
  amount_home: number | null;
  category: string;
  paid_by: string | null;
  split_between: string[];
  split_mode: SplitMode;
  split_shares: Record<string, number>;
  linked_type: LinkedType | null;
  linked_id: string | null;
  is_deposit: boolean;
  spent_on: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackingItem {
  id: string;
  trip_id: string;
  title: string;
  category: string;
  owner_id: string | null;
  assigned_to: string | null;
  quantity: number;
  packed: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  trip_id: string;
  title: string;
  body: string;
  kind: "note" | "journal";
  entry_date: string | null;
  is_private: boolean;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  trip_id: string;
  storage_path: string;
  caption: string;
  taken_on: string | null;
  width: number | null;
  height: number | null;
  favorite: boolean;
  created_by: string | null;
  created_at: string;
}

export type CommentEntity = "idea" | "itinerary" | "flight" | "stay" | "expense" | "note" | "photo" | "list_item";

export interface Comment {
  id: string;
  trip_id: string;
  entity_type: CommentEntity;
  entity_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

export interface TripView {
  id: string;
  trip_id: string;
  user_id: string;
  mode: "page" | "board";
  theme: Partial<Theme>;
  page_layout: PageBlock[];
  board_layout: BoardBlock[];
  /** Per-list view choices, private to this person. Keyed by list id. */
  list_prefs?: Record<string, ListPrefs>;
  updated_at: string;
}

export type ListViewType = "table" | "cards" | "board" | "calendar" | "map" | "checklist";

export interface ListPrefs {
  view?: ListViewType;
  /** Board: field to make columns from. */
  groupBy?: string;
  /** Calendar: which date field to use. */
  dateField?: string;
  /** Map: which place field. */
  placeField?: string;
  sort?: { field: string; dir: "asc" | "desc" };
  /** Show only items assigned to me. */
  mine?: boolean;
  hideDone?: boolean;
}

export interface Template {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  theme: Partial<Theme>;
  page_layout: PageBlock[];
  board_layout: BoardBlock[];
  is_public: boolean;
  created_at: string;
}

export interface UserAsset {
  id: string;
  user_id: string;
  storage_path: string;
  name: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Personal design layer
// ---------------------------------------------------------------------------

export type CardStyle = "soft" | "flat" | "outlined" | "paper" | "glass";

export interface Theme {
  preset: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  border: string;
  headingFont: string;
  bodyFont: string;
  radius: number;
  cardStyle: CardStyle;
  background: { kind: "color" | "gradient" | "image" | "texture"; value: string };
  /** Personal cover image for the trip header (only you see it). */
  cover?: string;
}

export type BlockType =
  | "hero"
  | "countdown"
  | "today"
  | "ideas"
  | "itinerary"
  | "flights"
  | "stays"
  | "budget"
  | "packing"
  | "notes"
  | "photos"
  | "map"
  | "people"
  | "heading"
  | "text"
  | "image"
  | "sticker"
  | "divider"
  | "quote"
  | "links";

export type BlockWidth = "full" | "two-thirds" | "half" | "third";

export interface BlockStyle {
  title?: string;
  hideTitle?: boolean;
  bg?: string;
  ink?: string;
  accent?: string;
  cardStyle?: CardStyle | "none";
  font?: string;
  align?: "left" | "center" | "right";
  size?: "s" | "m" | "l" | "xl";
}

export interface BlockProps {
  text?: string;
  src?: string;
  sticker?: string;
  links?: { label: string; url: string }[];
  limit?: number;
  filter?: string;
}

export interface PageBlock {
  id: string;
  type: BlockType;
  width: BlockWidth;
  props?: BlockProps;
  style?: BlockStyle;
}

export interface BoardBlock {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  rotate?: number;
  props?: BlockProps;
  style?: BlockStyle;
}
