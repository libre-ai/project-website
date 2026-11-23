//! PostgreSQL storage of the waitlist (ADR 0006 §3-4), port of `server/store.ts`, through
//! `sqlx` and parameterised statements only. Each operation is a single statement, so two
//! concurrent requests for the same address cannot interleave a read and a write.

use std::future::Future;
use std::pin::Pin;
use std::str::FromStr;
use std::time::Duration;

use sqlx::postgres::{PgConnectOptions, PgPool, PgPoolOptions, PgSslMode};
use time::OffsetDateTime;

use crate::subscription::SubscriptionRequest;

/// An unconfirmed request expires, and is purged, 48 hours after it was made.
pub const PENDING_TTL: Duration = Duration::from_secs(48 * 3600);

/// The table of `server/store.ts`, unchanged: the parity test compares the two catalogues.
pub const SCHEMA_SQL: &str = "
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
";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequestOutcome {
    Created,
    Renewed,
    AlreadyConfirmed,
}

impl RequestOutcome {
    pub fn code(self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Renewed => "renewed",
            Self::AlreadyConfirmed => "already-confirmed",
        }
    }
}

/// A storage failure. Its cause is dropped on purpose: a driver message can quote a value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StoreError;

pub type StoreFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T, StoreError>> + Send + 'a>>;

pub trait Store: Send + Sync {
    fn request<'a>(
        &'a self,
        input: &'a SubscriptionRequest,
        confirm_hash: &'a str,
        unsubscribe_hash: &'a str,
        now: OffsetDateTime,
    ) -> StoreFuture<'a, RequestOutcome>;
    /// True when a pending, unexpired request carried this digest and is now confirmed.
    fn confirm<'a>(&'a self, confirm_hash: &'a str, now: OffsetDateTime) -> StoreFuture<'a, bool>;
    /// True when a row carried this digest and is now deleted.
    fn unsubscribe<'a>(&'a self, unsubscribe_hash: &'a str) -> StoreFuture<'a, bool>;
    fn purge_expired(&self, now: OffsetDateTime) -> StoreFuture<'_, u64>;
}

pub struct PgStore {
    pool: PgPool,
    consent_version: String,
}

fn expiry(now: OffsetDateTime) -> OffsetDateTime {
    now - PENDING_TTL
}

const LOOPBACK_HOSTS: [&str; 3] = ["localhost", "127.0.0.1", "::1"];

/// The connection settings of `url`, refused unless the channel is encrypted and the server
/// verified: `sslmode=verify-full` (in the URI, or `PGSSLMODE` in the environment, which the
/// driver reads too). Anything weaker — sqlx's default `prefer` falls back to clear text and
/// verifies no certificate — lets an interceptor read and change the whole list. The only way
/// out is `allow_insecure_local`, accepted for a loopback server alone: the local tests and
/// the demo. The error is a code; the URI holds the password and is never quoted.
pub fn connect_options(
    url: &str,
    allow_insecure_local: bool,
) -> Result<PgConnectOptions, &'static str> {
    let options = PgConnectOptions::from_str(url).map_err(|_| "database.uri_invalid")?;
    if matches!(options.get_ssl_mode(), PgSslMode::VerifyFull) {
        return Ok(options);
    }
    if !allow_insecure_local {
        return Err("database.tls_unverified");
    }
    let host = options.get_host().to_lowercase();
    let host = host
        .strip_prefix('[')
        .and_then(|inner| inner.strip_suffix(']'))
        .unwrap_or(&host);
    let local = options.get_socket().is_some() || LOOPBACK_HOSTS.contains(&host);
    if local {
        Ok(options)
    } else {
        Err("database.insecure_not_local")
    }
}

impl PgStore {
    /// Connects lazily and creates the table when absent.
    pub async fn connect(
        options: PgConnectOptions,
        max_connections: u32,
        consent_version: String,
    ) -> Result<Self, StoreError> {
        let pool = PgPoolOptions::new()
            .max_connections(max_connections)
            .acquire_timeout(Duration::from_secs(10))
            .connect_with(options)
            .await
            .map_err(|_| StoreError)?;
        sqlx::raw_sql(SCHEMA_SQL)
            .execute(&pool)
            .await
            .map_err(|_| StoreError)?;
        Ok(Self {
            pool,
            consent_version,
        })
    }

    pub async fn close(&self) {
        self.pool.close().await;
    }
}

// Statements are unnamed (`persistent(false)`): a pooler or a shared in-memory server (the
// PGlite of the tests) can hand two connections one backend, where named statements collide.
impl Store for PgStore {
    fn request<'a>(
        &'a self,
        input: &'a SubscriptionRequest,
        confirm_hash: &'a str,
        unsubscribe_hash: &'a str,
        now: OffsetDateTime,
    ) -> StoreFuture<'a, RequestOutcome> {
        Box::pin(async move {
            // A confirmed row matches the conflict but fails the WHERE: no row is returned and
            // nothing changes. `xmax = 0` is true only for a freshly inserted row.
            let row: Option<(bool,)> = sqlx::query_as(
                "insert into subscribers (email, state, universes, follow, tester, consent_version,
                   requested_at, confirm_hash, unsubscribe_hash)
                 values ($1, 'pending', $2, $3, $4, $5, $6, $7, $8)
                 on conflict (email) do update set
                   universes = excluded.universes,
                   follow = excluded.follow,
                   tester = excluded.tester,
                   consent_version = excluded.consent_version,
                   requested_at = excluded.requested_at,
                   confirm_hash = excluded.confirm_hash,
                   unsubscribe_hash = excluded.unsubscribe_hash
                 where subscribers.state = 'pending'
                 returning (xmax = 0) as created",
            )
            .persistent(false)
            .bind(&input.email)
            .bind(&input.universes)
            .bind(&input.follow)
            .bind(input.tester)
            .bind(&self.consent_version)
            .bind(now)
            .bind(confirm_hash)
            .bind(unsubscribe_hash)
            .fetch_optional(&self.pool)
            .await
            .map_err(|_| StoreError)?;
            Ok(match row {
                None => RequestOutcome::AlreadyConfirmed,
                Some((true,)) => RequestOutcome::Created,
                Some((false,)) => RequestOutcome::Renewed,
            })
        })
    }

    fn confirm<'a>(&'a self, confirm_hash: &'a str, now: OffsetDateTime) -> StoreFuture<'a, bool> {
        Box::pin(async move {
            let result = sqlx::query(
                "update subscribers
                 set state = 'confirmed', confirmed_at = $1, confirm_hash = null
                 where confirm_hash = $2 and state = 'pending' and requested_at > $3",
            )
            .persistent(false)
            .bind(now)
            .bind(confirm_hash)
            .bind(expiry(now))
            .execute(&self.pool)
            .await
            .map_err(|_| StoreError)?;
            Ok(result.rows_affected() == 1)
        })
    }

    fn unsubscribe<'a>(&'a self, unsubscribe_hash: &'a str) -> StoreFuture<'a, bool> {
        Box::pin(async move {
            let result = sqlx::query("delete from subscribers where unsubscribe_hash = $1")
                .persistent(false)
                .bind(unsubscribe_hash)
                .execute(&self.pool)
                .await
                .map_err(|_| StoreError)?;
            Ok(result.rows_affected() == 1)
        })
    }

    fn purge_expired(&self, now: OffsetDateTime) -> StoreFuture<'_, u64> {
        Box::pin(async move {
            let result = sqlx::query(
                "delete from subscribers where state = 'pending' and requested_at <= $1",
            )
            .persistent(false)
            .bind(expiry(now))
            .execute(&self.pool)
            .await
            .map_err(|_| StoreError)?;
            Ok(result.rows_affected())
        })
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

    fn refusal(url: &str, allow_insecure_local: bool) -> Option<&'static str> {
        connect_options(url, allow_insecure_local).err()
    }

    #[test]
    fn requires_a_verified_encrypted_channel() {
        let remote = "postgres://db.example:5432/w";
        assert_eq!(
            refusal(&format!("{remote}?sslmode=verify-full"), false),
            None
        );
        for mode in ["disable", "allow", "prefer", "require", "verify-ca"] {
            assert_eq!(
                refusal(&format!("{remote}?sslmode={mode}"), false),
                Some("database.tls_unverified"),
                "{mode}"
            );
        }
        // Without a mode the driver falls back to `PGSSLMODE`, then to `prefer`.
        assert!(
            std::env::var_os("PGSSLMODE").is_none(),
            "PGSSLMODE is set: this case reads it"
        );
        assert_eq!(refusal(remote, false), Some("database.tls_unverified"));
        assert_eq!(
            refusal("postgres://db.example/w?sslmode=unknown", false),
            Some("database.uri_invalid")
        );
    }

    #[test]
    fn allows_clear_text_to_a_loopback_server_only_when_asked() {
        for url in [
            "postgres://127.0.0.1:5432/w?sslmode=disable",
            "postgres://localhost/w?sslmode=prefer",
            "postgres://[::1]:5432/w?sslmode=disable",
        ] {
            assert_eq!(refusal(url, true), None, "{url}");
            assert_eq!(
                refusal(url, false),
                Some("database.tls_unverified"),
                "{url}"
            );
        }
        assert_eq!(
            refusal("postgres://db.example/w?sslmode=disable", true),
            Some("database.insecure_not_local")
        );
        // The exception never weakens a verified remote channel.
        assert_eq!(
            refusal("postgres://db.example/w?sslmode=verify-full", true),
            None
        );
    }
}
