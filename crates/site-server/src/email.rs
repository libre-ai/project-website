//! Email address normalisation for the waitlist (ADR 0006 §3), port of `server/email.ts`.
//! Two writings of the same address map to one row, and nothing that could break a mail header
//! passes. Only the domain is case-folded: RFC 5321 leaves the local part's case to the
//! receiving server, so lowercasing it could merge two different mailboxes.

use idna::AsciiDenyList;
use idna::uts46::{DnsLength, Hyphens, Uts46};

use crate::web::{is_js_whitespace, js_trim};

const MAX_ADDRESS_BYTES: usize = 254;
const MAX_LOCAL_BYTES: usize = 64;

/// The forbidden host code points of the WHATWG URL Standard. The `domainToASCII` of the
/// reference (Bun's `node:url`) refuses these and no others: `%`, `*` and `_` pass, unlike the
/// forbidden *domain* code points of `AsciiDenyList::URL` (measured on 2026-11-23, ADR 0009).
const FORBIDDEN_HOST: &str = "\0\t\n\r #/:<>?@[\\]^|";
const DENY: AsciiDenyList = AsciiDenyList::new(false, FORBIDDEN_HOST);

/// Control characters and any whitespace: they would allow header injection or hide a second
/// address. JavaScript's `charCodeAt(0) < 0x20 || === 0x7f || /\s/`.
fn has_forbidden_character(value: &str) -> bool {
    value.chars().any(|character| {
        u32::from(character) < 0x20 || character == '\u{7f}' || is_js_whitespace(character)
    })
}

/// The `node:url` `domainToASCII` of the reference, as Bun runs it: an empty string on failure.
/// An all-ASCII domain is returned as it is unless it holds a forbidden host code point — its
/// `xn--` labels are not decoded. Any other goes through UTS 46 (non-transitional, joiners and
/// bidi checked, hyphens and DNS lengths not), which does decode them.
fn domain_to_ascii(domain: &str) -> String {
    if domain.is_ascii() {
        return if domain
            .chars()
            .any(|character| FORBIDDEN_HOST.contains(character))
        {
            String::new()
        } else {
            domain.to_owned()
        };
    }
    match Uts46::new().to_ascii(domain.as_bytes(), DENY, Hyphens::Allow, DnsLength::Ignore) {
        Ok(ascii) => ascii.into_owned(),
        Err(_) => String::new(),
    }
}

/// The normalised address, or `None` when it is refused.
pub fn normalize_email(input: &str) -> Option<String> {
    let trimmed = js_trim(input);
    if has_forbidden_character(trimmed) {
        return None;
    }
    let parts: Vec<&str> = trimmed.split('@').collect();
    let [local, domain] = parts.as_slice() else {
        return None;
    };
    if local.is_empty() || domain.is_empty() || local.len() > MAX_LOCAL_BYTES {
        return None;
    }
    let ascii = domain_to_ascii(&domain.to_lowercase());
    if ascii.is_empty() || !ascii.contains('.') || ascii.split('.').any(str::is_empty) {
        return None;
    }
    let address = format!("{local}@{ascii}");
    (address.len() <= MAX_ADDRESS_BYTES).then_some(address)
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
    fn folds_the_domain_only() {
        assert_eq!(
            normalize_email(" Ana@Example.ORG ").as_deref(),
            Some("Ana@example.org")
        );
    }

    #[test]
    fn converts_an_international_domain() {
        assert_eq!(
            normalize_email("a@exämple.example").as_deref(),
            Some("a@xn--exmple-cua.example")
        );
        assert_eq!(
            normalize_email("a@b\u{3002}example").as_deref(),
            Some("a@b.example")
        );
    }

    #[test]
    fn refuses_what_could_break_a_header() {
        for input in [
            "a@b.example\r\nBcc: c@d.example",
            "a b@c.example",
            "a@b",
            "a@@b.example",
            "@b.example",
            "a@",
            "a@b..example",
            "a@.fr",
        ] {
            assert_eq!(normalize_email(input), None, "{input:?}");
        }
    }

    #[test]
    fn bounds_the_lengths_in_bytes() {
        let local = "é".repeat(33);
        assert_eq!(normalize_email(&format!("{local}@b.example")), None);
        let long = format!("a@{}.fr", "b".repeat(260));
        assert_eq!(normalize_email(&long), None);
    }

    /// Outputs of Bun's `domainToASCII` (Bun 1.4.0-canary.1+57f349f63), measured on 2026-11-23:
    /// the expected column comes from the reference, not from this port.
    #[test]
    fn converts_domains_as_the_reference_measured() {
        let measured: &[(&str, &str)] = &[
            ("xn--a.example", "xn--a.example"),
            ("exa%mple.fr", "exa%mple.fr"),
            ("a*b.fr", "a*b.fr"),
            ("a_b.example", "a_b.example"),
            ("-a.example", "-a.example"),
            ("a..b", "a..b"),
            ("0x7f.1", "0x7f.1"),
            ("1.2.3.256", "1.2.3.256"),
            ("xn--abc-.fr", "xn--abc-.fr"),
            ("[127.0.0.1]", ""),
            ("a<b.fr", ""),
            ("a^b.fr", ""),
            ("a|b.fr", ""),
            ("a#b.fr", ""),
            ("a?b.fr", ""),
            ("a/b.fr", ""),
            ("a:b.fr", ""),
            ("a\\b.fr", ""),
            ("a]b.fr", ""),
            ("faß.de", "xn--fa-hia.de"),
            ("☃.net", "xn--n3h.net"),
            ("a\u{00AD}b.fr", "ab.fr"),
            ("xn--münchen.de", ""),
            ("a\u{200D}b.fr", ""),
            ("a\u{200C}b.fr", ""),
            ("\u{0661}.fr", ""),
            ("é%.fr", "xn--%-9fa.fr"),
            ("é*.fr", "xn--*-9fa.fr"),
            ("é_.fr", "xn--_-9fa.fr"),
            ("xn--a.é.fr", ""),
            ("é.xn--a.fr", ""),
            ("é.xn--zca.fr", "xn--9ca.xn--zca.fr"),
            ("é..fr", "xn--9ca..fr"),
            ("-é.fr", "xn----bga.fr"),
            ("é-.fr", "xn----9fa.fr"),
            ("ab--é.fr", "xn--ab---epa.fr"),
            ("é<.fr", ""),
            ("é#.fr", ""),
            ("é.", "xn--9ca."),
            ("\u{3002}", "."),
            ("\u{FF0E}a.fr", ".a.fr"),
            ("ﬀ.fr", "ff.fr"),
            ("é.-a.fr", "xn--9ca.-a.fr"),
            ("é\u{0301}.fr", "xn--9ca68h.fr"),
            ("\u{0300}a.fr", ""),
            ("a\u{FFFD}b.fr", ""),
        ];
        for (domain, expected) in measured {
            assert_eq!(domain_to_ascii(domain), *expected, "{domain:?}");
        }
    }

    #[test]
    fn trims_and_refuses_like_javascript() {
        // U+FEFF is stripped by JavaScript's trim; U+0085 is neither stripped nor refused.
        assert_eq!(
            normalize_email("\u{FEFF}a@b.example").as_deref(),
            Some("a@b.example")
        );
        assert_eq!(
            normalize_email("a\u{0085}@b.example").as_deref(),
            Some("a\u{0085}@b.example")
        );
    }
}
