//! SMTP transport of the waitlist messages (ADR 0006 §7), second implementation of `Mailer`,
//! port of `server/smtp.ts` on `lettre`.
//!
//! The channel is always encrypted: implicit TLS on port 465, STARTTLS required on any other
//! port, certificate verified against the configured host. There is no fallback to clear text;
//! the only way out is `allow_insecure_local`, accepted for a loopback relay alone. A failed send
//! is named by a code and never by the relay's own words: a reply can quote the recipient
//! address, which must stay out of the logs (ADR 0006 §6). This module logs nothing.

use std::time::Duration;

use lettre::address::{Address, Envelope};
use lettre::transport::smtp::authentication::{Credentials, Mechanism};
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::transport::smtp::extension::ClientId;
use lettre::{AsyncSmtpTransport, AsyncTransport, Tokio1Executor};
use time::OffsetDateTime;

use crate::mailer::{MailError, Mailer, SendFuture, sender_address};
use crate::messages::{MailMessage, to_rfc5322};
use crate::tokens::random_uuid;

const DEFAULT_PORT: u16 = 587;
const IMPLICIT_TLS_PORT: u16 = 465;
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_TIMEOUT_MS: u64 = (1 << 31) - 1;
const LOOPBACK_HOSTS: [&str; 3] = ["localhost", "127.0.0.1", "::1"];

#[derive(Debug, Clone, Default)]
pub struct SmtpConfig {
    pub host: String,
    /// 587 when absent. 465 means implicit TLS, any other port means STARTTLS.
    pub port: Option<u32>,
    pub user: Option<String>,
    pub password: Option<String>,
    /// Lets a loopback relay without STARTTLS be spoken to in clear. No effect on port 465.
    pub allow_insecure_local: bool,
    /// Longest wait for one reply of the relay, 30000 when absent, in 1..2^31-1.
    pub timeout_ms: Option<u64>,
}

pub struct SmtpMailer {
    host: String,
    port: u16,
    credentials: Option<Credentials>,
    clear_allowed: bool,
    timeout: Duration,
}

/// Printable ASCII without brackets, one `@`: an address outside it needs SMTPUTF8, never
/// negotiated here.
fn is_envelope_address(address: &str) -> bool {
    let printable = address
        .bytes()
        .all(|byte| (0x21..=0x7e).contains(&byte) && byte != b'<' && byte != b'>');
    let mut parts = address.split('@');
    printable
        && matches!((parts.next(), parts.next(), parts.next()), (Some(local), Some(domain), None) if !local.is_empty() && !domain.is_empty())
}

fn envelope_address(address: &str, code: &'static str) -> Result<Address, MailError> {
    if !is_envelope_address(address) {
        return Err(MailError(code));
    }
    let (local, domain) = address.split_once('@').ok_or(MailError(code))?;
    // Validated just above with the reference's own rule, which `Address::new` does not share.
    Ok(Address::new_dangerous(local, domain))
}

impl SmtpMailer {
    /// Refuses an invalid configuration with a named code, before any connection.
    pub fn new(config: SmtpConfig) -> Result<Self, MailError> {
        if config.host.is_empty() {
            return Err(MailError("mail.smtp_host_missing"));
        }
        let port = u16::try_from(config.port.unwrap_or(u32::from(DEFAULT_PORT)))
            .ok()
            .filter(|port| *port >= 1)
            .ok_or(MailError("mail.smtp_port_invalid"))?;
        let credentials = match (config.user, config.password) {
            (None, None) => None,
            (Some(user), Some(password)) => Some(Credentials::new(user, password)),
            _ => return Err(MailError("mail.smtp_auth_incomplete")),
        };
        if config.allow_insecure_local
            && !LOOPBACK_HOSTS.contains(&config.host.to_lowercase().as_str())
        {
            return Err(MailError("mail.smtp_insecure_not_local"));
        }
        let timeout_ms = config.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS);
        if !(1..=MAX_TIMEOUT_MS).contains(&timeout_ms) {
            return Err(MailError("mail.smtp_timeout_invalid"));
        }
        Ok(Self {
            host: config.host,
            port,
            credentials,
            clear_allowed: config.allow_insecure_local,
            timeout: Duration::from_millis(timeout_ms),
        })
    }

    fn transport(&self, hello: &str) -> Result<AsyncSmtpTransport<Tokio1Executor>, MailError> {
        let parameters = TlsParameters::new_rustls(self.host.clone())
            .map_err(|_| MailError("mail.smtp_connection_failed"))?;
        let tls = if self.port == IMPLICIT_TLS_PORT {
            Tls::Wrapper(parameters)
        } else if self.clear_allowed {
            Tls::Opportunistic(parameters)
        } else {
            Tls::Required(parameters)
        };
        let mut builder =
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(self.host.clone())
                .port(self.port)
                .tls(tls)
                .timeout(Some(self.timeout))
                .hello_name(ClientId::Domain(hello.to_owned()));
        if let Some(credentials) = &self.credentials {
            builder = builder
                .credentials(credentials.clone())
                .authentication(vec![Mechanism::Plain]);
        }
        Ok(builder.build())
    }
}

fn failure(error: &lettre::transport::smtp::Error) -> MailError {
    if error.is_timeout() {
        MailError("mail.smtp_timeout")
    } else if error.is_response() || error.is_permanent() || error.is_transient() {
        MailError("mail.smtp_rejected")
    } else {
        MailError("mail.smtp_connection_failed")
    }
}

impl Mailer for SmtpMailer {
    fn send(&self, message: MailMessage) -> SendFuture {
        // Everything that can be refused without the relay is refused before a socket is opened.
        let prepared = (|| {
            let sender = sender_address(&message.from)?;
            let from = envelope_address(&sender, "mail.sender_invalid")?;
            let domain = from.domain().to_owned();
            let uuid = random_uuid().map_err(|_| MailError("mail.random_unavailable"))?;
            let raw = to_rfc5322(
                &message,
                OffsetDateTime::now_utc(),
                &format!("<{uuid}@{domain}>"),
            )
            .map_err(|error| MailError(error.code()))?;
            // The recipient also goes into the envelope, where a bracket or a space would add a
            // parameter to the command.
            if message.to.contains(|c: char| {
                c == '<' || c == '>' || crate::web::is_js_whitespace(c) || c.is_control()
            }) {
                return Err(MailError("mail.header_injection"));
            }
            let to = envelope_address(&message.to, "mail.recipient_invalid")?;
            let envelope = Envelope::new(Some(from), vec![to])
                .map_err(|_| MailError("mail.recipient_invalid"))?;
            Ok((self.transport(&domain)?, envelope, raw))
        })();
        Box::pin(async move {
            let (transport, envelope, raw) = prepared?;
            transport
                .send_raw(&envelope, raw.as_bytes())
                .await
                .map_err(|error| failure(&error))?;
            Ok(())
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
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
    use tokio::net::TcpListener;

    use super::*;
    use crate::messages::confirmation_message;

    fn config(host: &str) -> SmtpConfig {
        SmtpConfig {
            host: host.to_owned(),
            ..SmtpConfig::default()
        }
    }

    #[test]
    fn refuses_an_invalid_configuration() {
        let code = |config: SmtpConfig| SmtpMailer::new(config).err().map(|error| error.0);
        assert_eq!(code(config("")), Some("mail.smtp_host_missing"));
        assert_eq!(
            code(SmtpConfig {
                port: Some(0),
                ..config("h")
            }),
            Some("mail.smtp_port_invalid")
        );
        assert_eq!(
            code(SmtpConfig {
                port: Some(70_000),
                ..config("h")
            }),
            Some("mail.smtp_port_invalid")
        );
        assert_eq!(
            code(SmtpConfig {
                user: Some("u".into()),
                ..config("h")
            }),
            Some("mail.smtp_auth_incomplete")
        );
        assert_eq!(
            code(SmtpConfig {
                allow_insecure_local: true,
                ..config("relay.example")
            }),
            Some("mail.smtp_insecure_not_local")
        );
        assert_eq!(
            code(SmtpConfig {
                timeout_ms: Some(0),
                ..config("h")
            }),
            Some("mail.smtp_timeout_invalid")
        );
        assert!(
            SmtpMailer::new(SmtpConfig {
                allow_insecure_local: true,
                ..config("LOCALHOST")
            })
            .is_ok()
        );
    }

    /// A relay on the loopback that announces no STARTTLS and records every command it reads.
    async fn clear_relay() -> (u16, tokio::task::JoinHandle<Vec<String>>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let relay = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let (read, mut write) = socket.into_split();
            let mut lines = BufReader::new(read).lines();
            let mut seen = Vec::new();
            write.write_all(b"220 relay\r\n").await.unwrap();
            let mut in_data = false;
            while let Ok(Some(line)) = lines.next_line().await {
                seen.push(line.clone());
                let reply: &[u8] = if in_data {
                    if line == "." {
                        in_data = false;
                        b"250 queued\r\n"
                    } else {
                        continue;
                    }
                } else if line.starts_with("EHLO") {
                    b"250-relay\r\n250 8BITMIME\r\n"
                } else if line == "DATA" {
                    in_data = true;
                    b"354 go\r\n"
                } else if line == "QUIT" {
                    write.write_all(b"221 bye\r\n").await.ok();
                    break;
                } else {
                    b"250 ok\r\n"
                };
                if write.write_all(reply).await.is_err() {
                    break;
                }
            }
            seen
        });
        (port, relay)
    }

    fn message() -> MailMessage {
        confirmation_message(
            "Libre IA <liste@libre-ia.example>",
            "a@example.org",
            "https://x/c",
            "https://x/d",
        )
    }

    #[tokio::test]
    async fn sends_in_clear_to_a_loopback_relay_only_when_allowed() {
        let (port, relay) = clear_relay().await;
        let mailer = SmtpMailer::new(SmtpConfig {
            port: Some(u32::from(port)),
            allow_insecure_local: true,
            timeout_ms: Some(5000),
            ..config("127.0.0.1")
        })
        .unwrap();
        mailer.send(message()).await.unwrap();
        let seen = relay.await.unwrap();
        assert_eq!(seen[0], "EHLO libre-ia.example");
        // lettre adds `BODY=8BITMIME` when the relay announces it.
        assert!(
            seen.iter()
                .any(|line| line.starts_with("MAIL FROM:<liste@libre-ia.example>")),
            "{seen:?}"
        );
        assert!(seen.contains(&"RCPT TO:<a@example.org>".to_owned()));
        assert!(
            seen.iter()
                .any(|line| line == "List-Unsubscribe-Post: List-Unsubscribe=One-Click")
        );
    }

    #[tokio::test]
    async fn never_falls_back_to_clear_text_without_starttls() {
        let (port, relay) = clear_relay().await;
        let mailer = SmtpMailer::new(SmtpConfig {
            port: Some(u32::from(port)),
            timeout_ms: Some(5000),
            ..config("127.0.0.1")
        })
        .unwrap();
        assert!(mailer.send(message()).await.is_err());
        let seen = relay.await.unwrap();
        assert!(
            !seen
                .iter()
                .any(|line| line.starts_with("MAIL FROM") || line.starts_with("AUTH"))
        );
    }

    #[tokio::test]
    async fn refuses_an_envelope_breaker_before_connecting() {
        let mailer = SmtpMailer::new(SmtpConfig {
            allow_insecure_local: true,
            ..config("localhost")
        })
        .unwrap();
        let mut bad = message();
        bad.to = "a@example.org> NOTIFY=NEVER".to_owned();
        assert_eq!(
            mailer.send(bad).await,
            Err(MailError("mail.header_injection"))
        );
        let mut non_ascii = message();
        non_ascii.to = "é@example.org".to_owned();
        assert_eq!(
            mailer.send(non_ascii).await,
            Err(MailError("mail.recipient_invalid"))
        );
    }
}
