import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { CONSENT_TEXT_VERSION } from "../src/content/consent";
import { createPgStore, migrate, PENDING_TTL_MS, type WaitlistStore } from "./store";
import type { SubscriptionRequest } from "./subscription";
import { startTestDatabase, type TestDatabase } from "./test-database";

const request: SubscriptionRequest = {
  email: "a@example.org",
  universes: ["apprendre"],
  follow: "P07",
  tester: true,
};
const t0 = new Date("2026-11-11T10:00:00.000Z");
const later = (ms: number): Date => new Date(t0.getTime() + ms);

let database: TestDatabase;
let sql: Bun.SQL;
let store: WaitlistStore;

beforeAll(async () => {
  database = await startTestDatabase();
  sql = new Bun.SQL(database.url, { max: 1 });
  await migrate(sql);
  store = createPgStore(sql);
});

afterAll(async () => {
  await sql.close();
  await database.stop();
});

beforeEach(async () => {
  await sql`delete from subscribers`;
});

const rows = async () =>
  (await sql`select * from subscribers order by email`) as Record<string, unknown>[];

describe("waitlist store (ADR 0006 §3-4)", () => {
  test("migrate is idempotent", async () => {
    await migrate(sql);
    await migrate(sql);
    expect(await rows()).toEqual([]);
  });

  test("a request creates a pending row holding only the declared fields", async () => {
    expect(await store.request(request, "c1", "u1", t0)).toBe("created");
    const [row] = await rows();
    expect(Object.keys(row ?? {}).sort()).toEqual(
      [
        "confirm_hash",
        "confirmed_at",
        "consent_version",
        "email",
        "follow",
        "requested_at",
        "state",
        "tester",
        "universes",
        "unsubscribe_hash",
      ].sort(),
    );
    expect(row).toMatchObject({
      email: "a@example.org",
      state: "pending",
      universes: ["apprendre"],
      follow: "P07",
      tester: true,
      consent_version: CONSENT_TEXT_VERSION,
      confirm_hash: "c1",
      unsubscribe_hash: "u1",
      confirmed_at: null,
    });
    expect(row?.requested_at).toEqual(t0);
  });

  test("a second request on a pending address renews its digests and interests", async () => {
    await store.request(request, "c1", "u1", t0);
    const renewed = { ...request, universes: [], follow: null, tester: false };
    expect(await store.request(renewed, "c2", "u2", later(1000))).toBe("renewed");
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      confirm_hash: "c2",
      unsubscribe_hash: "u2",
      universes: [],
      follow: null,
      tester: false,
    });
    expect(await store.confirm("c1", later(2000))).toBe("invalid");
  });

  test("a request on a confirmed address changes nothing", async () => {
    await store.request(request, "c1", "u1", t0);
    await store.confirm("c1", later(1000));
    const before = await rows();
    expect(await store.request({ ...request, tester: false }, "c2", "u2", later(2000))).toBe(
      "already-confirmed",
    );
    expect(await rows()).toEqual(before);
  });

  test("confirm moves a pending row to confirmed and spends its confirmation digest", async () => {
    await store.request(request, "c1", "u1", t0);
    expect(await store.confirm("c1", later(1000))).toBe("confirmed");
    const [row] = await rows();
    expect(row).toMatchObject({ state: "confirmed", confirm_hash: null, unsubscribe_hash: "u1" });
    expect(row?.confirmed_at).toEqual(later(1000));
  });

  test("second confirmation is idempotent: invalid, never an error", async () => {
    await store.request(request, "c1", "u1", t0);
    await store.confirm("c1", later(1000));
    expect(await store.confirm("c1", later(2000))).toBe("invalid");
  });

  test("confirm refuses a request older than 48 hours", async () => {
    await store.request(request, "c1", "u1", t0);
    expect(await store.confirm("c1", later(PENDING_TTL_MS + 1))).toBe("invalid");
    expect((await rows())[0]).toMatchObject({ state: "pending" });
  });

  test("an unknown confirmation digest is invalid", async () => {
    expect(await store.confirm("nope", t0)).toBe("invalid");
  });

  test("unsubscribe deletes the row, whatever its state", async () => {
    await store.request(request, "c1", "u1", t0);
    await store.request({ ...request, email: "b@example.org" }, "c2", "u2", t0);
    await store.confirm("c2", later(1000));
    expect(await store.unsubscribe("u1")).toBe("deleted");
    expect(await store.unsubscribe("u2")).toBe("deleted");
    expect(await rows()).toEqual([]);
  });

  test("unsubscribe with an unknown digest is invalid and deletes nothing", async () => {
    await store.request(request, "c1", "u1", t0);
    expect(await store.unsubscribe("nope")).toBe("invalid");
    expect(await rows()).toHaveLength(1);
  });

  test("purgeExpired deletes only pending rows older than 48 hours and returns their number", async () => {
    await store.request(request, "c1", "u1", t0);
    await store.request({ ...request, email: "b@example.org" }, "c2", "u2", t0);
    await store.confirm("c2", later(1000));
    await store.request({ ...request, email: "c@example.org" }, "c3", "u3", later(PENDING_TTL_MS));
    expect(await store.purgeExpired(later(PENDING_TTL_MS + 1))).toBe(1);
    expect((await rows()).map((row) => row.email)).toEqual(["b@example.org", "c@example.org"]);
  });
});
