import { describe, expect, it } from "vitest";
import { dropOff, endLabel, endPoint, modeOf, routeText, transportTitle } from "@/lib/transport";
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
