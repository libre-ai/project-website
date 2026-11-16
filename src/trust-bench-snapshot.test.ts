import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { TRUST_BENCH_COPY, TRUST_BENCH_PINS } from "./trust-bench";
import { loadTrustBench } from "./trust-bench-snapshot";

const DATA = join(import.meta.dir, "data");
const pins = await readFile(join(DATA, TRUST_BENCH_PINS), "utf8");
const copy = await readFile(join(DATA, TRUST_BENCH_COPY));

const directories: string[] = [];
afterAll(async () => {
  for (const directory of directories) await rm(directory, { recursive: true, force: true });
});

// A data directory holding the committed pin, and the given copy (none when null).
async function dataWith(bytes: Uint8Array | null, pinText = pins): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "libre-ia-trust-bench-"));
  directories.push(directory);
  await writeFile(join(directory, TRUST_BENCH_PINS), pinText);
  if (bytes !== null) {
    await mkdir(dirname(join(directory, TRUST_BENCH_COPY)), { recursive: true });
    await writeFile(join(directory, TRUST_BENCH_COPY), bytes);
  }
  return directory;
}

describe("loadTrustBench (the versioned copy equals the pinned source)", () => {
  test("the committed copy matches its pin, and the counters say what was read", async () => {
    const loaded = await loadTrustBench(DATA);
    const pin = (JSON.parse(pins) as { sha: string }[])[0];
    expect(loaded.commit).toBe(pin?.sha ?? "");
    expect(loaded.counts.measures).toBe(loaded.bench.measures.length);
    expect(loaded.counts.measures).toBeGreaterThan(0);
    expect(loaded.counts.layers).toBeGreaterThan(0);
    expect(loaded.counts.defects).toBeGreaterThan(0);
    expect(loaded.counts.healthy).toBeGreaterThan(0);
    // The same bytes in another directory load too: the refusals below come from the change alone.
    expect((await loadTrustBench(await dataWith(copy))).counts).toEqual(loaded.counts);
  });

  test("a copy altered by one byte is refused, even when it still reads as a valid measure", async () => {
    // One digit of a figure: still JSON, still the expected shape, so only the digest can tell.
    const index = copy.indexOf('"defauts_attrapes": 7');
    expect(index).toBeGreaterThan(-1);
    const altered = Uint8Array.from(copy);
    const digit = index + '"defauts_attrapes": '.length;
    expect(altered[digit]).toBe("7".charCodeAt(0));
    altered[digit] = "8".charCodeAt(0);
    await expect(loadTrustBench(await dataWith(altered))).rejects.toThrow(
      "site.trust_bench_refused:snapshot.digest_mismatch:project-governance",
    );
  });

  test("a missing copy is refused", async () => {
    await expect(loadTrustBench(await dataWith(null))).rejects.toThrow(
      "site.trust_bench_refused:snapshot.missing:project-governance",
    );
  });

  test("an empty copy is refused", async () => {
    await expect(loadTrustBench(await dataWith(new Uint8Array()))).rejects.toThrow(
      "site.trust_bench_refused:",
    );
  });

  test("a pin on another repository, or more than one pin, is refused", async () => {
    const [pin] = JSON.parse(pins) as Record<string, string>[];
    const elsewhere = JSON.stringify([{ ...pin, repository: "project-website" }]);
    await expect(loadTrustBench(await dataWith(copy, elsewhere))).rejects.toThrow(
      "site.trust_bench_refused:pin_invalid",
    );
    await expect(loadTrustBench(await dataWith(copy, JSON.stringify([pin, pin])))).rejects.toThrow(
      "site.trust_bench_refused:pin_invalid",
    );
  });

  test("a copy that matches its pin but not the expected shape is refused", async () => {
    const text = '{"schema_version":"libre-ai.trust-bench.v1","mesures":[]}';
    const digest = new Bun.CryptoHasher("sha256").update(text).digest("hex");
    const [pin] = JSON.parse(pins) as Record<string, string>[];
    const repinned = JSON.stringify([{ ...pin, sha256: digest }]);
    await expect(
      loadTrustBench(await dataWith(new TextEncoder().encode(text), repinned)),
    ).rejects.toThrow("trust_bench.shape:mesures");
  });
});
