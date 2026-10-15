/**
 * Replayable visual-quality detector (O8): clones the detector at its pinned commit into a new
 * empty directory, builds it with a locked lockfile, runs it on the given directories and
 * prints the counters. Exits non-zero on any finding or unreadable output.
 *
 * Usage: bun scripts/detect.ts <work directory, new and empty> <directory to examine>...
 * Example: bun scripts/detect.ts "$(mktemp -d)" dist docs/diagrams
 */
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseFindings, planDetector } from "../src/detect-plan";

const [workArgument, ...targets] = process.argv.slice(2);
if (workArgument === undefined || workArgument === "" || targets.length === 0) {
  throw new Error("detect.usage: <work directory> <directory to examine>...");
}
const workDirectory = resolve(workArgument);
// A reused directory could hold a stale binary: the replay must start from nothing.
if (readdirSync(workDirectory).length !== 0) throw new Error("detect.work_dir_not_empty");

function run(command: string, args: readonly string[], cwd: string, env?: Record<string, string>) {
  const result = Bun.spawnSync([command, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

const plan = planDetector(workDirectory);
for (const step of plan.steps) {
  const outcome = run(step.command, step.args, step.cwd);
  if (outcome.code !== 0) {
    throw new Error(`detect.step_failed:${step.label}\n${outcome.stderr}`);
  }
  console.log(`detect ${step.label}: ok`);
}

let findingsTotal = 0;
for (const target of targets) {
  const invocation = plan.runFor(resolve(target));
  const outcome = run(invocation.command, invocation.args, workDirectory, invocation.env);
  const findings = parseFindings(outcome.stdout);
  if (outcome.code !== 0 && findings.length === 0) {
    throw new Error(`detect.exit_${outcome.code}:${target}\n${outcome.stderr}`);
  }
  console.log(`detect examined: ${target}, findings: ${findings.length}`);
  findingsTotal += findings.length;
}
console.log(`detect total findings: ${findingsTotal} over ${targets.length} target(s)`);
if (findingsTotal !== 0) process.exit(1);
