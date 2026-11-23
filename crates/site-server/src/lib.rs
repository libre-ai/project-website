//! The served runtime of `libre-ia.fr` (ADR 0006, amended by ADR 0009): one process serves the
//! generated site with the security header policy and holds the waitlist's only dynamic routes.
//!
//! Its observable behaviour is the one of the Bun reference (`server/http.ts`), proved route by
//! route by the parity test (`server/parity.test.ts`). Where this code reproduces a JavaScript
//! semantics on purpose (string trimming, `URLSearchParams`, `decodeURIComponent`, UTF-16
//! ordering), the function says so: a "simpler" Rust equivalent would change what is stored.
#![forbid(unsafe_code)]

pub mod config;
pub mod email;
pub mod form;
pub mod http;
pub mod limiter;
pub mod log;
pub mod mailer;
pub mod messages;
pub mod policy;
pub mod server;
pub mod site;
pub mod smtp;
pub mod store;
pub mod subscription;
pub mod tokens;
pub mod web;
