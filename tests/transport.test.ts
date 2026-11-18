import { describe, expect, it } from "vitest";
import { directionsThrough, dropOff, endLabel, endPoint, formatWait, journeyKm, journeyLegs, layovers, modeOf, routeText, transportTitle, viaText } from "@/lib/transport";
import { flightLegs, groupFlights } from "@/lib/travel";

const blank = { from_code: "", from_name: "", to_code: "", to_name: "", airline: "", flight_number: "" };

describe("transport modes", () => {
  it("old rows without a mode are flights", () => {
    expect(modeOf({}).id).toBe("flight");
    expect(modeOf({ mode: "train" }).label).toBe("Train");
    expect(modeOf({ mode: "nonsense" }).id).toBe("flight");
  });

  it("names each end by code, else the first part of the place", () => {
    expect(endLabel({ ...blank, from_code: "BOS", from_name: "Logan" }, "from")).toBe("BOS");
    expect(endLabel({ ...blank, from_name: "Penn Station, New York, NY" }, "from")).toBe("Penn Station");
  });

  it("titles read naturally for each mode", () => {
    expect(transportTitle({ ...blank, mode: "flight", airline: "JetBlue", flight_number: "B6 12" })).toBe("JetBlue B6 12");
    expect(transportTitle({ ...blank, mode: "train", from_name: "Penn Station", to_name: "South Station" })).toBe("Train · Penn Station → South Station");
    expect(transportTitle({ ...blank, mode: "rental", airline: "Hertz", flight_number: "SUV" })).toBe("Rental car: Hertz SUV");
    // Rideshares have no number; a stray one is ignored.
    expect(transportTitle({ ...blank, mode: "rideshare", airline: "Uber", flight_number: "x" })).toBe("Rideshare / taxi: Uber");
  });

  it("rental cars go back where they came from", () => {
    const car = { ...blank, mode: "rental", from_name: "LAX Rental Center, Los Angeles", from_lat: 33.9, from_lng: -118.4 };
    expect(dropOff(car)).toBe("LAX Rental Center");
    expect(routeText(car)).toBe("at LAX Rental Center");
    expect(endPoint(car, "to", () => null)).toEqual({ lat: 33.9, lng: -118.4 });
  });

  it("uses pins for places and the airport list for codes", () => {
    const air = (c: string) => (c === "BOS" ? { lat: 42.36, lng: -71.0 } : null);
    expect(endPoint({ ...blank, from_code: "BOS" }, "from", air)).toEqual({ lat: 42.36, lng: -71.0 });
    expect(endPoint({ ...blank, mode: "train", to_lat: 1, to_lng: 2 }, "to", air)).toEqual({ lat: 1, lng: 2 });
    expect(endPoint({ ...blank, mode: "train", to_name: "Somewhere" }, "to", air)).toBeNull();
  });

  it("rides and rental cars never count as the way there or home", () => {
    const t = (id: string, day: string, mode: string) => ({ id, status: "booked" as const, depart_local: `${day}T09:00`, travelers: ["a"], mode });
    const legs = flightLegs([t("ride", "2026-05-01", "rideshare"), t("out", "2026-05-01", "flight"), t("car", "2026-05-02", "rental"), t("home", "2026-05-08", "train")]);
    expect(legs).toEqual({ ride: "during", out: "out", car: "during", home: "return" });
  });

  it("groups by type in a fixed order", () => {
    const fl = [{ id: "1", status: "booked" as const, depart_local: null, travelers: [], mode: "rental" }, { id: "2", status: "booked" as const, depart_local: null, travelers: [], mode: "flight" }];
    expect(groupFlights(fl, "mode", (x) => x).map((g) => g.title)).toEqual(["✈️ Flight", "🚗 Rental car"]);
  });
});

describe("stops and layovers", () => {
  const air = (c: string) => ({ BOS: { lat: 42.36, lng: -71.0 }, ORD: { lat: 41.98, lng: -87.9 }, LAX: { lat: 33.94, lng: -118.4 } })[c] ?? null;
  const trip = {
    ...blank, mode: "flight", airline: "United", flight_number: "UA 100",
    from_code: "BOS", to_code: "LAX", depart_local: "2027-03-10T08:00", arrive_local: "2027-03-10T14:30",
    stops: [{ id: "s1", name: "Chicago O'Hare", code: "ORD", arrive_local: "2027-03-10T09:45", depart_local: "2027-03-10T10:20", number: "UA 200" }],
  };

  it("splits a journey into legs, keeping the carrier unless it changes", () => {
    const legs = journeyLegs(trip, air);
    expect(legs.map((l) => `${l.from.label}-${l.to.label} ${l.carrier} ${l.number}`)).toEqual(["BOS-ORD United UA 100", "ORD-LAX United UA 200"]);
    expect(Math.round(journeyKm(trip, air)!)).toBeGreaterThan(Math.round(legs[1].km!));
  });

  it("times each layover and flags tight connections", () => {
    expect(layovers(trip)).toMatchObject([{ minutes: 35, warn: "tight", overnight: false }]);
    const ok = { ...trip, stops: [{ ...trip.stops[0], depart_local: "2027-03-10T11:30" }] };
    expect(layovers(ok)[0]).toMatchObject({ minutes: 105, warn: null });
    const long = { ...trip, stops: [{ ...trip.stops[0], depart_local: "2027-03-10T19:00" }] };
    expect(layovers(long)[0].warn).toBe("long");
    const night = { ...trip, stops: [{ ...trip.stops[0], depart_local: "2027-03-11T07:00" }] };
    expect(layovers(night)[0]).toMatchObject({ overnight: true, warn: null });
    expect(formatWait(130)).toBe("2h 10m");
  });

  it("train connections allow shorter changes; drives never warn", () => {
    const train = { ...trip, mode: "train", stops: [{ id: "s", name: "New Haven", arrive_local: "2027-03-10T09:00", depart_local: "2027-03-10T09:20" }] };
    expect(layovers(train)[0].warn).toBeNull();
    const drive = { ...train, mode: "drive", stops: [{ id: "s", name: "Diner", arrive_local: "2027-03-10T09:00", depart_local: "2027-03-10T09:05" }] };
    expect(layovers(drive)[0].warn).toBeNull();
  });

  it("names the stops", () => {
    expect(viaText(trip)).toBe("via ORD");
    expect(viaText({ stops: [{ id: "a", name: "Denver, CO" }, { id: "b", name: "Moab" }] })).toBe("via Denver & Moab");
    expect(viaText({ stops: [] })).toBe("");
  });

  it("builds directions through every stop", () => {
    const url = directionsThrough([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, null, { lat: 5, lng: 6 }])!;
    expect(url).toContain("origin=1,2");
    expect(url).toContain("destination=5,6");
    expect(decodeURIComponent(url)).toContain("waypoints=3,4");
  });
});
