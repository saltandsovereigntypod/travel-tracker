import { describe, expect, it } from "vitest";
import { centroid, distanceKm, estimateTravel, formatDistance, searchAirports, type Airport } from "@/lib/geo";
import { stayPeriods, arrivalAirportFor, departureAirportFor, estimatedFromOptions, flightOptionKey, optionGroups, rankStays, stayForDay, stayForNight, staySearchLinks, stayOptionKey, sweetSpot } from "@/lib/travel";
import type { Flight, Stay } from "@/lib/types";

const BOS = { lat: 42.362, lng: -71.0079 };
const SALEM = { lat: 42.5195, lng: -70.8967 };

const flight = (p: Partial<Flight>): Flight => ({
  id: Math.random().toString(36), trip_id: "t", airline: "", flight_number: "", from_code: "LAX", from_name: "", to_code: "BOS", to_name: "",
  depart_local: null, arrive_local: null, confirmation: "", seats: "", status: "idea", travelers: [], cost: null, notes: "",
  created_by: null, created_at: "", updated_at: "", cost_unit: "person", cost_unit_size: null, cost_qty: null, cost_unit_label: null, ...p,
} as Flight);
const stay = (p: Partial<Stay>): Stay => ({
  id: Math.random().toString(36), trip_id: "t", name: "", kind: "hotel", address: "", location: {} as Stay["location"], check_in: null, check_out: null,
  check_in_time: null, check_out_time: null, confirmation: "", url: null, phone: "", status: "idea", guests: [], cost: null, notes: "",
  created_by: null, created_at: "", updated_at: "", cost_unit: "night", cost_unit_size: null, cost_qty: null, cost_unit_label: null, ...p,
} as Stay);

describe("geo", () => {
  it("measures and labels distances", () => {
    const km = distanceKm(BOS, SALEM);
    expect(km).toBeGreaterThan(18);
    expect(km).toBeLessThan(21);
    expect(formatDistance(km, true)).toBe("12 mi");
    expect(formatDistance(0.5, false)).toBe("500 m");
    expect(estimateTravel(0.8).mode).toBe("walk");
    expect(estimateTravel(20).mode).toBe("drive");
  });
  it("finds the middle", () => {
    const c = centroid([{ lat: 0, lng: 0 }, { lat: 0, lng: 2 }])!;
    expect(c.lat).toBeCloseTo(0);
    expect(c.lng).toBeCloseTo(1);
  });
  it("searches airports by code or city", () => {
    const all = new Map<string, Airport>([
      ["BOS", { code: "BOS", name: "Boston Logan International Airport", city: "Boston", country: "US", ...BOS }],
      ["MHT", { code: "MHT", name: "Manchester-Boston Regional Airport", city: "Manchester", country: "US", lat: 42.93, lng: -71.43 }],
    ]);
    expect(searchAirports(all, "bos")[0].code).toBe("BOS");
    expect(searchAirports(all, "boston").map((a) => a.code)).toEqual(["BOS", "MHT"]);
  });
});

describe("options", () => {
  it("groups flights by route and estimates the cheapest per group", () => {
    const fl = [
      flight({ id: "a", cost: 420 }),
      flight({ id: "b", cost: 380 }),
      flight({ id: "c", from_code: "BOS", to_code: "LAX", cost: 300 }),
      flight({ id: "d", from_code: "BOS", to_code: "LAX", status: "booked", cost: 350 }),
      flight({ id: "e", option_group: "Lizza", from_code: "JFK", cost: 200 }),
    ];
    const groups = optionGroups(fl, flightOptionKey, (f) => f.cost);
    expect(groups.map((g) => g.key).sort()).toEqual(["BOS → LAX", "LAX → BOS", "Lizza"]);
    const out = groups.find((g) => g.key === "LAX → BOS")!;
    expect(out.cheapest!.id).toBe("b");
    // BOS→LAX already has a booked flight, so its option doesn't add to the estimate.
    expect(estimatedFromOptions(groups)).toBe(380 + 200);
  });
  it("groups stays by dates", () => {
    expect(stayOptionKey(stay({ check_in: "2027-10-20", check_out: "2027-10-27" }))).toBe("2027-10-20 → 2027-10-27");
    expect(stayOptionKey(stay({ option_group: "Week 1" }))).toBe("Week 1");
  });
});

describe("nights and airports", () => {
  const s1 = stay({ id: "s1", status: "booked", check_in: "2027-10-20", check_out: "2027-10-27" });
  const s2 = stay({ id: "s2", status: "idea", check_in: "2027-10-27", check_out: "2027-11-02" });
  it("knows where you sleep", () => {
    expect(stayForNight([s1, s2], "2027-10-26")!.id).toBe("s1");
    expect(stayForNight([s1, s2], "2027-10-27")!.id).toBe("s2");
    expect(stayForNight([s1, s2], "2027-11-02")).toBeNull();
    expect(stayForDay([s1, s2], "2027-11-02")!.id).toBe("s2");
  });
  it("pairs stays with airports", () => {
    const fl = [
      flight({ to_code: "BOS", arrive_local: "2027-10-20T14:05", status: "booked" }),
      flight({ from_code: "BOS", to_code: "LAX", depart_local: "2027-11-02T09:00" }),
    ];
    expect(arrivalAirportFor(fl, s1)).toBe("BOS");
    expect(departureAirportFor(fl, s2)).toBe("BOS");
    expect(arrivalAirportFor([flight({ to_code: "PSM" })], stay({}))).toBe("PSM");
  });
});

describe("where to stay", () => {
  const plans = [
    { ...SALEM, day: "2027-10-21", weight: 1, title: "Witch Museum" },
    { lat: 42.5215, lng: -70.8875, day: "2027-10-22", weight: 1, title: "House of Seven Gables" },
    { lat: 42.5229, lng: -70.8953, day: "2027-10-23", weight: 1, title: "Peabody Essex" },
  ];
  it("finds the sweet spot", () => {
    const s = sweetSpot(plans)!;
    expect(distanceKm(s.center, SALEM)).toBeLessThan(1);
    expect(s.radiusKm).toBeGreaterThan(0.5);
  });
  it("ignores a far-off day trip and splits by stay", () => {
    const withBoston = [...plans, { lat: 42.3551, lng: -71.0657, day: "2027-10-28", weight: 1, title: "Freedom Trail" }];
    const s = sweetSpot(withBoston)!;
    expect(s.outliers).toBe(1);
    expect(distanceKm(s.center, SALEM)).toBeLessThan(1);
    const periods = stayPeriods(
      [stay({ check_in: "2027-10-20", check_out: "2027-10-27" }), stay({ check_in: "2027-10-27", check_out: "2027-11-02", status: "booked" })],
      withBoston,
      { start: null, end: null },
    );
    expect(periods).toHaveLength(2);
    expect(distanceKm(periods[1].spot.center, { lat: 42.3551, lng: -71.0657 })).toBeLessThan(0.1);
  });
  it("ranks close and affordable stays first", () => {
    const near = stay({ id: "near", location: { ...SALEM, name: "", address: "" }, check_in: "2027-10-20", check_out: "2027-10-27" });
    const far = stay({ id: "far", location: { ...BOS, name: "", address: "" }, check_in: "2027-10-20", check_out: "2027-10-27" });
    const price: Record<string, number> = { near: 220, far: 180 };
    const ranked = rankStays([far, near], plans, (s) => price[s.id]);
    expect(ranked[0].stay.id).toBe("near");
    expect(ranked[0].best).toBe(true);
    expect(ranked[1].avgKm!).toBeGreaterThan(15);
  });
  it("builds search links for the area and dates", () => {
    const links = staySearchLinks({ center: SALEM, radiusKm: 2, checkIn: "2027-10-20", checkOut: "2027-10-27", guests: 3 });
    expect(links[0].href).toContain("checkin=2027-10-20");
    expect(links[0].href).toContain("adults=3");
    expect(links[1].href).toContain("latitude=42.51950");
  });
});

describe("grouping flights", () => {
  const fl = [
    flight({ id: "1", from_code: "LAX", to_code: "BOS", depart_local: "2027-10-20T07:00", travelers: ["ash", "dan"] }),
    flight({ id: "2", from_code: "SFO", to_code: "BOS", depart_local: "2027-10-21T07:00", travelers: ["liz"] }),
    flight({ id: "3", from_code: "BOS", to_code: "LAX", depart_local: "2027-11-02T09:00", travelers: ["ash", "dan"] }),
    flight({ id: "4", from_code: "BOS", to_code: "PHL", depart_local: "2027-10-25T09:00", travelers: [] }),
  ];
  it("splits out and return", async () => {
    const { flightLegs, groupFlights } = await import("@/lib/travel");
    expect(flightLegs(fl)).toEqual({ "1": "out", "2": "out", "3": "return", "4": "during" });
    expect(groupFlights(fl, "direction", (x) => x).map((g) => [g.title, g.flights.map((f) => f.id)])).toEqual([
      ["Flights out", ["1", "2"]],
      ["During the trip", ["4"]],
      ["Flights home", ["3"]],
    ]);
  });
  it("groups by person, a shared flight under each", async () => {
    const { groupFlights } = await import("@/lib/travel");
    expect(groupFlights(fl, "person", (x) => x.toUpperCase()).map((g) => [g.title, g.flights.map((f) => f.id)])).toEqual([
      ["ASH", ["1", "3"]],
      ["DAN", ["1", "3"]],
      ["LIZ", ["2"]],
      ["Nobody added yet", ["4"]],
    ]);
  });
});
