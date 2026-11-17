// Ready-made pages: a starting structure you can type straight into.
import { newBlock, type DocBlock } from "./pages";

export interface PageTemplate {
  key: string;
  name: string;
  icon: string;
  description: string;
  blocks: () => DocBlock[];
}

const t = (text: string) => newBlock("text", { text });
const h = (n: 1 | 2 | 3, text: string) => newBlock(`h${n}` as DocBlock["type"], { text });
const todo = (text: string) => newBlock("todo", { text });
const bullet = (text: string) => newBlock("bullet", { text });

export const PAGE_TEMPLATES: PageTemplate[] = [
  { key: "blank", name: "Blank page", icon: "📄", description: "Start from nothing", blocks: () => [newBlock("text")] },
  {
    key: "meeting",
    name: "Meeting notes",
    icon: "🗒️",
    description: "Agenda, notes and action items that land on people's plates",
    blocks: () => [
      newBlock("callout", { emoji: "📅", text: "Date, who's here, and what this is about" }),
      h(2, "Agenda"),
      bullet(""),
      h(2, "Notes"),
      t(""),
      h(2, "Action items"),
      todo(""),
    ],
  },
  {
    key: "runofshow",
    name: "Run of show",
    icon: "⏱️",
    description: "A minute-by-minute plan for the big day",
    blocks: () => [
      t("Who's in charge of what, and when. Give each to-do a date and a person so it shows up on their Today."),
      h(2, "Before"),
      todo(""),
      h(2, "The day"),
      newBlock("numbered", { text: "" }),
      h(2, "After"),
      todo(""),
      newBlock("widget", { widget: "countdown" }),
    ],
  },
  {
    key: "outline",
    name: "Episode outline",
    icon: "🎙️",
    description: "Hook, segments, talking points and show notes",
    blocks: () => [
      h(2, "Hook"),
      t(""),
      h(2, "Segments"),
      newBlock("numbered", { text: "" }),
      h(2, "Talking points"),
      bullet(""),
      newBlock("toggle", { text: "Show notes & links", body: "" }),
      h(2, "Before we record"),
      todo(""),
    ],
  },
  {
    key: "journal",
    name: "Journal entry",
    icon: "📔",
    description: "What happened, highlights and a photo",
    blocks: () => [h(2, "Today"), t(""), h(3, "Highlights"), bullet(""), newBlock("image"), newBlock("quote", { text: "" })],
  },
  {
    key: "guide",
    name: "Guide or house rules",
    icon: "🏡",
    description: "Wi-Fi, how-tos, who to call",
    blocks: () => [
      newBlock("callout", { emoji: "📶", text: "Wi-Fi: **network** · password **…**" }),
      h(2, "How things work"),
      newBlock("toggle", { text: "Heating / AC", body: "" }),
      newBlock("toggle", { text: "Trash & recycling", body: "" }),
      h(2, "Who to call"),
      bullet(""),
    ],
  },
  {
    key: "decision",
    name: "Decision",
    icon: "⚖️",
    description: "Options, pros and cons, and what you picked",
    blocks: () => [
      h(2, "What we're deciding"),
      t(""),
      h(2, "Options"),
      newBlock("toggle", { text: "Option A", body: "Pros:\nCons:" }),
      newBlock("toggle", { text: "Option B", body: "Pros:\nCons:" }),
      h(2, "We picked"),
      newBlock("callout", { emoji: "✅", text: "" }),
    ],
  },
];
