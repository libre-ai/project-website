/**
 * Per-client request limit for the waitlist (ADR 0006 §5), in memory: a fixed window per key.
 * One process serves the site, so memory is the right place; a restart resets the windows, which
 * only ever loosens the limit for a few minutes.
 */

export interface Limiter {
  allow(key: string, now: number): boolean;
}

export function createLimiter(options: {
  readonly limit: number;
  readonly windowMs: number;
}): Limiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    allow(key, now) {
      // Expired windows are dropped as they are met, so the map stays bounded by active clients.
      for (const [other, window] of windows) {
        if (now - window.start >= options.windowMs) windows.delete(other);
      }
      const window = windows.get(key);
      if (window === undefined) {
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      if (window.count >= options.limit) return false;
      window.count += 1;
      return true;
    },
  };
}
