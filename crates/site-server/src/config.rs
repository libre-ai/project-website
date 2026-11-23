//! The deployment settings, read from the environment. An error names the variable, never its
//! value: a value can be a secret (`SMTP_PASSWORD`, `POSTGRESQL_ADDON_URI`).

use std::net::SocketAddr;
use std::path::PathBuf;

use crate::smtp::SmtpConfig;

/// Where the confirmation messages go.
#[derive(Debug, Clone)]
pub enum MailSetting {
    /// A directory of `.eml` files: the local demo and the tests.
    Outbox(PathBuf),
    /// An SMTP relay: production.
    Smtp(SmtpConfig),
}

/// The database, read by the server and by `site-server purge` alike.
#[derive(Clone)]
pub struct DatabaseSetting {
    /// Holds the password: never printed (`Debug` below writes `<redacted>`).
    pub url: String,
    /// `POSTGRESQL_ALLOW_INSECURE_LOCAL=1`: a loopback server may be spoken to without a
    /// verified TLS channel (`store::connect_options`). Local tests and the demo only.
    pub allow_insecure_local: bool,
}

impl std::fmt::Debug for DatabaseSetting {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("DatabaseSetting")
            .field("url", &"<redacted>")
            .field("allow_insecure_local", &self.allow_insecure_local)
            .finish()
    }
}

impl DatabaseSetting {
    pub fn from_source(read: &dyn Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        Ok(Self {
            url: required(read, "POSTGRESQL_ADDON_URI")?,
            allow_insecure_local: flag(read, "POSTGRESQL_ALLOW_INSECURE_LOCAL")?,
        })
    }
}

/// `Debug` comes from the fields, and the only secrets (database URI, SMTP password) print as
/// `<redacted>` in their own types: a `{:?}` added to a log later cannot leak them.
#[derive(Debug, Clone)]
pub struct Config {
    pub site_directory: PathBuf,
    pub origin: String,
    pub redirect_hosts: Vec<String>,
    pub listen: SocketAddr,
    pub database: DatabaseSetting,
    pub database_max_connections: u32,
    pub from: String,
    pub mail: MailSetting,
}

/// The variable that is missing or invalid.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigError(pub &'static str);

const DEFAULT_MAX_CONNECTIONS: u32 = 4;

fn required(
    read: &dyn Fn(&str) -> Option<String>,
    name: &'static str,
) -> Result<String, ConfigError> {
    read(name)
        .filter(|value| !value.is_empty())
        .ok_or(ConfigError(name))
}

fn optional(read: &dyn Fn(&str) -> Option<String>, name: &str) -> Option<String> {
    read(name).filter(|value| !value.is_empty())
}

/// `1` or `0`, absent meaning `0`; anything else is refused rather than guessed.
fn flag(read: &dyn Fn(&str) -> Option<String>, name: &'static str) -> Result<bool, ConfigError> {
    match optional(read, name).as_deref() {
        None | Some("0") => Ok(false),
        Some("1") => Ok(true),
        Some(_) => Err(ConfigError(name)),
    }
}

fn parsed<T: std::str::FromStr>(
    read: &dyn Fn(&str) -> Option<String>,
    name: &'static str,
) -> Result<Option<T>, ConfigError> {
    optional(read, name)
        .map(|value| value.parse::<T>().map_err(|_| ConfigError(name)))
        .transpose()
}

impl Config {
    /// Reads the settings through `read` (the process environment in production).
    pub fn from_source(read: &dyn Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        let listen = required(read, "SITE_LISTEN")?
            .parse()
            .map_err(|_| ConfigError("SITE_LISTEN"))?;
        let redirect_hosts = optional(read, "SITE_REDIRECT_HOSTS")
            .map(|hosts| {
                hosts
                    .split(',')
                    .map(|host| host.trim().to_lowercase())
                    .filter(|host| !host.is_empty())
                    .collect()
            })
            .unwrap_or_default();
        let database_max_connections =
            parsed::<u32>(read, "POSTGRESQL_MAX_CONNECTIONS")?.unwrap_or(DEFAULT_MAX_CONNECTIONS);
        if !(1..=64).contains(&database_max_connections) {
            return Err(ConfigError("POSTGRESQL_MAX_CONNECTIONS"));
        }
        let outbox = optional(read, "WAITLIST_OUTBOX");
        let smtp_host = optional(read, "SMTP_HOST");
        let mail = match (outbox, smtp_host) {
            (Some(directory), None) => MailSetting::Outbox(PathBuf::from(directory)),
            (None, Some(host)) => MailSetting::Smtp(SmtpConfig {
                host,
                port: parsed(read, "SMTP_PORT")?,
                user: optional(read, "SMTP_USER"),
                password: optional(read, "SMTP_PASSWORD"),
                allow_insecure_local: flag(read, "SMTP_ALLOW_INSECURE_LOCAL")?,
                timeout_ms: parsed(read, "SMTP_TIMEOUT_MS")?,
            }),
            // Exactly one destination: a deployment never writes files by accident, and a demo
            // never reaches a relay.
            _ => return Err(ConfigError("WAITLIST_OUTBOX")),
        };
        Ok(Self {
            site_directory: PathBuf::from(required(read, "SITE_DIRECTORY")?),
            origin: required(read, "SITE_ORIGIN")?,
            redirect_hosts,
            listen,
            database: DatabaseSetting::from_source(read)?,
            database_max_connections,
            from: required(read, "WAITLIST_FROM")?,
            mail,
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
    use std::collections::HashMap;

    use super::*;

    fn read(pairs: &[(&str, &str)]) -> Result<Config, ConfigError> {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
            .collect();
        Config::from_source(&|name| map.get(name).cloned())
    }

    const BASE: [(&str, &str); 6] = [
        ("SITE_DIRECTORY", "site"),
        ("SITE_ORIGIN", "https://libre-ia.fr"),
        ("SITE_LISTEN", "0.0.0.0:8080"),
        (
            "POSTGRESQL_ADDON_URI",
            "postgres://site@db.example/waitlist",
        ),
        ("WAITLIST_FROM", "Libre IA <liste@libre-ia.example>"),
        ("SITE_REDIRECT_HOSTS", " LibreIA.fr, www.libre-ia.fr ,"),
    ];

    #[test]
    fn reads_a_production_setting() {
        let mut pairs = BASE.to_vec();
        pairs.extend([
            ("SMTP_HOST", "mail.example"),
            ("SMTP_PORT", "465"),
            ("SMTP_USER", "u"),
            ("SMTP_PASSWORD", "p"),
        ]);
        let config = read(&pairs).unwrap();
        assert_eq!(config.redirect_hosts, vec!["libreia.fr", "www.libre-ia.fr"]);
        assert_eq!(config.database_max_connections, 4);
        assert!(matches!(
            config.mail,
            MailSetting::Smtp(SmtpConfig {
                port: Some(465),
                ..
            })
        ));
    }

    #[test]
    fn never_prints_a_secret_in_debug() {
        let mut pairs = BASE.to_vec();
        pairs.retain(|(name, _)| *name != "POSTGRESQL_ADDON_URI");
        pairs.extend([
            // The whole URI is redacted; a value in its path stands for the password, which a
            // literal credential would make the secret scan refuse.
            (
                "POSTGRESQL_ADDON_URI",
                "postgres://db.example/db-secret-value",
            ),
            ("SMTP_HOST", "mail.example"),
            ("SMTP_USER", "u"),
            ("SMTP_PASSWORD", "smtp-secret-value"),
        ]);
        let printed = format!("{:?}", read(&pairs).unwrap());
        assert!(!printed.contains("secret-value"), "{printed}");
        assert!(printed.contains("<redacted>"), "{printed}");
    }

    #[test]
    fn reads_the_local_database_exception_as_a_strict_flag() {
        let mut pairs = BASE.to_vec();
        pairs.push(("WAITLIST_OUTBOX", "o"));
        assert!(!read(&pairs).unwrap().database.allow_insecure_local);
        let mut on = pairs.clone();
        on.push(("POSTGRESQL_ALLOW_INSECURE_LOCAL", "1"));
        assert!(read(&on).unwrap().database.allow_insecure_local);
        let mut unclear = pairs;
        unclear.push(("POSTGRESQL_ALLOW_INSECURE_LOCAL", "yes"));
        assert_eq!(
            read(&unclear).unwrap_err(),
            ConfigError("POSTGRESQL_ALLOW_INSECURE_LOCAL")
        );
    }

    #[test]
    fn names_the_variable_never_the_value() {
        assert_eq!(read(&BASE).unwrap_err(), ConfigError("WAITLIST_OUTBOX"));
        let mut both = BASE.to_vec();
        both.extend([("WAITLIST_OUTBOX", "o"), ("SMTP_HOST", "h")]);
        assert_eq!(read(&both).unwrap_err(), ConfigError("WAITLIST_OUTBOX"));
        let mut bad_port = BASE.to_vec();
        bad_port.extend([("SMTP_HOST", "h"), ("SMTP_PORT", "x")]);
        assert_eq!(read(&bad_port).unwrap_err(), ConfigError("SMTP_PORT"));
        let mut missing = BASE.to_vec();
        missing.retain(|(name, _)| *name != "POSTGRESQL_ADDON_URI");
        missing.push(("WAITLIST_OUTBOX", "o"));
        assert_eq!(
            read(&missing).unwrap_err(),
            ConfigError("POSTGRESQL_ADDON_URI")
        );
    }
}
