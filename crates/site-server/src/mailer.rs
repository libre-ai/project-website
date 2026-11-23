//! Sending waitlist messages (ADR 0006 §7), port of `server/mailer.ts`: the `Mailer` interface
//! and the local outbox, which writes each message as an RFC 5322 file read by the demo and the
//! end-to-end tests. The SMTP transport is the second implementation, in `smtp.rs`.

use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use time::OffsetDateTime;

use crate::messages::{MailMessage, to_rfc5322};
use crate::tokens::random_uuid;
use crate::web::is_js_whitespace;

/// A failed send, named by a code; never the words of a relay, which can quote an address.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MailError(pub &'static str);

pub type SendFuture = Pin<Box<dyn Future<Output = Result<(), MailError>> + Send + 'static>>;

pub trait Mailer: Send + Sync {
    /// Starts sending; everything that orders the messages happens before the future is returned.
    fn send(&self, message: MailMessage) -> SendFuture;
}

/// The domain of a sender written `Name <a@b>` or `a@b`: JavaScript `/@([^>\s]+)>?\s*$/`, the
/// first `@` whose remainder matches.
pub fn sender_domain(from: &str) -> Result<String, MailError> {
    for (index, _) in from.match_indices('@') {
        let rest = from.get(index + 1..).unwrap_or_default();
        let rest = rest.trim_end_matches(is_js_whitespace);
        let rest = rest.strip_suffix('>').unwrap_or(rest);
        if !rest.is_empty()
            && !rest.contains(|character: char| character == '>' || is_js_whitespace(character))
        {
            return Ok(rest.to_owned());
        }
    }
    Err(MailError("mail.sender_invalid"))
}

fn is_cc(character: char) -> bool {
    character.is_control()
}

/// The address of a sender written `Name <a@b>` or `a@b`. It goes into the SMTP envelope, so
/// anything that could end the command or add a parameter to it is refused.
pub fn sender_address(from: &str) -> Result<String, MailError> {
    let bracketed = from
        .trim_end_matches(is_js_whitespace)
        .strip_suffix('>')
        .and_then(|head| {
            head.rfind('<')
                .map(|start| head.get(start + 1..).unwrap_or_default())
        })
        .filter(|inner| !inner.contains(['<', '>']));
    let address = match bracketed {
        Some(inner) => inner.to_owned(),
        None => crate::web::js_trim(from).to_owned(),
    };
    let valid_part = |part: &str| {
        !part.is_empty()
            && !part.contains(|c: char| {
                c == '<' || c == '>' || c == '@' || is_js_whitespace(c) || is_cc(c)
            })
    };
    match address.split_once('@') {
        Some((local, domain)) if valid_part(local) && valid_part(domain) => Ok(address),
        _ => Err(MailError("mail.sender_invalid")),
    }
}

/// The local outbox: one `.eml` file per message, named by its order and its date.
pub struct OutboxMailer {
    directory: PathBuf,
    sequence: Arc<AtomicU64>,
    clock: fn() -> OffsetDateTime,
}

impl OutboxMailer {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            sequence: Arc::new(AtomicU64::new(0)),
            clock: OffsetDateTime::now_utc,
        }
    }
}

/// `date.toISOString().replaceAll(":", "-")`: `2026-11-23T10-00-00.000Z`.
fn file_stamp(date: OffsetDateTime) -> String {
    let utc = date.to_offset(time::UtcOffset::UTC);
    format!(
        "{:04}-{:02}-{:02}T{:02}-{:02}-{:02}.{:03}Z",
        utc.year(),
        u8::from(utc.month()),
        utc.day(),
        utc.hour(),
        utc.minute(),
        utc.second(),
        utc.millisecond()
    )
}

impl Mailer for OutboxMailer {
    fn send(&self, message: MailMessage) -> SendFuture {
        let sequence = self.sequence.fetch_add(1, Ordering::SeqCst) + 1;
        let date = (self.clock)();
        let directory = self.directory.clone();
        Box::pin(async move {
            let domain = sender_domain(&message.from)?;
            let uuid = random_uuid().map_err(|_| MailError("mail.random_unavailable"))?;
            let raw = to_rfc5322(&message, date, &format!("<{uuid}@{domain}>"))
                .map_err(|error| MailError(error.code()))?;
            let name = format!("{sequence:04}-{}.eml", file_stamp(date));
            tokio::fs::create_dir_all(&directory)
                .await
                .map_err(|_| MailError("mail.outbox_unwritable"))?;
            tokio::fs::write(directory.join(name), raw)
                .await
                .map_err(|_| MailError("mail.outbox_unwritable"))
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

    #[test]
    fn reads_the_sender_domain_like_the_reference() {
        assert_eq!(
            sender_domain("Libre IA <liste@libre-ia.example>").unwrap(),
            "libre-ia.example"
        );
        assert_eq!(sender_domain("a@b.example ").unwrap(), "b.example");
        assert_eq!(sender_domain("a@b@c").unwrap(), "b@c");
        assert_eq!(
            sender_domain("no address"),
            Err(MailError("mail.sender_invalid"))
        );
    }

    #[test]
    fn reads_the_sender_address_and_refuses_an_envelope_breaker() {
        assert_eq!(
            sender_address("Libre IA <liste@libre-ia.example>").unwrap(),
            "liste@libre-ia.example"
        );
        assert_eq!(sender_address(" a@b.example ").unwrap(), "a@b.example");
        for from in [
            "a b@c.example",
            "<a@b@c>",
            "x <a@b.example> SIZE=1",
            "a@b\u{0}c",
        ] {
            assert!(sender_address(from).is_err(), "{from:?}");
        }
    }

    #[test]
    fn stamps_files_like_to_iso_string() {
        let date = OffsetDateTime::from_unix_timestamp_nanos(1_795_420_800_123_456_789).unwrap();
        assert_eq!(file_stamp(date), "2026-11-23T08-00-00.123Z");
    }

    #[tokio::test]
    async fn writes_numbered_files_in_call_order() {
        let directory = std::env::temp_dir().join(format!("outbox-{}", random_uuid().unwrap()));
        let mailer = OutboxMailer::new(directory.clone());
        let message =
            crate::messages::confirmation_message("L <l@x.example>", "a@b.example", "c", "d");
        let first = mailer.send(message.clone());
        let second = mailer.send(message);
        second.await.unwrap();
        first.await.unwrap();
        let mut names: Vec<String> = std::fs::read_dir(&directory)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        names.sort();
        assert!(names[0].starts_with("0001-") && names[1].starts_with("0002-"));
        let raw = std::fs::read_to_string(directory.join(&names[0])).unwrap();
        assert!(raw.contains("@x.example>\r\n"));
        std::fs::remove_dir_all(directory).unwrap();
    }
}
