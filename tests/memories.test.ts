import { describe, expect, it } from "vitest";
import { canSee, groupPhotos, matchPlan, photoDay, visibilityLabel, withHouseholds } from "@/lib/memories";
import type { ItineraryItem, Photo } from "@/lib/types";

const plan = (p: Partial<ItineraryItem>): ItineraryItem => ({ id: Math.random().toString(36), trip_id: "t", title: "", day: null, start_time: null, end_time: null, category: "activity", location: {}, url: null, notes: "", sort_order: 0, participants: [], cost: null, created_by: null, created_at: "", updated_at: "", ...p } as unknown as ItineraryItem);
const photo = (p: Partial<Photo>): Photo => ({ id: Math.random().toString(36), trip_id: "t", storage_path: "x", caption: "", taken_on: null, width: null, height: null, favorite: false, created_by: "ash", created_at: "2027-10-21T12:00:00", ...p });
// Local-time ISO strings (no Z) so the test doesn't depend on the machine's time zone.
const local = (d: string) => new Date(d).toISOString();

describe("visibility", () => {
  it("matches the database rule", () => {
    expect(canSee({ created_by: "ash", visibility: "everyone" }, "dan")).toBe(true);
    expect(canSee({ created_by: "ash", visibility: "private" }, "dan")).toBe(false);
    expect(canSee({ created_by: "ash", visibility: "private" }, "ash")).toBe(true);
    expect(canSee({ created_by: "ash", visibility: "people", visible_to: ["dan"] }, "dan")).toBe(true);
    expect(canSee({ created_by: "ash", visibility: "people", visible_to: ["dan"] }, "liz")).toBe(false);
  });
  it("describes it", () => {
    const n = (id: string) => ({ ash: "Ash P", dan: "Daniel P", liz: "Lizza T" })[id] ?? "?";
    expect(visibilityLabel({ created_by: "ash", visibility: "people", visible_to: ["dan"] }, n, "ash")).toBe("You and Daniel");
    expect(visibilityLabel({ created_by: "ash", visibility: "private" }, n, "ash")).toBe("Only you");
  });
  it("adds partners from a household", () => {
    const h = (id: string) => (id === "ash" || id === "dan" ? "h1" : null);
    expect(withHouseholds(["dan"], h, ["ash", "dan", "liz"]).sort()).toEqual(["ash", "dan"]);
  });
});

describe("photos", () => {
  const museum = plan({ title: "Witch Museum", day: "2027-10-21", start_time: "10:00:00", end_time: "11:30:00", location: { lat: 42.5231, lng: -70.8907 } as never });
  const dinner = plan({ title: "Dinner", day: "2027-10-21", start_time: "19:00:00", location: { lat: 42.52, lng: -70.89 } as never });
  it("matches a photo to the plan it was taken at", () => {
    expect(matchPlan(photo({ taken_at: local("2027-10-21T10:40:00") }), [museum, dinner])?.title).toBe("Witch Museum");
    expect(matchPlan(photo({ taken_at: local("2027-10-21T20:10:00") }), [museum, dinner])?.title).toBe("Dinner");
    // Off-schedule but standing right there still counts.
    expect(matchPlan(photo({ taken_at: local("2027-10-21T15:00:00"), lat: 42.5232, lng: -70.8908 }), [museum, dinner])?.title).toBe("Witch Museum");
    expect(matchPlan(photo({ taken_at: local("2027-10-21T15:00:00") }), [museum, dinner])).toBeNull();
  });
  it("groups by day, plan and person", () => {
    const ps = [
      photo({ taken_at: local("2027-10-21T10:40:00") }),
      photo({ taken_at: local("2027-10-21T20:10:00"), created_by: "dan" }),
      photo({ taken_on: "2027-10-22", created_by: "dan" }),
    ];
    const ctx = { rows: { itinerary_items: [museum, dinner], flights: [], stays: [], ideas: [], list_items: [] }, nameOf: (id: string) => id, stayForDay: () => null };
    expect(groupPhotos(ps, "day", ctx).map((g) => [g.key, g.photos.length])).toEqual([["2027-10-21", 2], ["2027-10-22", 1]]);
    expect(groupPhotos(ps, "plan", ctx).map((g) => g.title)).toEqual(["Witch Museum", "Dinner", "Everything else"]);
    expect(groupPhotos(ps, "person", ctx).map((g) => [g.title, g.photos.length])).toEqual([["ash", 1], ["dan", 2]]);
    expect(photoDay(ps[2])).toBe("2027-10-22");
  });
});
