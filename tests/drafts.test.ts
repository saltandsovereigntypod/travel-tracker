import { describe, expect, it } from "vitest";
import { draftsOn, finalOnly, hasMajority, itemsInVersion, likesToLock, summarizeDay, tallyPlan, tallyVersions, versionLetter, versionsOn } from "@/lib/drafts";
import type { ItineraryItem, PlanVote } from "@/lib/types";

const item = (p: Partial<ItineraryItem>): ItineraryItem => ({
  id: "x", trip_id: "t", day: "2027-03-11", start_time: null, end_time: null, title: "Plan", notes: "", category: "activity",
  location: {}, url: null, cost: null, idea_id: null, participants: [], sort_order: 0, created_by: null, created_at: "", updated_at: "",
  cost_unit: "group", cost_unit_size: null, cost_qty: null, cost_unit_label: "", ...p,
});

describe("votes on pencilled-in plans", () => {
  const votes: PlanVote[] = [
    { item_id: "a", trip_id: "t", user_id: "me", value: 1 },
    { item_id: "a", trip_id: "t", user_id: "sam", value: 1 },
    { item_id: "a", trip_id: "t", user_id: "viewer", value: 1 },
    { item_id: "a", trip_id: "t", user_id: "lee", value: -1 },
    { item_id: "b", trip_id: "t", user_id: "me", value: -1 },
  ];
  it("tallies likes, dislikes and your own vote", () => {
    const t = tallyPlan(votes, "a", "me", ["me", "sam", "lee", "jo"]);
    expect(t).toMatchObject({ up: 3, down: 1, mine: 1, upFromGoing: 2 });
    expect(tallyPlan(votes, "b", "me", []).mine).toBe(-1);
    expect(tallyPlan(votes, "c", "me", []).mine).toBe(0);
  });
  it("locks in on a real majority of people going", () => {
    expect(hasMajority(2, 4)).toBe(false); // half isn't most
    expect(hasMajority(3, 4)).toBe(true);
    expect(hasMajority(2, 3)).toBe(true);
    expect(hasMajority(1, 1)).toBe(false); // on your own, you lock it in yourself
    expect(likesToLock(2, 4)).toBe(1);
    expect(likesToLock(0, 5)).toBe(3);
    expect(likesToLock(0, 1)).toBeNull();
  });
});

describe("how a day is shaping up", () => {
  it("adds up time, cost, distance and clashes", () => {
    const day = [
      item({ id: "1", start_time: "09:00:00", end_time: "11:00:00", location: { lat: 0, lng: 0 }, draft: true }),
      item({ id: "2", start_time: "10:30:00", end_time: "12:00:00", location: { lat: 0, lng: 0.1 } }),
      item({ id: "3", location: { name: "No pin" } }),
    ];
    const s = summarizeDay(day, (i) => (i.id === "1" ? 50 : i.id === "2" ? 25 : null));
    expect(s).toMatchObject({ plans: 3, drafts: 1, minutes: 210, cost: 75, clashes: 1 });
    expect(Math.round(s.km)).toBe(11);
  });
  it("separates drafts from what's set", () => {
    const all = [item({ id: "1", draft: true }), item({ id: "2", draft: true, day: "2027-03-12" }), item({ id: "3" })];
    expect(draftsOn(all).map((i) => i.id)).toEqual(["1", "2"]);
    expect(draftsOn(all, "2027-03-12").map((i) => i.id)).toEqual(["2"]);
    expect(finalOnly(all).map((i) => i.id)).toEqual(["3"]);
  });
});

describe("versions of a day", () => {
  const v = (id: string, sort_order: number, day = "2027-03-11") => ({ id, trip_id: "t", day, name: id, sort_order, created_by: null, created_at: "" });
  const versions = [v("B", 1), v("A", 0), v("X", 0, "2027-03-12")];
  it("orders a day's versions and letters them", () => {
    expect(versionsOn(versions, "2027-03-11").map((x) => x.id)).toEqual(["A", "B"]);
    expect(versionsOn(versions, null)).toEqual([]);
    expect([0, 1, 25, 26].map(versionLetter)).toEqual(["A", "B", "Z", "27"]);
  });
  it("shows locked-in plans in every version, and each version's own drafts", () => {
    const day = versionsOn(versions, "2027-03-11");
    const items = [
      item({ id: "set" }),
      item({ id: "loose", draft: true }),
      item({ id: "a", draft: true, version_id: "A" }),
      item({ id: "b", draft: true, version_id: "B" }),
      item({ id: "gone", draft: true, version_id: "deleted" }),
    ];
    expect(itemsInVersion(items, day, "A").map((i) => i.id)).toEqual(["set", "loose", "a", "gone"]);
    expect(itemsInVersion(items, day, "B").map((i) => i.id)).toEqual(["set", "b"]);
    expect(itemsInVersion(items, [], "A")).toHaveLength(5);
  });
  it("counts one vote per person and finds a majority winner", () => {
    const votes = [
      { trip_id: "t", day: "2027-03-11", user_id: "me", version_id: "B" },
      { trip_id: "t", day: "2027-03-11", user_id: "sam", version_id: "B" },
      { trip_id: "t", day: "2027-03-11", user_id: "lee", version_id: "A" },
      { trip_id: "t", day: "2027-03-12", user_id: "me", version_id: "X" },
    ];
    expect(tallyVersions(votes, "2027-03-11", "me", ["me", "sam", "lee"])).toEqual({ counts: { B: 2, A: 1 }, mine: "B", winner: "B" });
    expect(tallyVersions(votes, "2027-03-11", "jo", ["me", "sam", "lee", "jo"]).winner).toBeNull();
  });
});
