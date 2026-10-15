/**
 * Detector plan (O8, S6.1): how to rebuild the visual-quality detector from its pinned source
 * in an empty directory, and how to read its verdict. Pure: the process spawning lives in
 * scripts/detect.ts, so every decision here is testable without a toolchain.
 */

// A full commit, never a branch: the detector must be the same bytes on every replay.
export const DETECTOR_PIN = {
  url: "https://github.com/pbakaus/impeccable.git",
  sha: "2f98774f86bc05563876643db37e6c37c322850f",
} as const;

export interface Step {
  readonly label: "clone" | "checkout" | "build";
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export interface DetectorPlan {
  readonly steps: readonly Step[];
  readonly run: {
    readonly command: string;
    readonly args: readonly string[];
    readonly env: Readonly<Record<string, string>>;
  };
}

export function planDetector(workDirectory: string, target: string): DetectorPlan {
  if (!workDirectory.startsWith("/")) throw new Error("detect.work_dir_not_absolute");
  const source = `${workDirectory}/source`;
  return {
    steps: [
      {
        label: "clone",
        command: "git",
        args: ["clone", "--quiet", DETECTOR_PIN.url, source],
        cwd: workDirectory,
      },
      {
        label: "checkout",
        command: "git",
        args: ["checkout", "--quiet", "--detach", DETECTOR_PIN.sha],
        cwd: source,
      },
      {
        label: "build",
        command: "cargo",
        args: ["build", "--locked", "--release", "-p", "impeccable"],
        cwd: source,
      },
    ],
    run: {
      command: `${source}/target/release/impeccable`,
      args: ["detect", "--json", target],
      // No telemetry from a verification run (project instruction).
      env: { IMPECCABLE_NO_TELEMETRY: "1" },
    },
  };
}

// The verdict is the array itself: anything else is an unreadable source, never "zero findings".
export function parseFindings(stdout: string): readonly unknown[] {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new Error("detect.output_not_json");
  }
  if (!Array.isArray(value)) throw new Error("detect.output_not_array");
  return value;
}
