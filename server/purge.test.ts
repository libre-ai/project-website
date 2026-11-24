import { describe, expect, test } from "bun:test";

import { createLogger } from "./log";
import { purgeOnce } from "./purge";

describe("purge of the Bun reference", () => {
  test("a purge logs how many requests it removed, never which", async () => {
    const lines: string[] = [];
    const store = {
      request: async () => "created" as const,
      confirm: async () => "invalid" as const,
      unsubscribe: async () => "invalid" as const,
      purgeExpired: async () => 3,
    };
    expect(
      await purgeOnce(
        store,
        createLogger((line) => lines.push(line)),
        new Date(),
      ),
    ).toBe(3);
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { event: "subscription.purge", purged: 3 },
    ]);
  });
});
