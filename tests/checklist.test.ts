import { describe, expect, it } from "vitest";
import { advanceByChecklist, cadenceGaps, checklistProgress, stepsFromText, stepsToText, type FieldDef, type ListDef, type ListItem } from "@/lib/fields";

const steps = stepsFromText("# Written\nResearch\nOutline\n# Recorded\nRecord\n# Published\nUpload");
const status: FieldDef = {
  id: "st", name: "Status", type: "status",
  options: [
    { id: "o0", label: "Idea", color: "", kind: "todo" },
    { id: "o1", label: "Written", color: "", kind: "doing" },
    { id: "o2", label: "Recorded", color: "", kind: "doing" },
    { id: "o3", label: "Edited", color: "", kind: "doing" },
    { id: "o4", label: "Published", color: "", kind: "done" },
  ],
};
const prod: FieldDef = { id: "cl", name: "Production", type: "checklist", steps, autoAdvance: true };
const release: FieldDef = { id: "rel", name: "Release", type: "date", cadence: "week" };
const list: ListDef = { id: "L", trip_id: "t", name: "Episodes", icon: "🎧", description: "", sort_order: 0, settings: {}, fields: [status, prod, release] };
const item = (values: Record<string, unknown>): ListItem => ({ id: Math.random().toString(36), trip_id: "t", list_id: "L", title: "", values, sort_order: 0, created_by: null, created_at: "", updated_at: "" });
const id = (label: string) => steps.find((s) => s.label === label)!.id;

describe("checklist field", () => {
  it("reads and writes steps with stages", () => {
    expect(steps.map((s) => [s.stage, s.label])).toEqual([["Written", "Research"], ["Written", "Outline"], ["Recorded", "Record"], ["Published", "Upload"]]);
    expect(stepsToText(steps)).toBe("# Written\nResearch\nOutline\n# Recorded\nRecord\n# Published\nUpload");
    // Editing the text keeps ids of steps that stayed, so ticks survive.
    const again = stepsFromText("# Written\nResearch\nOutline\nFact check\n# Recorded\nRecord", steps);
    expect(again[0].id).toBe(steps[0].id);
    expect(again).toHaveLength(4);
    expect(checklistProgress(prod, [id("Research")])).toEqual({ done: 1, total: 4 });
  });
  it("moves the status forward when a stage is finished, never back", () => {
    expect(advanceByChecklist(list, { st: "o0", cl: [id("Research")] })).toBeNull();
    expect(advanceByChecklist(list, { st: "o0", cl: [id("Research"), id("Outline")] })).toMatchObject({ st: "o1" });
    expect(advanceByChecklist(list, { st: "o0", cl: [id("Research"), id("Outline"), id("Record")] })).toMatchObject({ st: "o2" });
    // Already further along: leave it.
    expect(advanceByChecklist(list, { st: "o3", cl: [id("Research"), id("Outline")] })).toBeNull();
    // Stages must be finished in order.
    expect(advanceByChecklist(list, { st: "o0", cl: [id("Record")] })).toBeNull();
  });
});

describe("cadence", () => {
  it("finds weeks without a release", () => {
    // 2026-11-16 is a Monday.
    const items = [item({ rel: "2026-11-18" }), item({ rel: "2026-12-01" })];
    expect(cadenceGaps(items, list, release, "2026-11-17", 4)).toEqual(["2026-11-23", "2026-12-07"]);
  });
  it("monthly", () => {
    const m: FieldDef = { ...release, cadence: "month" };
    expect(cadenceGaps([item({ rel: "2026-12-05" })], list, m, "2026-11-17", 3)).toEqual(["2026-11-01", "2027-01-01"]);
  });
});
