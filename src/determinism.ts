/**
 * Determinism (NFR, S6.4): two assemblies of the same input must write the same bytes. Returns
 * the sorted paths that differ, including paths present on one side only.
 */
import type { OutputFiles } from "./budget";

function same(a: string | Uint8Array, b: string | Uint8Array): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

export function diffOutputs(first: OutputFiles, second: OutputFiles): string[] {
  const paths = new Set([...first.keys(), ...second.keys()]);
  const differing: string[] = [];
  for (const path of paths) {
    const a = first.get(path);
    const b = second.get(path);
    if (a === undefined || b === undefined || !same(a, b)) differing.push(path);
  }
  return differing.sort();
}
