//! Waitlist messages (ADR 0006 §4), port of `server/messages.ts`. The confirmation message
//! carries the one-click unsubscribe headers of RFC 8058 so a mail client can offer leaving the
//! list without opening a page. The sender address is a setting of the deployment.

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc2822;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MailMessage {
    pub from: String,
    pub to: String,
    pub subject: String,
    pub text: String,
    /// Extra headers, in order.
    pub headers: Vec<(String, String)>,
}

pub fn confirmation_message(
    from: &str,
    to: &str,
    confirm_url: &str,
    unsubscribe_url: &str,
) -> MailMessage {
    let text = [
        "Bonjour,",
        "",
        "Vous avez demandé à rejoindre la liste d'attente de Libre IA.",
        "Pour confirmer, ouvrez ce lien dans les 48 heures :",
        confirm_url,
        "",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message :",
        "sans confirmation, votre adresse sera effacée.",
        "",
        "Pour quitter la liste à tout moment :",
        unsubscribe_url,
        "",
        "Libre IA, ce que chacun réinvente seul, faisons-le ensemble.",
        "",
    ]
    .join("\n");
    MailMessage {
        from: from.to_owned(),
        to: to.to_owned(),
        subject: "Confirmez votre inscription à Libre IA".to_owned(),
        text,
        headers: vec![
            (
                "List-Unsubscribe".to_owned(),
                format!("<{unsubscribe_url}>"),
            ),
            (
                "List-Unsubscribe-Post".to_owned(),
                "List-Unsubscribe=One-Click".to_owned(),
            ),
        ],
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageError {
    HeaderInjection,
    DateUnrepresentable,
}

impl MessageError {
    pub fn code(self) -> &'static str {
        match self {
            Self::HeaderInjection => "mail.header_injection",
            Self::DateUnrepresentable => "mail.date_invalid",
        }
    }
}

fn header_value(value: &str) -> Result<&str, MessageError> {
    // A CR or LF would end the header and let the value add its own headers or recipients.
    if value.contains(['\r', '\n']) {
        return Err(MessageError::HeaderInjection);
    }
    Ok(value)
}

fn encode_word(value: &str) -> String {
    format!("=?UTF-8?B?{}?=", STANDARD.encode(value.as_bytes()))
}

/// `date.toUTCString()` with ` GMT` written `+0000`: `Mon, 23 Nov 2026 10:00:00 +0000`.
pub fn rfc5322_date(date: OffsetDateTime) -> Result<String, MessageError> {
    date.to_offset(time::UtcOffset::UTC)
        .format(&Rfc2822)
        .map_err(|_| MessageError::DateUnrepresentable)
}

/// `/\r?\n/g` replaced by CRLF.
fn crlf(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\n', "\r\n")
}

pub fn to_rfc5322(
    message: &MailMessage,
    date: OffsetDateTime,
    message_id: &str,
) -> Result<String, MessageError> {
    let mut headers: Vec<(&str, String)> = vec![
        ("From", message.from.clone()),
        ("To", message.to.clone()),
        ("Subject", encode_word(&message.subject)),
        ("Date", rfc5322_date(date)?),
        ("Message-ID", message_id.to_owned()),
        ("MIME-Version", "1.0".to_owned()),
        ("Content-Type", "text/plain; charset=utf-8".to_owned()),
        ("Content-Transfer-Encoding", "8bit".to_owned()),
    ];
    headers.extend(
        message
            .headers
            .iter()
            .map(|(name, value)| (name.as_str(), value.clone())),
    );
    let mut head = Vec::with_capacity(headers.len());
    for (name, value) in &headers {
        head.push(format!("{name}: {}", header_value(value)?));
    }
    Ok(format!(
        "{}\r\n\r\n{}",
        head.join("\r\n"),
        crlf(&message.text)
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

    fn date() -> OffsetDateTime {
        OffsetDateTime::from_unix_timestamp(1_795_420_800).unwrap()
    }

    #[test]
    fn writes_the_headers_in_order_with_crlf() {
        let message = confirmation_message(
            "Libre IA <l@x.example>",
            "a@b.example",
            "https://x/c",
            "https://x/d",
        );
        let raw = to_rfc5322(&message, date(), "<id@x.example>").unwrap();
        assert!(
            raw.starts_with(
                "From: Libre IA <l@x.example>\r\nTo: a@b.example\r\nSubject: =?UTF-8?B?"
            )
        );
        assert!(raw.contains("\r\nDate: Mon, 23 Nov 2026 08:00:00 +0000\r\n"));
        assert!(raw.contains("\r\nList-Unsubscribe: <https://x/d>\r\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n\r\nBonjour,\r\n"));
        assert!(!raw.replace("\r\n", "").contains('\n'));
    }

    #[test]
    fn refuses_a_header_value_with_a_line_break() {
        let message =
            confirmation_message("a@x.example", "a@b.example\r\nBcc: c@d.example", "u", "v");
        assert_eq!(
            to_rfc5322(&message, date(), "<i>"),
            Err(MessageError::HeaderInjection)
        );
    }
}
