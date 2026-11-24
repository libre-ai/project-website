//! Structured server log (ADR 0006 §6), port of `server/log.ts`: one JSON line per event,
//! holding an event name and counts or codes. No address, token or client IP is ever passed;
//! as a last barrier, any value shaped like an email address is redacted before it is written.

use std::io::Write;
use std::sync::{Arc, Mutex};

const REDACTED: &str = "[retiré]";

pub enum Value {
    Count(u64),
    Code(String),
}

impl From<u64> for Value {
    fn from(count: u64) -> Self {
        Self::Count(count)
    }
}

impl From<&str> for Value {
    fn from(code: &str) -> Self {
        Self::Code(code.to_owned())
    }
}

/// Where lines go: standard output in production, a buffer in tests.
#[derive(Clone)]
pub enum Logger {
    Stdout,
    Memory(Arc<Mutex<Vec<String>>>),
}

fn json_string(value: &str) -> String {
    serde_json::Value::String(value.to_owned()).to_string()
}

/// `JSON.stringify({ event, ...fields })`, keys in the order given.
pub fn line(name: &str, fields: &[(&str, Value)]) -> String {
    let mut text = format!("{{\"event\":{}", json_string(name));
    for (key, value) in fields {
        let rendered = match value {
            Value::Count(count) => count.to_string(),
            Value::Code(code) if code.contains('@') => json_string(REDACTED),
            Value::Code(code) => json_string(code),
        };
        text.push_str(&format!(",{}:{rendered}", json_string(key)));
    }
    text.push('}');
    text
}

impl Logger {
    pub fn event(&self, name: &str, fields: &[(&str, Value)]) {
        let text = line(name, fields);
        match self {
            // A closed standard output must not stop the server: the line is lost, not fatal.
            Self::Stdout => {
                let mut stdout = std::io::stdout().lock();
                let _ = writeln!(stdout, "{text}");
                let _ = stdout.flush();
            }
            Self::Memory(lines) => match lines.lock() {
                Ok(mut guard) => guard.push(text),
                Err(poisoned) => poisoned.into_inner().push(text),
            },
        }
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
    fn redacts_any_value_shaped_like_an_address() {
        assert_eq!(
            line("x", &[("who", "a@example.org".into()), ("count", 2.into())]),
            r#"{"event":"x","who":"[retiré]","count":2}"#
        );
    }
}
