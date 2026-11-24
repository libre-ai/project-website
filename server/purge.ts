/**
 * The purge of the Bun reference (ADR 0006 §4): deletes the expired pending requests and logs
 * how many, never which. The served runtime runs its port, `site-server` (ADR 0009); this one
 * remains as the parity reference.
 */
import type { Logger } from "./log";
import type { WaitlistStore } from "./store";

export async function purgeOnce(store: WaitlistStore, logger: Logger, now: Date): Promise<number> {
  const purged = await store.purgeExpired(now);
  logger.event("subscription.purge", { purged });
  return purged;
}
