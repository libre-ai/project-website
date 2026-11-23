import { describe, expect, test } from "bun:test";

import { listeningPort, requireBinary, startSiteServer } from "./site-server-process";

describe("site-server child process", () => {
  test("reads the port of the start line only", () => {
    expect(listeningPort('{"event":"server.listening","port":8080}')).toBe(8080);
    expect(listeningPort('{"event":"server.stopped"}')).toBeNull();
    expect(listeningPort('{"event":"server.listening","port":"8080"}')).toBeNull();
    expect(listeningPort("not json")).toBeNull();
  });

  test("an absent binary fails, it is never replaced", () => {
    expect(() => requireBinary("/nonexistent/site-server")).toThrow("site_server.binary_missing");
  });

  test("a binary that exits before listening fails the start with its log lines", async () => {
    // No configuration at all: the binary refuses to start and names the missing variable.
    await expect(startSiteServer({})).rejects.toThrow("server.start_failed");
  }, 30_000);
});
