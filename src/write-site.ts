/**
 * Atomic replacement of a static artifact directory (dist/, site/). The files are written to a
 * staging directory first; the previous artifact is swapped out only once every file is written,
 * and restored if the swap fails. Paths are checked: nothing can be written outside the root.
 * Moved unchanged from the former brand publisher (src/build.ts) when the Libre IA build replaced
 * it; its error codes are kept so earlier logs stay comparable.
 */
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, posix } from "node:path";

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function validateOutputPath(path: string): void {
  const segments = path.split("/");
  if (
    path.length === 0 ||
    isAbsolute(path) ||
    path.includes("\\") ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..") ||
    posix.normalize(path) !== path
  ) {
    throw new Error(`brand.output_path_invalid:${path}`);
  }
}

async function recoverInterruptedReplacement(
  outputRoot: string,
  previousRoot: string,
): Promise<void> {
  const [outputExists, previousExists] = await Promise.all([
    pathExists(outputRoot),
    pathExists(previousRoot),
  ]);
  if (!previousExists) return;
  if (!outputExists) {
    await rename(previousRoot, outputRoot);
    return;
  }
  await rm(previousRoot, { recursive: true });
}

export async function writeStaticSite(
  outputRoot: string,
  files: ReadonlyMap<string, string | Uint8Array>,
): Promise<void> {
  const outputName = basename(outputRoot);
  if (outputName.length === 0 || outputName === "." || outputName === ".." || files.size === 0) {
    throw new Error("brand.output_root_invalid");
  }
  for (const path of files.keys()) validateOutputPath(path);

  const parent = dirname(outputRoot);
  const stagingRoot = join(parent, `.${outputName}.staging`);
  const previousRoot = join(parent, `.${outputName}.previous`);
  await mkdir(parent, { recursive: true });
  await recoverInterruptedReplacement(outputRoot, previousRoot);
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(stagingRoot);

  try {
    for (const [path, value] of files) {
      const destination = join(stagingRoot, path);
      await mkdir(dirname(destination), { recursive: true });
      // Text is written as UTF-8; binary assets such as fonts are written byte for byte.
      await writeFile(destination, value, typeof value === "string" ? "utf8" : undefined);
    }
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }

  const hadPreviousArtifact = await pathExists(outputRoot);
  if (hadPreviousArtifact) await rename(outputRoot, previousRoot);
  try {
    await rename(stagingRoot, outputRoot);
    if (hadPreviousArtifact) await rm(previousRoot, { recursive: true });
  } catch (error) {
    await rm(outputRoot, { recursive: true, force: true });
    if (hadPreviousArtifact) await rename(previousRoot, outputRoot);
    await rm(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}
