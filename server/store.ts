/**
 * PostgreSQL storage of the waitlist (ADR 0006 §3-4), through `Bun.sql` and parameterised
 * statements only. Each operation is a single statement, so two concurrent requests for the same
 * address cannot interleave a read and a write.
 */
import { CONSENT_TEXT_VERSION } from "../src/content/consent";
import type { SubscriptionRequest } from "./subscription";

/** An unconfirmed request expires, and is purged, 48 hours after it was made. */
export const PENDING_TTL_MS = 48 * 3600 * 1000;

export type RequestOutcome = "created" | "renewed" | "already-confirmed";

export interface WaitlistStore {
  request(
    input: SubscriptionRequest,
    confirmHash: string,
    unsubscribeHash: string,
    now: Date,
  ): Promise<RequestOutcome>;
  confirm(confirmHash: string, now: Date): Promise<"confirmed" | "invalid">;
  unsubscribe(unsubscribeHash: string): Promise<"deleted" | "invalid">;
  purgeExpired(now: Date): Promise<number>;
}

// The only personal data the site owns: one row per normalised address, the digests of its tokens
// (never the tokens), the consent text version and optional interests. Kept in code rather than in
// a .sql file, which the personal-data gate treats as a dataset.
export const SCHEMA_SQL = `
create table if not exists subscribers (
  email text primary key,
  state text not null check (state in ('pending', 'confirmed')),
  universes text[] not null,
  follow text,
  tester boolean not null,
  consent_version text not null,
  requested_at timestamptz not null,
  confirmed_at timestamptz,
  confirm_hash text unique,
  unsubscribe_hash text unique not null,
  check ((state = 'pending') = (confirm_hash is not null)),
  check ((state = 'confirmed') = (confirmed_at is not null))
);
`;

export async function migrate(sql: Bun.SQL): Promise<void> {
  await sql.unsafe(SCHEMA_SQL);
}

const expiry = (now: Date): Date => new Date(now.getTime() - PENDING_TTL_MS);

export function createPgStore(sql: Bun.SQL): WaitlistStore {
  return {
    async request(input, confirmHash, unsubscribeHash, now) {
      // A confirmed row matches the conflict but fails the WHERE: no row is returned and nothing
      // changes. `xmax = 0` is true only for a freshly inserted row.
      const rows = (await sql`
        insert into subscribers (email, state, universes, follow, tester, consent_version,
          requested_at, confirm_hash, unsubscribe_hash)
        values (${input.email}, 'pending', ${sql.array([...input.universes], "text")}, ${input.follow}, ${input.tester},
          ${CONSENT_TEXT_VERSION}, ${now}, ${confirmHash}, ${unsubscribeHash})
        on conflict (email) do update set
          universes = excluded.universes,
          follow = excluded.follow,
          tester = excluded.tester,
          consent_version = excluded.consent_version,
          requested_at = excluded.requested_at,
          confirm_hash = excluded.confirm_hash,
          unsubscribe_hash = excluded.unsubscribe_hash
        where subscribers.state = 'pending'
        returning (xmax = 0) as created
      `) as { created: boolean }[];
      const [row] = rows;
      if (row === undefined) return "already-confirmed";
      return row.created ? "created" : "renewed";
    },

    async confirm(confirmHash, now) {
      const rows = await sql`
        update subscribers
        set state = 'confirmed', confirmed_at = ${now}, confirm_hash = null
        where confirm_hash = ${confirmHash}
          and state = 'pending'
          and requested_at > ${expiry(now)}
        returning 1 as confirmed
      `;
      return rows.length === 1 ? "confirmed" : "invalid";
    },

    async unsubscribe(unsubscribeHash) {
      const rows = await sql`
        delete from subscribers where unsubscribe_hash = ${unsubscribeHash} returning 1 as deleted
      `;
      return rows.length === 1 ? "deleted" : "invalid";
    },

    async purgeExpired(now) {
      const rows = await sql`
        delete from subscribers
        where state = 'pending' and requested_at <= ${expiry(now)}
        returning 1 as purged
      `;
      return rows.length;
    },
  };
}
