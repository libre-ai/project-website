//! Request bodies as the reference reads them: `new TextDecoder().decode(bytes)` then
//! `new URLSearchParams(text)`.

/// `TextDecoder` in its default mode: a leading byte order mark is dropped and each invalid
/// sequence becomes U+FFFD (`String::from_utf8_lossy` keeps the mark).
pub fn decode_text(bytes: &[u8]) -> String {
    let body = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    String::from_utf8_lossy(body).into_owned()
}

/// `new URLSearchParams(text)`: the constructor drops one leading `?`, which
/// `form_urlencoded::parse` would read as part of the first name.
pub fn search_params(text: &str) -> Vec<(String, String)> {
    let query = text.strip_prefix('?').unwrap_or(text);
    form_urlencoded::parse(query.as_bytes())
        .map(|(name, value)| (name.into_owned(), value.into_owned()))
        .collect()
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
    fn drops_the_byte_order_mark_and_replaces_invalid_bytes() {
        assert_eq!(decode_text(b"\xEF\xBB\xBFa=1"), "a=1");
        assert_eq!(decode_text(b"a\xFFb"), "a\u{FFFD}b");
    }

    #[test]
    fn parses_like_url_search_params() {
        assert_eq!(
            search_params("?a=1&b=x+y&&c=%C3%A9&d"),
            vec![
                ("a".to_owned(), "1".to_owned()),
                ("b".to_owned(), "x y".to_owned()),
                ("c".to_owned(), "é".to_owned()),
                ("d".to_owned(), String::new()),
            ]
        );
    }
}
