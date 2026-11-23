//! JavaScript string semantics the reference relies on, reproduced exactly. Each one has a
//! Rust look-alike that differs on some input: `str::trim` does not strip U+FEFF and strips
//! U+0085, `percent_decode` accepts a malformed escape, `str` ordering compares code points.

use std::cmp::Ordering;

use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, utf8_percent_encode};

/// ECMAScript WhiteSpace and LineTerminator: what `String.prototype.trim` strips and `/\s/`
/// matches. Unlike `char::is_whitespace`, it holds U+FEFF and not U+0085.
pub fn is_js_whitespace(character: char) -> bool {
    matches!(
        character,
        '\u{0009}'
            | '\u{000A}'
            | '\u{000B}'
            | '\u{000C}'
            | '\u{000D}'
            | '\u{0020}'
            | '\u{00A0}'
            | '\u{1680}'
            | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

/// `String.prototype.trim`.
pub fn js_trim(value: &str) -> &str {
    value.trim_matches(is_js_whitespace)
}

/// The order of JavaScript `<` and `Array.prototype.sort`: UTF-16 code units, which differs from
/// the code point order of `str` between an astral character and U+E000..U+FFFF.
pub fn utf16_order(left: &str, right: &str) -> Ordering {
    left.encode_utf16().cmp(right.encode_utf16())
}

/// The characters `encodeURIComponent` leaves as they are: `A-Z a-z 0-9 - _ . ! ~ * ' ( )`.
const URI_COMPONENT: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'!')
    .remove(b'~')
    .remove(b'*')
    .remove(b'\'')
    .remove(b'(')
    .remove(b')');

/// `encodeURIComponent` on a well-formed string.
pub fn encode_uri_component(value: &str) -> String {
    utf8_percent_encode(value, URI_COMPONENT).to_string()
}

/// `decodeURIComponent`: every `%` must start two hexadecimal digits and the decoded bytes must
/// be UTF-8, or the whole decoding fails (where `percent_decode` keeps a malformed escape).
pub fn decode_uri_component(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while let Some(&byte) = bytes.get(index) {
        if byte == b'%' {
            let high = bytes.get(index + 1).and_then(|digit| hex_value(*digit))?;
            let low = bytes.get(index + 2).and_then(|digit| hex_value(*digit))?;
            decoded.push(high * 16 + low);
            index += 3;
        } else {
            decoded.push(byte);
            index += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

fn hex_value(digit: u8) -> Option<u8> {
    match digit {
        b'0'..=b'9' => Some(digit - b'0'),
        b'a'..=b'f' => Some(digit - b'a' + 10),
        b'A'..=b'F' => Some(digit - b'A' + 10),
        _ => None,
    }
}

/// `escapeHtml` of `src/security.ts`.
pub fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
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
    fn trims_like_javascript() {
        assert_eq!(js_trim("\u{FEFF} a \u{3000}"), "a");
        // U+0085 is whitespace for Rust, not for JavaScript.
        assert_eq!(js_trim("\u{0085}a"), "\u{0085}a");
    }

    #[test]
    fn orders_like_javascript() {
        // "😀" < "｡" in JavaScript (UTF-16), the reverse in code point order.
        assert_eq!(utf16_order("😀", "｡"), Ordering::Less);
        assert_eq!("😀".cmp("｡"), Ordering::Greater);
    }

    #[test]
    fn encodes_like_encode_uri_component() {
        assert_eq!(
            encode_uri_component("a b/é!'()*~._-"),
            "a%20b%2F%C3%A9!'()*~._-"
        );
    }

    #[test]
    fn decodes_like_decode_uri_component() {
        assert_eq!(decode_uri_component("%2f%C3%A9").as_deref(), Some("/é"));
        assert_eq!(decode_uri_component("%E0%A4%A"), None);
        assert_eq!(decode_uri_component("%zz"), None);
        assert_eq!(decode_uri_component("%ED%A0%80"), None);
        assert_eq!(decode_uri_component("%"), None);
    }

    #[test]
    fn escapes_html() {
        assert_eq!(
            escape_html(r#"<a href="x">'&'"#),
            "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;"
        );
    }
}
