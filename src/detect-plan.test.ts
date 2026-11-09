import { describe, expect, test } from "bun:test";
import { DETECTOR_PIN, parseFindings, planDetector } from "./detect-plan";

describe("detector pin", () => {
  test("is a full 40-hex commit, never a branch or a short sha", () => {
    expect(DETECTOR_PIN.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(DETECTOR_PIN.url).toStartWith("https://");
  });
});

describe("planDetector", () => {
  const plan = planDetector("/work");

  test("clones into the given empty directory, checks out the pinned sha, then builds locked", () => {
    expect(plan.steps.map((step) => step.label)).toEqual(["clone", "checkout", "build"]);
    const [clone, checkout, build] = plan.steps;
    expect(clone?.args).toContain(DETECTOR_PIN.url);
    expect(checkout?.args).toContain(DETECTOR_PIN.sha);
    expect(build?.args).toContain("--locked");
    expect(build?.cwd).toBe("/work/source");
  });

  // The script executes exactly what this returns: one invocation per examined directory.
  test("runs the built binary on each target directory with JSON output", () => {
    const first = plan.runFor("dist");
    const second = plan.runFor("docs/diagrams");
    expect(first.command).toBe("/work/source/target/release/impeccable");
    expect(first.args).toEqual(["detect", "--json", "dist"]);
    expect(second.args).toEqual(["detect", "--json", "docs/diagrams"]);
    expect(first.env.IMPECCABLE_NO_TELEMETRY).toBe("1");
  });

  test("refuses an empty target", () => {
    expect(() => plan.runFor("")).toThrow("detect.target_empty");
  });

  test("refuses a work directory that is not absolute", () => {
    expect(() => planDetector("relative")).toThrow("detect.work_dir_not_absolute");
  });
});

describe("parseFindings", () => {
  test("an empty array is zero findings", () => {
    expect(parseFindings("[]\n")).toEqual([]);
  });

  test("keeps the findings it was given", () => {
    expect(parseFindings('[{"rule":"flat-type-hierarchy"}]')).toHaveLength(1);
  });

  test("fails closed on output that is not a JSON array", () => {
    expect(() => parseFindings("")).toThrow("detect.output_not_json");
    expect(() => parseFindings("{}")).toThrow("detect.output_not_array");
  });
});
