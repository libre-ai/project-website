//! Email address normalisation for the waitlist (ADR 0006 §3), port of `server/email.ts`.
//! Two writings of the same address map to one row, and nothing that could break a mail header
//! passes. Only the domain is case-folded: RFC 5321 leaves the local part's case to the
//! receiving server, so lowercasing it could merge two different mailboxes.

use idna::AsciiDenyList;
use idna::uts46::{DnsLength, Hyphens, Uts46};

use crate::web::{is_js_whitespace, js_trim};

const MAX_ADDRESS_BYTES: usize = 254;
const MAX_LOCAL_BYTES: usize = 64;

/// The forbidden host code points of the WHATWG URL Standard, plus `%`. The `domainToASCII` of
/// the pinned reference (Bun 1.4.0-canary.1) refuses the first and lets `%`, `*` and `_` pass;
/// Bun 1.4.4 refuses `%` and invalid `xn--` labels too. The port refuses both, as 1.4.4 does: a
/// domain with `%` or a broken punycode label cannot be a mailbox's (ADR 0009, admitted
/// divergence from the pinned reference, measured on 2026-11-23).
const FORBIDDEN: &str = "\0\t\n\r #/:<>?@[\\]^|%";
const DENY: AsciiDenyList = AsciiDenyList::new(false, FORBIDDEN);

/// Control characters and any whitespace: they would allow header injection or hide a second
/// address. JavaScript's `charCodeAt(0) < 0x20 || === 0x7f || /\s/`.
fn has_forbidden_character(value: &str) -> bool {
    value.chars().any(|character| {
        u32::from(character) < 0x20 || character == '\u{7f}' || is_js_whitespace(character)
    })
}

/// The `node:url` `domainToASCII` of the reference: an empty string on failure. Every domain
/// goes through UTS 46 (non-transitional, joiners and bidi checked, hyphens and DNS lengths
/// not), which validates `xn--` labels, ASCII or not. Where Bun versions differ, the port keeps
/// the stricter answer (see `converts_domains_as_the_reference_measured`).
fn domain_to_ascii(domain: &str) -> String {
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

    /// Outputs of Bun's `domainToASCII` under the pinned reference (1.4.0-canary.1+57f349f63)
    /// and under 1.4.4-canary.1+963452075, both measured on 2026-11-23: these two columns come
    /// from Bun, not from this port. The port follows the pinned reference except where it is
    /// stricter on purpose: `%` and invalid `xn--` labels are refused, as 1.4.4 refuses them
    /// (ADR 0009). Where 1.4.4 differs otherwise — IPv4 forms rewritten, a domain cut at `#`,
    /// `?`, `/` or `\`, percent escapes decoded — the port keeps the pinned reference.
    #[test]
    fn converts_domains_as_the_reference_measured() {
        // (input, pinned reference, Bun 1.4.4, port)
        let measured: &[(&str, &str, &str, &str)] = &[
            ("xn--a.example", "xn--a.example", "", ""),
            ("exa%mple.fr", "exa%mple.fr", "", ""),
            ("é%.fr", "xn--%-9fa.fr", "", ""),
            ("%.fr", "%.fr", "", ""),
            ("a%.fr", "a%.fr", "", ""),
            ("a%41b.fr", "a%41b.fr", "aab.fr", ""),
            ("a%2eb.fr", "a%2eb.fr", "a.b.fr", ""),
            (
                "ex%c3%a4mple.fr",
                "ex%c3%a4mple.fr",
                "xn--exmple-cua.fr",
                "",
            ),
            ("xn--abc-.fr", "xn--abc-.fr", "", ""),
            ("xn--.fr", "xn--.fr", "", ""),
            ("xn--a", "xn--a", "", ""),
            ("a.xn--a", "a.xn--a", "", ""),
            ("xn--abc-def.fr", "xn--abc-def.fr", "", ""),
            ("xn---.fr", "xn---.fr", "", ""),
            ("xn--a-.fr", "xn--a-.fr", "", ""),
            (
                "xn--zca.example",
                "xn--zca.example",
                "xn--zca.example",
                "xn--zca.example",
            ),
            ("xn--9ca.fr", "xn--9ca.fr", "xn--9ca.fr", "xn--9ca.fr"),
            ("0x7f.1", "0x7f.1", "127.0.0.1", "0x7f.1"),
            ("0x7f.0.0.1", "0x7f.0.0.1", "127.0.0.1", "0x7f.0.0.1"),
            ("1.2.3.256", "1.2.3.256", "", "1.2.3.256"),
            ("1.2.3.4", "1.2.3.4", "1.2.3.4", "1.2.3.4"),
            ("a#b.fr", "", "a", ""),
            ("a?b.fr", "", "a", ""),
            ("a/b.fr", "", "a", ""),
            ("a\\b.fr", "", "a", ""),
            ("é#.fr", "", "xn--9ca", ""),
            ("a*b.fr", "a*b.fr", "a*b.fr", "a*b.fr"),
            ("a_b.example", "a_b.example", "a_b.example", "a_b.example"),
            ("-a.example", "-a.example", "-a.example", "-a.example"),
            ("a..b", "a..b", "a..b", "a..b"),
            ("a-b.fr", "a-b.fr", "a-b.fr", "a-b.fr"),
            ("a~b.fr", "a~b.fr", "a~b.fr", "a~b.fr"),
            ("a!b.fr", "a!b.fr", "a!b.fr", "a!b.fr"),
            ("a$b.fr", "a$b.fr", "a$b.fr", "a$b.fr"),
            ("a&b.fr", "a&b.fr", "a&b.fr", "a&b.fr"),
            ("a'b.fr", "a'b.fr", "a'b.fr", "a'b.fr"),
            ("a(b.fr", "a(b.fr", "a(b.fr", "a(b.fr"),
            ("a+b.fr", "a+b.fr", "a+b.fr", "a+b.fr"),
            ("a,b.fr", "a,b.fr", "a,b.fr", "a,b.fr"),
            ("a;b.fr", "a;b.fr", "a;b.fr", "a;b.fr"),
            ("a=b.fr", "a=b.fr", "a=b.fr", "a=b.fr"),
            ("a\"b.fr", "a\"b.fr", "a\"b.fr", "a\"b.fr"),
            ("a`b.fr", "a`b.fr", "a`b.fr", "a`b.fr"),
            ("a{b.fr", "a{b.fr", "a{b.fr", "a{b.fr"),
            ("a}b.fr", "a}b.fr", "a}b.fr", "a}b.fr"),
            ("example.org", "example.org", "example.org", "example.org"),
            ("[127.0.0.1]", "", "", ""),
            ("a<b.fr", "", "", ""),
            ("a^b.fr", "", "", ""),
            ("a|b.fr", "", "", ""),
            ("a:b.fr", "", "", ""),
            ("a]b.fr", "", "", ""),
            ("faß.de", "xn--fa-hia.de", "xn--fa-hia.de", "xn--fa-hia.de"),
            ("☃.net", "xn--n3h.net", "xn--n3h.net", "xn--n3h.net"),
            ("a\u{00AD}b.fr", "ab.fr", "ab.fr", "ab.fr"),
            ("xn--münchen.de", "", "", ""),
            ("a\u{200D}b.fr", "", "", ""),
            ("a\u{200C}b.fr", "", "", ""),
            ("\u{0661}.fr", "", "", ""),
            ("é*.fr", "xn--*-9fa.fr", "xn--*-9fa.fr", "xn--*-9fa.fr"),
            ("é_.fr", "xn--_-9fa.fr", "xn--_-9fa.fr", "xn--_-9fa.fr"),
            ("xn--a.é.fr", "", "", ""),
            ("é.xn--a.fr", "", "", ""),
            (
                "é.xn--zca.fr",
                "xn--9ca.xn--zca.fr",
                "xn--9ca.xn--zca.fr",
                "xn--9ca.xn--zca.fr",
            ),
            ("é..fr", "xn--9ca..fr", "xn--9ca..fr", "xn--9ca..fr"),
            ("-é.fr", "xn----bga.fr", "xn----bga.fr", "xn----bga.fr"),
            ("é-.fr", "xn----9fa.fr", "xn----9fa.fr", "xn----9fa.fr"),
            (
                "ab--é.fr",
                "xn--ab---epa.fr",
                "xn--ab---epa.fr",
                "xn--ab---epa.fr",
            ),
            ("é<.fr", "", "", ""),
            ("é.", "xn--9ca.", "xn--9ca.", "xn--9ca."),
            ("\u{3002}", ".", ".", "."),
            ("\u{FF0E}a.fr", ".a.fr", ".a.fr", ".a.fr"),
            ("ﬀ.fr", "ff.fr", "ff.fr", "ff.fr"),
            ("é.-a.fr", "xn--9ca.-a.fr", "xn--9ca.-a.fr", "xn--9ca.-a.fr"),
            (
                "é\u{0301}.fr",
                "xn--9ca68h.fr",
                "xn--9ca68h.fr",
                "xn--9ca68h.fr",
            ),
            ("\u{0300}a.fr", "", "", ""),
            ("a\u{FFFD}b.fr", "", "", ""),
        ];
        for (domain, pinned, _bun_1_4_4, port) in measured {
            assert_eq!(domain_to_ascii(domain), *port, "{domain:?}");
            // The admitted divergence from the pinned reference stays narrow: only `%` and
            // `xn--`, and only towards a refusal.
            if port != pinned {
                assert!(
                    port.is_empty() && (domain.contains('%') || domain.contains("xn--")),
                    "{domain:?} diverges from the pinned reference outside the admitted rule"
                );
            }
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
