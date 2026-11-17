import { describe, expect, it } from "vitest";
import { buildChapters, collage, tripNumbers, withDefaults } from "@/lib/scrapbook";
import type { ItineraryItem, Note, Photo, Stay } from "@/lib/types";

const plan = (title: string, day: string, start = "10:00:00"): ItineraryItem => ({ id: title, trip_id: "t", title, day, start_time: start, end_time: null, category: "activity", location: { name: title }, url: null, notes: "", sort_order: 0, participants: [], cost: null, created_by: null, created_at: "", updated_at: "" } as unknown as ItineraryItem);
const note = (p: Partial<Note>): Note => ({ id: Math.random().toString(36), trip_id: "t", title: "", body: "hello", kind: "journal", entry_date: null, is_private: false, pinned: false, created_by: "ash", created_at: "", updated_at: "", visibility: "everyone", ...p });
const photo = (p: Partial<Photo>): Photo => ({ id: Math.random().toString(36), trip_id: "t", storage_path: "x", caption: "", taken_on: null, width: null, height: null, favorite: false, created_by: "ash", created_at: "2027-10-21T12:00:00Z", ...p });
const stay = (name: string, ci: string, co: string): Stay => ({ id: name, name, status: "booked", check_in: ci, check_out: co } as unknown as Stay);

const src = {
  start: "2027-10-20",
  end: "2027-10-23",
  plans: [plan("Witch Museum", "2027-10-21"), plan("Gables", "2027-10-22"), plan("Boston", "2027-10-23")],
  stays: [stay("Hawthorne", "2027-10-20", "2027-10-23"), stay("Back Bay", "2027-10-23", "2027-10-25")],
  notes: [
    note({ entry_date: "2027-10-21", body: "Spooky!" }),
    note({ entry_date: "2027-10-22", body: "Secret", visibility: "private" }),
    note({ kind: "note", title: "Museum tips", linked_type: "itinerary", linked_id: "Witch Museum" }),
  ],
  photos: [photo({ taken_on: "2027-10-21" }), photo({ taken_on: "2027-10-21", favorite: true }), photo({ taken_on: "2027-10-22" })],
};

describe("scrapbook chapters", () => {
  it("builds a chapter per day with only what everyone can see", () => {
    const ch = buildChapters(src, {});
    expect(ch.map((c) => [c.kicker, c.title])).toEqual([["Day 2", "2027-10-21"], ["Day 3", "2027-10-22"], ["Day 4", "2027-10-23"]]);
    expect(ch[0].journal.map((j) => j.body)).toEqual(["Spooky!"]);
    expect(ch[0].notes.map((n) => n.title)).toEqual(["Museum tips"]);
    expect(ch[0].photos).toHaveLength(2);
    expect(ch[1].journal).toHaveLength(0); // private entry left out by default
    expect(buildChapters(src, { include: { privateToo: true } })[1].journal).toHaveLength(1);
  });
  it("builds a chapter per stay", () => {
    const ch = buildChapters(src, { chapters: "stay" });
    expect(ch.map((c) => c.title)).toEqual(["Hawthorne", "Back Bay"]);
    expect(ch[0].plans.map((p) => p.title)).toEqual(["Witch Museum", "Gables"]);
    expect(ch[0].sub).toBe("3 nights");
  });
  it("respects hidden items, favorites only and the photo cap", () => {
    const hid = src.photos[0].id;
    expect(buildChapters(src, { hidden: [hid] })[0].photos.map((p) => p.id)).not.toContain(hid);
    expect(buildChapters(src, { favoritesOnly: true })[0].photos).toHaveLength(1);
    const many = { ...src, photos: Array.from({ length: 10 }, (_, i) => photo({ taken_on: "2027-10-21", favorite: i === 9 })) };
    const capped = buildChapters(many, { photosPerChapter: 4 })[0].photos;
    expect(capped).toHaveLength(4);
    expect(capped.some((p) => p.favorite)).toBe(true);
  });
  it("lays out photos and counts the trip", () => {
    expect([0, 1, 2, 3, 4, 7].map(collage)).toEqual(["none", "hero", "duo", "trio", "quad", "mosaic"]);
    const n = tripNumbers({ ...src, flights: [{ status: "booked", from_code: "LAX", to_code: "BOS", travelers: [] } as never] }, (c) => (c === "LAX" ? { lat: 33.94, lng: -118.41 } : { lat: 42.36, lng: -71.01 }));
    expect(n).toMatchObject({ days: 4, nights: 5, plans: 3, photos: 3, entries: 2, places: 3 });
    expect(n.milesFlown).toBeGreaterThan(2550);
    expect(withDefaults(undefined).style).toBe("keepsake");
  });
});
