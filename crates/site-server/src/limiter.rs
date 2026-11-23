//! Per-client request limit for the waitlist (ADR 0006 §5), port of `server/limiter.ts`: a fixed
//! window per key, in memory. One process serves the site, so memory is the right place; a
//! restart resets the windows, which only ever loosens the limit for a few minutes.
//!
//! Two departures from the reference, both stricter (ADR 0009):
//! - an IPv6 client is keyed by its /64, the block one subscriber line usually receives: keyed
//!   by full address, one line could rotate through 2^64 keys and never meet the limit;
//! - expired windows leave through a queue ordered by start, so a request costs the windows that
//!   expired since the previous one, not a scan of the whole table; and the table holds at most
//!   `max_keys` clients: past that, the oldest window is evicted for the new client. Refusing the
//!   new client instead would let `max_keys` keys close the form to everyone; evicting lets them
//!   reset the windows of others, the residual risk ADR 0009 names.
//!
//! Not limited here, and still open before deployment: the messages sent to one address. A
//! pending address receives a message for every accepted request.

use std::collections::{HashMap, VecDeque};
use std::net::IpAddr;
use std::sync::Mutex;

/// Clients tracked at once in the served runtime: about ten megabytes at most.
pub const MAX_KEYS: usize = 100_000;

struct Window {
    start: i64,
    count: u32,
}

#[derive(Default)]
struct Windows {
    by_key: HashMap<String, Window>,
    /// Window starts in increasing order, with their key: the oldest expires first.
    expiring: VecDeque<(i64, String)>,
}

pub struct Limiter {
    limit: u32,
    window_ms: i64,
    max_keys: usize,
    windows: Mutex<Windows>,
}

/// The key of a client: the address for IPv4 (an IPv4-mapped IPv6 address counts as IPv4), the
/// /64 for IPv6.
pub fn client_key(address: IpAddr) -> String {
    match address {
        IpAddr::V4(v4) => v4.to_string(),
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => v4.to_string(),
            None => {
                let [a, b, c, d, ..] = v6.segments();
                format!("{a:x}:{b:x}:{c:x}:{d:x}::/64")
            }
        },
    }
}

impl Limiter {
    pub fn new(limit: u32, window_ms: i64) -> Self {
        Self::with_capacity(limit, window_ms, MAX_KEYS)
    }

    pub fn with_capacity(limit: u32, window_ms: i64, max_keys: usize) -> Self {
        Self {
            limit,
            window_ms,
            max_keys,
            windows: Mutex::new(Windows::default()),
        }
    }

    /// True when the request of `key` at `now` (milliseconds) is within the limit.
    pub fn allow(&self, key: &str, now: i64) -> bool {
        // A poisoned lock only means another request panicked while holding it; the table is
        // still a valid set of windows.
        let mut windows = match self.windows.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        let Windows { by_key, expiring } = &mut *windows;
        while let Some((start, _)) = expiring.front() {
            if now - *start < self.window_ms {
                break;
            }
            if let Some((start, expired)) = expiring.pop_front() {
                // The key may hold a newer window already: only the one that started then goes.
                if by_key
                    .get(&expired)
                    .is_some_and(|window| window.start == start)
                {
                    by_key.remove(&expired);
                }
            }
        }
        match by_key.get_mut(key) {
            Some(window) if now - window.start < self.window_ms => {
                if window.count >= self.limit {
                    return false;
                }
                window.count += 1;
                true
            }
            existing => {
                if existing.is_none() && by_key.len() >= self.max_keys {
                    // Full: the oldest window leaves, so a new client is never refused for want
                    // of room. Its key starts again from nothing (ADR 0009, residual risk).
                    while let Some((start, oldest)) = expiring.pop_front() {
                        if by_key
                            .get(&oldest)
                            .is_some_and(|window| window.start == start)
                        {
                            by_key.remove(&oldest);
                            break;
                        }
                    }
                }
                by_key.insert(
                    key.to_owned(),
                    Window {
                        start: now,
                        count: 1,
                    },
                );
                expiring.push_back((now, key.to_owned()));
                true
            }
        }
    }

    /// Clients currently tracked.
    pub fn tracked(&self) -> usize {
        match self.windows.lock() {
            Ok(guard) => guard.by_key.len(),
            Err(poisoned) => poisoned.into_inner().by_key.len(),
        }
    }
}

#[cfg(test)]
#[allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing
)]
mod tests {
    use super::*;

    #[test]
    fn allows_a_new_window_once_the_old_one_has_passed() {
        let limiter = Limiter::new(1, 1000);
        assert!(limiter.allow("k", 0));
        assert!(!limiter.allow("k", 500));
        assert!(limiter.allow("other", 500));
        assert!(limiter.allow("k", 1001));
        assert!(!limiter.allow("k", 1500));
    }

    #[test]
    fn keys_an_ipv6_client_by_its_64_and_a_mapped_one_as_ipv4() {
        let key = |text: &str| client_key(text.parse().unwrap());
        assert_eq!(key("2001:db8:1:2::1"), key("2001:db8:1:2:ffff:ffff:ffff:9"));
        assert_ne!(key("2001:db8:1:2::1"), key("2001:db8:1:3::1"));
        assert_eq!(key("::ffff:192.0.2.7"), "192.0.2.7");
        assert_eq!(key("192.0.2.7"), "192.0.2.7");
        assert_ne!(key("192.0.2.7"), key("192.0.2.8"));
        let limiter = Limiter::new(1, 1000);
        assert!(limiter.allow(&key("2001:db8:1:2::1"), 0));
        assert!(!limiter.allow(&key("2001:db8:1:2::2"), 1));
    }

    #[test]
    fn drops_expired_windows_and_bounds_the_table() {
        let limiter = Limiter::with_capacity(5, 1000, 2);
        assert!(limiter.allow("a", 0));
        assert!(limiter.allow("b", 10));
        assert!(limiter.allow("a", 30));
        // Once `a` has expired, its place is free again.
        assert!(limiter.allow("c", 1000));
        assert_eq!(limiter.tracked(), 2);
        // Each start leaves at its turn, and a client met again gets a fresh window.
        assert!(limiter.allow("c", 1500));
        assert!(limiter.allow("b", 1600));
        assert!(limiter.allow("b", 2601));
        assert_eq!(limiter.tracked(), 1);
    }

    #[test]
    fn a_full_table_evicts_the_oldest_window_never_refuses_a_new_client() {
        let limiter = Limiter::with_capacity(1, 1000, 2);
        assert!(limiter.allow("a", 0));
        assert!(limiter.allow("b", 10));
        assert!(!limiter.allow("a", 20));
        // Full: the new client is counted, and the oldest window (`a`) leaves for it.
        assert!(limiter.allow("c", 30));
        assert_eq!(limiter.tracked(), 2);
        assert!(!limiter.allow("b", 40));
        assert!(!limiter.allow("c", 50));
        // `a` starts again from nothing: the residual risk ADR 0009 names.
        assert!(limiter.allow("a", 60));
        assert_eq!(limiter.tracked(), 2);
        // Eviction follows the start of the current windows: `a`, renewed after `b`, outlives it.
        let renewed = Limiter::with_capacity(1, 100, 2);
        assert!(renewed.allow("a", 0));
        assert!(renewed.allow("b", 150));
        assert!(renewed.allow("a", 160));
        assert!(renewed.allow("c", 170));
        assert!(!renewed.allow("a", 180));
        assert!(renewed.allow("b", 190));
    }
}
