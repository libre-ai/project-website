import { describe, expect, test } from "bun:test";

import {
  clockOrderViolations,
  clockStep,
  noneApplied,
  normaliseRun,
  type RowTrace,
  type StepTrace,
} from "./normalize";

const HOUR = 3_600_000;

const step = (
  started: number,
  ended: number,
  agedHours: number,
  rows: readonly RowTrace[] = [],
): StepTrace => ({
  label: `step at ${started}`,
  response: null,
  rows,
  messageCount: 0,
  started,
  ended,
  agedHours,
});

describe("row-clock normaliser", () => {
  // Request at 1000, renewal at 2000 after 47 hours of ageing, read at 3000 after 2 more.
  const steps = [
    step(1000, 1010, 0),
    step(1500, 1510, 47),
    step(2000, 2010, 47),
    step(3000, 3010, 49),
  ];

  test("names the step whose window holds the value, ageing undone for requested_at", () => {
    expect(clockStep(new Date(1005 - 49 * HOUR), "requested_at", 3, steps)).toBe(0);
    expect(clockStep(new Date(2005 - 2 * HOUR), "requested_at", 3, steps)).toBe(2);
    // A window runs from the step's start to its end, one rounded millisecond after.
    expect(clockStep(new Date(1000), "confirmed_at", 3, steps)).toBe(0);
    expect(clockStep(new Date(1011), "confirmed_at", 3, steps)).toBe(0);
    expect(clockStep(new Date(1012), "confirmed_at", 3, steps)).toBeNull();
    expect(clockStep(new Date(1500), "confirmed_at", 3, steps)).toBe(1);
  });

  test("steps whose windows touch fail the run", () => {
    const touching = [step(1000, 1010, 0), step(1011, 1020, 0)];
    expect(() => clockStep(new Date(1000), "confirmed_at", 1, touching)).toThrow(
      "parity.clock_windows_touch:1",
    );
    expect(
      clockStep(new Date(1000), "confirmed_at", 1, [step(1000, 1010, 0), step(1012, 1020, 0)]),
    ).toBe(0);
  });

  test("never moves confirmed_at by the ageing", () => {
    expect(clockStep(new Date(2005), "confirmed_at", 3, steps)).toBe(2);
    expect(clockStep(new Date(2005 - 2 * HOUR), "confirmed_at", 3, steps)).toBeNull();
  });

  test("a value away from the test clock, or after the step read, names no step", () => {
    expect(clockStep(new Date(2005 - 30 * 24 * HOUR), "confirmed_at", 3, steps)).toBeNull();
    expect(clockStep(new Date(999), "confirmed_at", 3, steps)).toBeNull();
    expect(clockStep(new Date(3012), "confirmed_at", 3, steps)).toBeNull();
    expect(clockStep(new Date(1005), "confirmed_at", 0, steps)).toBe(0);
    expect(clockStep(new Date(1005), "confirmed_at", 9, steps)).toBeNull();
  });

  test("a renewal that kept the first request's time names the first step, not the renewal", () => {
    const renewed = { requested_at: new Date(2005 - 2 * HOUR), confirmed_at: null };
    const kept = { requested_at: new Date(1005 - 49 * HOUR), confirmed_at: null };
    const run = (row: RowTrace) => ({
      steps: [...steps.slice(0, 3), step(3000, 3010, 49, [row])],
      messages: [],
      logs: [],
      purgeLogs: [],
    });
    const applied = noneApplied();
    expect(normaliseRun(run(renewed), applied)).not.toEqual(normaliseRun(run(kept), applied));
    expect(JSON.stringify(normaliseRun(run(renewed), applied))).toContain("<clock of step 2>");
    expect(applied["row-clock"]).toBe(3);
  });

  test("a value in no window is left as it is", () => {
    const row = { requested_at: new Date(5), confirmed_at: null };
    const applied = noneApplied();
    const normalised = normaliseRun(
      { steps: [step(1000, 1010, 0, [row])], messages: [], logs: [], purgeLogs: [] },
      applied,
    ) as { steps: { rows: RowTrace[] }[] };
    expect(normalised.steps[0]?.rows[0]?.requested_at).toEqual(new Date(5));
    expect(applied["row-clock"]).toBe(0);
  });

  test("a row confirmed before it was requested is reported", () => {
    const rows = [
      { requested_at: new Date(1000), confirmed_at: new Date(1000) },
      { requested_at: new Date(1000), confirmed_at: null },
      { requested_at: new Date(1000), confirmed_at: new Date(999) },
    ];
    expect(
      clockOrderViolations({ steps: [step(0, 0, 0, rows)], messages: [], logs: [], purgeLogs: [] }),
    ).toEqual(["step 0 (step at 0): confirmed_at before requested_at"]);
  });
});
