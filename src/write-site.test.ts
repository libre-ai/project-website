import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { writeStaticSite } from "./write-site";

// Moved unchanged with writeStaticSite from the former src/build.test.ts.
const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "libre-ai-website-"));
  temporaryRoots.push(root);
  return root;
}

async function writeFixture(root: string, relativePath: string, value: string): Promise<void> {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("static artifact replacement", () => {
  test("refuses an empty artifact", async () => {
    const root = await temporaryRoot();
    await expect(writeStaticSite(join(root, "dist"), new Map())).rejects.toThrow(
      "brand.output_root_invalid",
    );
  });

  test("recovers an interrupted previous artifact before replacement", async () => {
    const root = await temporaryRoot();
    const outputRoot = join(root, "dist");
    await writeFixture(root, ".dist.previous/index.html", "previous");

    await writeStaticSite(outputRoot, new Map([["index.html", "new"]]));

    expect(await Bun.file(join(outputRoot, "index.html")).text()).toBe("new");
    expect(await exists(join(root, ".dist.previous"))).toBe(false);
  });

  test("replaces the complete output and removes a stale asset", async () => {
    const root = await temporaryRoot();
    const outputRoot = join(root, "dist");
    await writeFixture(root, "dist/index.html", "old");
    await writeFixture(root, "dist/assets/stale.svg", "stale");

    await writeStaticSite(
      outputRoot,
      new Map([
        ["index.html", "new"],
        ["assets/site.css", "styles"],
      ]),
    );

    expect(await Bun.file(join(outputRoot, "index.html")).text()).toBe("new");
    expect(await exists(join(outputRoot, "assets/stale.svg"))).toBe(false);
  });

  test("writes binary assets byte for byte", async () => {
    const root = await temporaryRoot();
    const outputRoot = join(root, "dist");
    const bytes = new Uint8Array([0, 255, 128, 7]);
    await writeStaticSite(outputRoot, new Map([["assets/fonts/f.woff2", bytes]]));
    expect(
      new Uint8Array(await Bun.file(join(outputRoot, "assets/fonts/f.woff2")).arrayBuffer()),
    ).toEqual(bytes);
  });

  test("refuses traversal without mutating the previous artifact", async () => {
    const root = await temporaryRoot();
    const outputRoot = join(root, "dist");
    await writeFixture(root, "dist/index.html", "old");

    await expect(
      writeStaticSite(outputRoot, new Map([["../escape.html", "hostile"]])),
    ).rejects.toThrow("brand.output_path_invalid");
    expect(await Bun.file(join(outputRoot, "index.html")).text()).toBe("old");
    expect(await exists(join(root, "escape.html"))).toBe(false);
  });

  test("keeps the previous artifact when staging fails", async () => {
    const root = await temporaryRoot();
    const outputRoot = join(root, "dist");
    await writeFixture(root, "dist/index.html", "old");

    await expect(
      writeStaticSite(
        outputRoot,
        new Map([
          ["conflict", "file"],
          ["conflict/nested.html", "cannot-be-written"],
        ]),
      ),
    ).rejects.toThrow();
    expect(await Bun.file(join(outputRoot, "index.html")).text()).toBe("old");
  });
});
