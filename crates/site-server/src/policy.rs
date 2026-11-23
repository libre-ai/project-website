//! The values the server shares with the TypeScript site: the security header policy
//! (`src/headers.ts`), the consent text version (`src/content/consent.ts`), the universes and
//! the application references of the form (`src/content/universes.ts`).
//!
//! They are defined once, in TypeScript, and written to `policy.json` by
//! `bun run sync:server-policy`; `server/server-policy.test.ts` fails when the file differs from
//! its sources, so the two languages cannot drift apart.

use std::collections::BTreeSet;

use serde::Deserialize;

const POLICY_JSON: &str = include_str!("../policy.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RawPolicy {
    security_headers: Vec<(String, String)>,
    consent_text_version: String,
    universes: Vec<String>,
    follow: Vec<String>,
}

/// The shared values, read once at start.
#[derive(Debug, Clone)]
pub struct Policy {
    /// Header name and value, in the order of `src/headers.ts`.
    pub security_headers: Vec<(String, String)>,
    pub consent_text_version: String,
    pub universes: BTreeSet<String>,
    pub follow: BTreeSet<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct PolicyError;

impl std::fmt::Display for PolicyError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("server.policy_invalid")
    }
}

impl std::error::Error for PolicyError {}

/// Parses a policy document; an empty list or an unknown field is refused, never defaulted.
pub fn parse(text: &str) -> Result<Policy, PolicyError> {
    let raw: RawPolicy = serde_json::from_str(text).map_err(|_| PolicyError)?;
    if raw.security_headers.is_empty()
        || raw.universes.is_empty()
        || raw.follow.is_empty()
        || raw.consent_text_version.is_empty()
    {
        return Err(PolicyError);
    }
    Ok(Policy {
        security_headers: raw.security_headers,
        consent_text_version: raw.consent_text_version,
        universes: raw.universes.into_iter().collect(),
        follow: raw.follow.into_iter().collect(),
    })
}

/// The policy embedded in this binary.
pub fn embedded() -> Result<Policy, PolicyError> {
    parse(POLICY_JSON)
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
    fn the_embedded_policy_reads() {
        let policy = embedded().unwrap();
        assert!(
            policy
                .security_headers
                .iter()
                .any(|(name, _)| name == "Content-Security-Policy")
        );
        assert!(policy.universes.contains("apprendre"));
        assert!(policy.follow.contains("P07"));
    }

    #[test]
    fn an_empty_list_or_an_unknown_field_is_refused() {
        let empty =
            r#"{"securityHeaders":[],"consentTextVersion":"v","universes":["a"],"follow":["P01"]}"#;
        assert_eq!(parse(empty).unwrap_err(), PolicyError);
        let unknown = r#"{"securityHeaders":[["a","b"]],"consentTextVersion":"v","universes":["a"],"follow":["P01"],"x":1}"#;
        assert_eq!(parse(unknown).unwrap_err(), PolicyError);
    }
}
