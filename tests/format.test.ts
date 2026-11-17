import { describe, expect, it } from "vitest";
import { addDays, countdown, daysBetween, formatRange, formatTime, normalizeUrl, splitLocal, tripDays } from "@/lib/format";

describe("dates", () => {
  it("lists every trip day inclusive", () => {
    expect(tripDays("2027-10-24", "2027-10-27")).toEqual(["2027-10-24", "2027-10-25", "2027-10-26", "2027-10-27"]);
    expect(tripDays(null, "2027-10-27")).toEqual([]);
    expect(tripDays("2027-10-27", "2027-10-24")).toEqual([]);
  });

  it("handles month boundaries and DST weeks", () => {
    expect(addDays("2027-10-31", 1)).toBe("2027-11-01");
    expect(daysBetween("2027-10-30", "2027-11-08")).toBe(9);
  });

  it("counts down to the trip", () => {
    const now = new Date(2027, 9, 20, 12); // Oct 20 2027 local
    expect(countdown("2027-10-24", "2027-11-06", now)).toEqual({ phase: "before", days: 4 });
    expect(countdown("2027-10-18", "2027-11-06", now)).toMatchObject({ phase: "during", days: 3 });
    expect(countdown("2027-10-01", "2027-10-05", now).phase).toBe("after");
  });

  it("formats ranges", () => {
    expect(formatRange("2027-10-24", "2027-11-06")).toBe("Oct 24 – Nov 6, 2027");
    expect(formatRange(null, null)).toBe("Dates not set");
    expect(formatRange("2027-06-12", "2027-06-12")).toBe("Sat, Jun 12, 2027");
  });
});

describe("small helpers", () => {
  it("formats times", () => {
    expect(formatTime("14:30:00")).toBe("2:30 PM");
    expect(formatTime("00:05")).toBe("12:05 AM");
    expect(formatTime(null)).toBe("");
  });

  it("splits local timestamps", () => {
    expect(splitLocal("2027-10-24T15:05:00")).toEqual({ day: "2027-10-24", time: "15:05:00" });
    expect(splitLocal("2027-10-24 15:05")).toEqual({ day: "2027-10-24", time: "15:05" });
  });

  it("normalizes links", () => {
    expect(normalizeUrl("salemwitchmuseum.com")).toBe("https://salemwitchmuseum.com");
    expect(normalizeUrl("  ")).toBeNull();
    expect(normalizeUrl("http://x.com")).toBe("http://x.com");
  });
});
