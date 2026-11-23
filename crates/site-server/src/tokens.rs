//! Confirmation and unsubscribe tokens (ADR 0006 §3), port of `server/tokens.ts`. A token
//! travels only in the message sent to the subscriber; the database keeps its SHA-256 digest, so
//! a read of the table cannot confirm or unsubscribe anyone.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use sha2::{Digest, Sha256};

const TOKEN_BYTES: usize = 32;

pub struct Token {
    pub token: String,
    pub hash: String,
}

/// Lowercase hexadecimal, as `digest("hex")`.
pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn hash_token(token: &str) -> String {
    hex(&Sha256::digest(token.as_bytes()))
}

#[derive(Debug)]
pub struct RandomUnavailable;

/// Bytes from the operating system's generator.
pub fn random_bytes<const N: usize>() -> Result<[u8; N], RandomUnavailable> {
    let mut bytes = [0_u8; N];
    getrandom::fill(&mut bytes).map_err(|_| RandomUnavailable)?;
    Ok(bytes)
}

pub fn new_token() -> Result<Token, RandomUnavailable> {
    let token = URL_SAFE_NO_PAD.encode(random_bytes::<TOKEN_BYTES>()?);
    let hash = hash_token(&token);
    Ok(Token { token, hash })
}

/// A random version 4 UUID, as `crypto.randomUUID()`.
pub fn random_uuid() -> Result<String, RandomUnavailable> {
    let mut bytes = random_bytes::<16>()?;
    if let Some(version) = bytes.get_mut(6) {
        *version = (*version & 0x0f) | 0x40;
    }
    if let Some(variant) = bytes.get_mut(8) {
        *variant = (*variant & 0x3f) | 0x80;
    }
    let text = hex(&bytes);
    let part = |range: std::ops::Range<usize>| text.get(range).unwrap_or_default();
    Ok(format!(
        "{}-{}-{}-{}-{}",
        part(0..8),
        part(8..12),
        part(12..16),
        part(16..20),
        part(20..32)
    ))
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
    fn a_token_is_43_base64url_characters_and_hashes_to_its_digest() {
        let token = new_token().unwrap();
        assert_eq!(token.token.len(), 43);
        assert!(
            token
                .token
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
        );
        assert_eq!(token.hash, hash_token(&token.token));
        assert_eq!(
            hash_token("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn a_uuid_has_the_version_4_layout() {
        let uuid = random_uuid().unwrap();
        assert_eq!(uuid.len(), 36);
        assert_eq!(uuid.as_bytes()[14], b'4');
        assert!(matches!(uuid.as_bytes()[19], b'8' | b'9' | b'a' | b'b'));
    }
}
