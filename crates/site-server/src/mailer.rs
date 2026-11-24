//! Sending waitlist messages (ADR 0006 §7), port of `server/mailer.ts`: the `Mailer` interface
//! and the local outbox, which writes each message as an RFC 5322 file read by the demo and the
//! end-to-end tests. The SMTP transport is the second implementation, in `smtp.rs`.

use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::time::Duration;

use time::OffsetDateTime;
use tokio::sync::{Notify, Semaphore, mpsc};

use crate::log::Logger;
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

/// Sends queued or started and not finished, so a stop can wait for them instead of dropping a
/// message.
#[derive(Clone, Default)]
pub struct InFlight {
    count: Arc<AtomicUsize>,
    idle: Arc<Notify>,
}

pub struct InFlightGuard(InFlight);

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        if self.0.count.fetch_sub(1, Ordering::SeqCst) == 1 {
            self.0.idle.notify_waiters();
        }
    }
}

impl InFlight {
    pub fn start(&self) -> InFlightGuard {
        self.count.fetch_add(1, Ordering::SeqCst);
        InFlightGuard(self.clone())
    }

    /// Waits until no send is in flight, or the bound has passed; true when none is left.
    pub async fn settled(&self, bound: Duration) -> bool {
        let wait = async {
            loop {
                let idle = self.idle.notified();
                if self.count.load(Ordering::SeqCst) == 0 {
                    return;
                }
                idle.await;
            }
        };
        tokio::time::timeout(bound, wait).await.is_ok()
    }
}

/// Messages waiting for the dispatcher. Past this, a message is dropped and logged: the request
/// stays pending and a new subscription sends again.
pub const MAIL_QUEUE_CAPACITY: usize = 1024;

/// Sends under way at once. lettre is built without its `pool` feature, so each SMTP send opens
/// its own connection to the relay (ADR 0009); this bounds those connections.
pub const MAX_SENDS_UNDER_WAY: usize = 4;

struct Queued {
    message: MailMessage,
    _guard: InFlightGuard,
}

/// The only way a request starts a send. The request hands the message over and returns; the
/// dispatcher task, one for the process, calls `Mailer::send` — whose synchronous part may
/// block (a relay's preparation) — on the blocking pool, in arrival order, so the outbox
/// numbering and any relay preparation stay out of the request path (ADR 0006 §4: the answer
/// time must not depend on whether a send happens).
#[derive(Clone)]
pub struct MailQueue {
    sender: mpsc::Sender<Queued>,
    in_flight: InFlight,
}

impl MailQueue {
    /// Starts the dispatcher on the current runtime, with the served bounds.
    pub fn start(mailer: Arc<dyn Mailer>, in_flight: InFlight, logger: Logger) -> Self {
        Self::with_limits(
            mailer,
            in_flight,
            logger,
            MAIL_QUEUE_CAPACITY,
            MAX_SENDS_UNDER_WAY,
        )
    }

    /// `capacity` messages may wait, and at most `max_sends` are under way at once: the
    /// dispatcher takes the next message only once a send has a place, so a slow relay fills the
    /// queue (then `mail.dropped`) instead of opening ever more connections.
    pub fn with_limits(
        mailer: Arc<dyn Mailer>,
        in_flight: InFlight,
        logger: Logger,
        capacity: usize,
        max_sends: usize,
    ) -> Self {
        let (sender, mut receiver) = mpsc::channel::<Queued>(capacity);
        let places = Arc::new(Semaphore::new(max_sends));
        tokio::spawn(async move {
            while let Some(Queued { message, _guard }) = receiver.recv().await {
                // The semaphore is never closed, so this only waits for a place.
                let Ok(place) = places.clone().acquire_owned().await else {
                    break;
                };
                let mailer = mailer.clone();
                let logger = logger.clone();
                match tokio::task::spawn_blocking(move || mailer.send(message)).await {
                    Ok(sending) => {
                        tokio::spawn(async move {
                            if sending.await.is_err() {
                                logger.event("mail.failed", &[]);
                            }
                            drop(place);
                            drop(_guard);
                        });
                    }
                    Err(_) => logger.event("mail.failed", &[]),
                }
            }
        });
        Self { sender, in_flight }
    }

    /// The sends this queue holds or started, for a stop to wait on.
    pub fn in_flight(&self) -> &InFlight {
        &self.in_flight
    }

    /// Hands the message over without waiting; false when the queue is full or closed.
    pub fn enqueue(&self, message: MailMessage) -> bool {
        let queued = Queued {
            message,
            _guard: self.in_flight.start(),
        };
        self.sender.try_send(queued).is_ok()
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

    /// A relay that holds each send until `gate` gives it a permit, and counts the sends under
    /// way at once.
    struct SlowRelay {
        gate: Arc<Semaphore>,
        under_way: Arc<AtomicUsize>,
        most: Arc<AtomicUsize>,
    }

    impl Mailer for SlowRelay {
        fn send(&self, _message: MailMessage) -> SendFuture {
            let gate = self.gate.clone();
            let under_way = self.under_way.clone();
            let most = self.most.clone();
            Box::pin(async move {
                let now = under_way.fetch_add(1, Ordering::SeqCst) + 1;
                most.fetch_max(now, Ordering::SeqCst);
                gate.acquire().await.unwrap().forget();
                under_way.fetch_sub(1, Ordering::SeqCst);
                Ok(())
            })
        }
    }

    #[tokio::test]
    async fn bounds_the_sends_under_way_at_once() {
        let gate = Arc::new(Semaphore::new(0));
        let under_way = Arc::new(AtomicUsize::new(0));
        let most = Arc::new(AtomicUsize::new(0));
        let relay = Arc::new(SlowRelay {
            gate: gate.clone(),
            under_way: under_way.clone(),
            most: most.clone(),
        });
        let lines = Arc::new(std::sync::Mutex::new(Vec::new()));
        let queue = MailQueue::with_limits(
            relay,
            InFlight::default(),
            Logger::Memory(lines.clone()),
            16,
            2,
        );
        let message =
            crate::messages::confirmation_message("L <l@x.example>", "a@b.example", "c", "d");
        for _ in 0..6 {
            assert!(queue.enqueue(message.clone()));
        }
        // Two start, then nothing more however long the relay takes.
        for _ in 0..100 {
            if under_way.load(Ordering::SeqCst) == 2 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
        assert_eq!(most.load(Ordering::SeqCst), 2);
        gate.add_permits(6);
        assert!(queue.in_flight().settled(Duration::from_secs(5)).await);
        assert_eq!(most.load(Ordering::SeqCst), 2);
        assert!(lines.lock().unwrap().is_empty());
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
