//! Per-client request limit for the waitlist (ADR 0006 §5), port of `server/limiter.ts`: a fixed
//! window per key, in memory. One process serves the site, so memory is the right place; a
//! restart resets the windows, which only ever loosens the limit for a few minutes.

use std::collections::HashMap;
use std::sync::Mutex;

struct Window {
    start: i64,
    count: u32,
}

pub struct Limiter {
    limit: u32,
    window_ms: i64,
    windows: Mutex<HashMap<String, Window>>,
}

impl Limiter {
    pub fn new(limit: u32, window_ms: i64) -> Self {
        Self {
            limit,
            window_ms,
            windows: Mutex::new(HashMap::new()),
        }
    }

    /// True when the request of `key` at `now` (milliseconds) is within the limit.
    pub fn allow(&self, key: &str, now: i64) -> bool {
        // A poisoned lock only means another request panicked while holding it; the map is
        // still a valid set of windows.
        let mut windows = match self.windows.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        // Expired windows are dropped as they are met, so the map stays bounded by active clients.
        windows.retain(|_, window| now - window.start < self.window_ms);
        match windows.get_mut(key) {
            None => {
                windows.insert(
                    key.to_owned(),
                    Window {
                        start: now,
                        count: 1,
                    },
                );
                true
            }
            Some(window) if window.count >= self.limit => false,
            Some(window) => {
                window.count += 1;
                true
            }
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
    }
}
