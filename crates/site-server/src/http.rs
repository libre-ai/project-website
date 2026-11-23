//! The routes of the site (ADR 0006), port of `createServer` in `server/http.ts`: the generated
//! files with the security header policy, and the waitlist's only dynamic routes. Mirror hosts
//! are redirected to the canonical origin, any other host is refused. A subscription answers the
//! same way whether the address is new, pending or confirmed, so the form reveals nothing about
//! who is on the list.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use axum::response::Response;
use time::OffsetDateTime;
use url::Url;

use crate::form::{decode_text, search_params};
use crate::limiter::{Limiter, client_key};
use crate::log::Logger;
use crate::mailer::MailQueue;
use crate::messages::confirmation_message;
use crate::policy::Policy;
use crate::site::{HTML, Site, none_match_hits, resolve_path};
use crate::store::{RequestOutcome, Store};
use crate::subscription::{Refusal, parse_subscription};
use crate::tokens::{hash_token, new_token};
use crate::web::{encode_uri_component, escape_html, js_trim};

const MAX_FORM_BYTES: usize = 4096;
/// The largest body read at all, the `maxRequestBodySize` of the reference.
const MAX_REQUEST_BYTES: usize = 64 * 1024;
const ONE_CLICK: &str = "List-Unsubscribe=One-Click";
/// The limit of the demo and of production: five waitlist requests per client in ten minutes.
pub const RATE_LIMIT: u32 = 5;
pub const RATE_WINDOW_MS: i64 = 10 * 60 * 1000;

pub struct App {
    pub site: Site,
    /// Canonical origin, used for message links and redirects, e.g. `https://libre-ia.fr`.
    pub origin: String,
    pub canonical_host: String,
    /// Hosts answered with a permanent redirect to the canonical origin.
    pub redirect_hosts: Vec<String>,
    pub store: Arc<dyn Store>,
    /// The only way a request starts a send (`MailQueue`): nothing of the send runs before the
    /// answer.
    pub mail: MailQueue,
    /// Sender of the waitlist messages, a deployment setting.
    pub from: String,
    pub limiter: Limiter,
    pub logger: Logger,
    pub policy: Policy,
    pub clock: fn() -> OffsetDateTime,
}

/// The origin and host name of a configured origin, as `new URL(origin)` reads them.
pub fn canonical(origin: &str) -> Option<(String, String)> {
    let url = Url::parse(origin).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    Some((
        url.origin().ascii_serialization(),
        url.host_str()?.to_owned(),
    ))
}

/// A failure the client sees as a 500 without detail.
struct Failure;

/// A header as `Headers.get` reads it: every occurrence, joined by `, `, each byte one code
/// point (Latin-1) — Bun exposes a byte 0xE9 as U+00E9 and the UTF-8 pair C3 A9 as two code
/// points (both versions, measured on 2026-11-23). A value with such bytes is kept, never
/// emptied: `gzip, é` still accepts gzip, and a form type with a non-ASCII parameter is still a
/// form.
fn header(headers: &HeaderMap, name: &str) -> Option<String> {
    let values: Vec<String> = headers
        .get_all(name)
        .iter()
        .map(|value| {
            value
                .as_bytes()
                .iter()
                .map(|byte| char::from(*byte))
                .collect()
        })
        .collect();
    (!values.is_empty()).then(|| values.join(", "))
}

/// A byte RFC 3986 admits in a host and port: unreserved, sub-delimiters, `:`, `[`, `]`, `%`.
fn is_host_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || b"-._~!$&'()*+,;=:[]%".contains(&byte)
}

/// The `new URL(request.url)` of the reference. Bun builds `request.url` as `http://` + the
/// first Host value + the target only when that value is non-empty and every byte of it is a
/// host byte; otherwise it is the bare target, which `new URL` refuses — as it refuses a host
/// or port the WHATWG parser rejects. Either way the reference answers 500 (measured on
/// 2026-11-23, ADR 0009).
///
/// An `xn--` label that is not valid punycode is refused, as Bun 1.4.4 refuses it; the pinned
/// reference (1.4.0-canary.1) still accepts it and then answers 421 for the unknown host. That
/// divergence is admitted (ADR 0009) and checked by the parity test. The path and query do not
/// depend on the host: they are read under a fixed one.
fn request_url(first_host: Option<&[u8]>, target: &str) -> Option<Url> {
    let host = first_host
        .filter(|host| !host.is_empty() && host.iter().all(|byte| is_host_byte(*byte)))?;
    let host = std::str::from_utf8(host).ok()?;
    Url::parse(&format!("http://{host}/")).ok()?;
    Url::parse(&format!("http://localhost{target}")).ok()
}

fn now_ms(date: OffsetDateTime) -> i64 {
    i64::try_from(date.unix_timestamp_nanos() / 1_000_000).unwrap_or(i64::MAX)
}

impl App {
    fn respond(&self, status: StatusCode, headers: &[(&str, &str)], body: Vec<u8>) -> Response {
        let mut response = Response::new(Body::from(body));
        *response.status_mut() = status;
        let map = response.headers_mut();
        let all = self
            .policy
            .security_headers
            .iter()
            .map(|(name, value)| (name.as_str(), value.as_str()))
            .chain(headers.iter().copied());
        for (name, value) in all {
            if let (Ok(name), Ok(value)) =
                (HeaderName::try_from(name), HeaderValue::try_from(value))
            {
                map.insert(name, value);
            }
        }
        response
    }

    fn text(&self, status: StatusCode, body: &str, headers: &[(&str, &str)]) -> Response {
        let mut all = vec![("Content-Type", "text/plain; charset=utf-8")];
        all.extend_from_slice(headers);
        self.respond(status, &all, body.as_bytes().to_vec())
    }

    fn see_other(&self, location: &str) -> Response {
        self.respond(StatusCode::SEE_OTHER, &[("Location", location)], Vec::new())
    }

    fn serve_static(&self, headers: &HeaderMap, head: bool, pathname: &str) -> Response {
        let path = resolve_path(pathname);
        let found = path.as_ref().and_then(|path| {
            self.site
                .get(path)
                .or_else(|| self.site.get(&format!("{path}/index.html")))
        });
        let Some(file) = found.or_else(|| self.site.get("/404.html")) else {
            return self.text(StatusCode::NOT_FOUND, "Introuvable", &[]);
        };
        let status = if found.is_some() {
            StatusCode::OK
        } else {
            StatusCode::NOT_FOUND
        };
        // Asset names carry no content hash, so nothing may be cached as immutable: every file
        // is revalidated against its digest, and an unchanged one costs a 304. A 404 has no
        // validator.
        let gzip = file.gzip.as_ref().filter(|_| {
            header(headers, "accept-encoding")
                .unwrap_or_default()
                .contains("gzip")
        });
        // Each encoding is its own representation, so each has its own validator (RFC 9110 §8.8.3).
        let etag = match gzip {
            Some(_) => format!(
                "{}-gzip\"",
                file.etag.strip_suffix('"').unwrap_or(&file.etag)
            ),
            None => file.etag.clone(),
        };
        let mut response_headers = vec![
            ("Content-Type", file.media_type),
            ("Cache-Control", "no-cache"),
        ];
        if status == StatusCode::OK {
            response_headers.push(("ETag", &etag));
        }
        if file.gzip.is_some() {
            response_headers.push(("Vary", "Accept-Encoding"));
        }
        if status == StatusCode::OK
            && none_match_hits(header(headers, "if-none-match").as_deref(), &etag)
        {
            return self.respond(StatusCode::NOT_MODIFIED, &response_headers, Vec::new());
        }
        if gzip.is_some() {
            response_headers.push(("Content-Encoding", "gzip"));
        }
        let body = match (head, gzip) {
            (true, _) => Vec::new(),
            (false, Some(compressed)) => compressed.clone(),
            (false, None) => file.body.clone(),
        };
        self.respond(status, &response_headers, body)
    }

    /// The body as text, or `None` when it is over the form limit.
    async fn read_limited(&self, headers: &HeaderMap, body: Body) -> Option<String> {
        // `Number(content-length ?? "0") > 4096`: an unreadable length is NaN, never over.
        let declared = header(headers, "content-length").unwrap_or_else(|| "0".to_owned());
        if js_trim(&declared)
            .parse::<f64>()
            .is_ok_and(|length| length > MAX_FORM_BYTES as f64)
        {
            return None;
        }
        let bytes = to_bytes(body, MAX_REQUEST_BYTES).await.ok()?;
        (bytes.len() <= MAX_FORM_BYTES).then(|| decode_text(&bytes))
    }

    async fn subscribe(
        &self,
        headers: &HeaderMap,
        body: Body,
        peer: &str,
    ) -> Result<Response, Failure> {
        let kind = header(headers, "content-type").unwrap_or_default();
        if !kind.starts_with("application/x-www-form-urlencoded") {
            return Ok(self.text(StatusCode::UNSUPPORTED_MEDIA_TYPE, "Format refusé", &[]));
        }
        if header(headers, "sec-fetch-site").is_some_and(|site| site != "same-origin") {
            return Ok(self.text(StatusCode::FORBIDDEN, "Origine refusée", &[]));
        }
        let Some(text) = self.read_limited(headers, body).await else {
            return Ok(self.text(StatusCode::PAYLOAD_TOO_LARGE, "Demande trop longue", &[]));
        };
        if !self.limiter.allow(peer, now_ms((self.clock)())) {
            self.logger.event("subscription.rate_limited", &[]);
            return Ok(self.text(
                StatusCode::TOO_MANY_REQUESTS,
                "Trop de demandes. Réessayez dans quelques minutes.",
                &[],
            ));
        }
        let request = match parse_subscription(&search_params(&text), &self.policy) {
            Ok(request) => request,
            Err(refusal) => {
                let event = if refusal == Refusal::Honeypot {
                    "subscription.honeypot"
                } else {
                    "subscription.invalid"
                };
                self.logger
                    .event(event, &[("reason", refusal.code().into())]);
                return Ok(self.see_other(if refusal == Refusal::Honeypot {
                    "/inscription/merci/"
                } else {
                    "/inscription/erreur/"
                }));
            }
        };
        let confirm = new_token().map_err(|_| Failure)?;
        let unsubscribe = new_token().map_err(|_| Failure)?;
        let outcome = self
            .store
            .request(&request, &confirm.hash, &unsubscribe.hash, (self.clock)())
            .await
            .map_err(|_| Failure)?;
        self.logger.event(
            "subscription.request",
            &[("outcome", outcome.code().into())],
        );
        // Nothing of the send runs before the answer, not even its preparation: only a new or
        // pending address triggers one, so any such work would let the response time reveal a
        // confirmed address (ADR 0006 §4). A failed send is logged; the request stays pending
        // and a new subscription sends again.
        if outcome != RequestOutcome::AlreadyConfirmed {
            let message = confirmation_message(
                &self.from,
                &request.email,
                &format!("{}/confirmer?jeton={}", self.origin, confirm.token),
                &format!("{}/desinscrire?jeton={}", self.origin, unsubscribe.token),
            );
            if !self.mail.enqueue(message) {
                self.logger.event("mail.dropped", &[]);
            }
        }
        Ok(self.see_other("/inscription/merci/"))
    }

    async fn confirm(&self, token: &str) -> Result<Response, Failure> {
        let confirmed = if token.is_empty() {
            false
        } else {
            self.store
                .confirm(&hash_token(token), (self.clock)())
                .await
                .map_err(|_| Failure)?
        };
        let outcome = if confirmed { "confirmed" } else { "invalid" };
        self.logger
            .event("subscription.confirm", &[("outcome", outcome.into())]);
        Ok(self.see_other(if confirmed {
            "/inscription/confirmee/"
        } else {
            "/inscription/lien-invalide/"
        }))
    }

    async fn unsubscribe(
        &self,
        headers: &HeaderMap,
        body: Body,
        token: &str,
    ) -> Result<Response, Failure> {
        let Some(text) = self.read_limited(headers, body).await else {
            return Ok(self.text(StatusCode::PAYLOAD_TOO_LARGE, "Demande trop longue", &[]));
        };
        let deleted = if token.is_empty() {
            false
        } else {
            self.store
                .unsubscribe(&hash_token(token))
                .await
                .map_err(|_| Failure)?
        };
        let outcome = if deleted { "deleted" } else { "invalid" };
        self.logger
            .event("subscription.unsubscribe", &[("outcome", outcome.into())]);
        // A mail client's one-click request (RFC 8058) expects a plain success, not a page.
        if js_trim(&text) == ONE_CLICK {
            return Ok(self.text(StatusCode::OK, "Désinscription prise en compte.", &[]));
        }
        Ok(self.see_other(if deleted {
            "/inscription/desinscrit/"
        } else {
            "/inscription/lien-invalide/"
        }))
    }

    fn unsubscribe_page(&self, token: &str) -> Response {
        let action = escape_html(&format!(
            "/desinscrire?jeton={}",
            encode_uri_component(token)
        ));
        let page = [
            "<!doctype html>",
            "<html lang=\"fr\">",
            "<head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
            "<meta name=\"robots\" content=\"noindex\"><title>Quitter la liste d'attente, Libre IA</title>",
            "<link rel=\"stylesheet\" href=\"/assets/site.css\"></head>",
            "<body><main class=\"page-inscription\"><h1>Quitter la liste d'attente</h1>",
            "<p>Votre adresse sera effacée de la liste, sans autre conservation.</p>",
            &format!("<form method=\"post\" action=\"{action}\"><button type=\"submit\">Me désinscrire</button></form>"),
            "</main></body></html>",
            "",
        ]
        .join("\n");
        self.respond(
            StatusCode::OK,
            &[("Content-Type", HTML), ("Cache-Control", "no-store")],
            page.into_bytes(),
        )
    }

    async fn route(&self, request: Request, peer: &str) -> Result<Response, Failure> {
        let (parts, body) = request.into_parts();
        let target = parts
            .uri
            .path_and_query()
            .map(|value| value.as_str())
            .unwrap_or("/");
        // The path and query as the WHATWG parser of the reference reads them (dot segments
        // removed, characters escaped), from the URL Bun builds with the Host header.
        let first_host = parts.headers.get("host").map(|value| value.as_bytes());
        let url = request_url(first_host, target).ok_or(Failure)?;
        let pathname = url.path();
        let search = url
            .query()
            .filter(|query| !query.is_empty())
            .map(|query| format!("?{query}"))
            .unwrap_or_default();
        let token = url
            .query_pairs()
            .find(|(name, _)| name == "jeton")
            .map(|(_, value)| value.into_owned())
            .unwrap_or_default();

        let host_header = header(&parts.headers, "host")
            .unwrap_or_default()
            .to_lowercase();
        let host = match host_header.rsplit_once(':') {
            Some((name, port))
                if !port.is_empty() && port.bytes().all(|byte| byte.is_ascii_digit()) =>
            {
                name
            }
            _ => host_header.as_str(),
        };
        if host != self.canonical_host {
            if self.redirect_hosts.iter().any(|mirror| mirror == host) {
                let location = format!("{}{pathname}{search}", self.origin);
                return Ok(self.respond(
                    StatusCode::MOVED_PERMANENTLY,
                    &[("Location", &location)],
                    Vec::new(),
                ));
            }
            return Ok(self.text(StatusCode::MISDIRECTED_REQUEST, "Hôte inconnu", &[]));
        }
        let method = parts.method.as_str();
        match (pathname, method) {
            ("/inscription", "POST") => self.subscribe(&parts.headers, body, peer).await,
            ("/confirmer", "GET") => self.confirm(&token).await,
            ("/desinscrire", "GET") => Ok(self.unsubscribe_page(&token)),
            ("/desinscrire", "POST") => self.unsubscribe(&parts.headers, body, &token).await,
            (_, "GET" | "HEAD") => {
                Ok(self.serve_static(&parts.headers, method == "HEAD", pathname))
            }
            _ => Ok(self.text(
                StatusCode::METHOD_NOT_ALLOWED,
                "Méthode refusée",
                &[("Allow", "GET, HEAD")],
            )),
        }
    }
}

async fn handle(
    State(app): State<Arc<App>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    request: Request,
) -> Response {
    match app.route(request, &client_key(peer.ip())).await {
        Ok(response) => response,
        Err(Failure) => {
            app.logger.event("server.error", &[]);
            app.text(StatusCode::INTERNAL_SERVER_ERROR, "Erreur du serveur", &[])
        }
    }
}

/// Every request goes through one handler: the host decides before the path does.
pub fn router(app: Arc<App>) -> Router {
    Router::new().fallback(handle).with_state(app)
}

#[cfg(test)]
#[allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing
)]
mod tests {
    use std::sync::Mutex;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;

    use tokio::net::TcpListener;
    use tokio::sync::Notify;

    use super::*;
    use crate::mailer::{InFlight, MailError, Mailer, SendFuture};
    use crate::messages::MailMessage;
    use crate::policy::embedded;
    use crate::store::{StoreError, StoreFuture};
    use crate::subscription::SubscriptionRequest;

    /// A store that fails every call, with the message a driver could give.
    struct FailingStore;

    impl Store for FailingStore {
        fn request<'a>(
            &'a self,
            _: &'a SubscriptionRequest,
            _: &'a str,
            _: &'a str,
            _: OffsetDateTime,
        ) -> StoreFuture<'a, RequestOutcome> {
            Box::pin(async { Err(StoreError) })
        }
        fn confirm<'a>(&'a self, _: &'a str, _: OffsetDateTime) -> StoreFuture<'a, bool> {
            Box::pin(async { Err(StoreError) })
        }
        fn unsubscribe<'a>(&'a self, _: &'a str) -> StoreFuture<'a, bool> {
            Box::pin(async { Err(StoreError) })
        }
        fn purge_expired(&self, _: OffsetDateTime) -> StoreFuture<'_, u64> {
            Box::pin(async { Err(StoreError) })
        }
    }

    /// A store that always creates, so a subscription reaches the mailer.
    struct CreatingStore;

    impl Store for CreatingStore {
        fn request<'a>(
            &'a self,
            _: &'a SubscriptionRequest,
            _: &'a str,
            _: &'a str,
            _: OffsetDateTime,
        ) -> StoreFuture<'a, RequestOutcome> {
            Box::pin(async { Ok(RequestOutcome::Created) })
        }
        fn confirm<'a>(&'a self, _: &'a str, _: OffsetDateTime) -> StoreFuture<'a, bool> {
            Box::pin(async { Ok(false) })
        }
        fn unsubscribe<'a>(&'a self, _: &'a str) -> StoreFuture<'a, bool> {
            Box::pin(async { Ok(false) })
        }
        fn purge_expired(&self, _: OffsetDateTime) -> StoreFuture<'_, u64> {
            Box::pin(async { Ok(0) })
        }
    }

    /// A mailer whose sends stay pending until released, then fail.
    struct HeldMailer(Arc<Notify>, Arc<Mutex<u32>>);

    impl Mailer for HeldMailer {
        fn send(&self, _: MailMessage) -> SendFuture {
            *self.1.lock().unwrap() += 1;
            let release = self.0.clone();
            Box::pin(async move {
                release.notified().await;
                Err(MailError("mail.smtp_connection_failed"))
            })
        }
    }

    fn app(
        store: Arc<dyn Store>,
        mailer: Arc<dyn Mailer>,
        lines: Arc<Mutex<Vec<String>>>,
    ) -> Arc<App> {
        let mut site = Site::new();
        site.insert(
            "/index.html".into(),
            crate::site::StaticFile {
                body: b"home".to_vec(),
                gzip: None,
                media_type: HTML,
                etag: "\"x\"".into(),
            },
        );
        Arc::new(App {
            site,
            origin: "http://127.0.0.1".into(),
            canonical_host: "127.0.0.1".into(),
            redirect_hosts: vec![],
            store,
            mail: MailQueue::start(mailer, InFlight::default(), Logger::Memory(lines.clone())),
            from: "Libre IA <liste@libre-ia.example>".into(),
            limiter: Limiter::new(RATE_LIMIT, RATE_WINDOW_MS),
            logger: Logger::Memory(lines),
            policy: embedded().unwrap(),
            clock: OffsetDateTime::now_utc,
        })
    }

    async fn serve(app: Arc<App>) -> SocketAddr {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(crate::server::serve(
            listener,
            router(app),
            crate::server::Limits::SERVED,
            std::future::pending(),
        ));
        address
    }

    /// One HTTP/1.1 exchange on a fresh connection, answer read to the end.
    async fn exchange(address: SocketAddr, request: &str) -> String {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let mut socket = tokio::net::TcpStream::connect(address).await.unwrap();
        socket.write_all(request.as_bytes()).await.unwrap();
        let mut answer = Vec::new();
        socket.read_to_end(&mut answer).await.unwrap();
        String::from_utf8_lossy(&answer).into_owned()
    }

    #[tokio::test]
    async fn a_store_failure_answers_500_without_detail_and_is_logged() {
        let lines = Arc::new(Mutex::new(Vec::new()));
        let held = Arc::new(HeldMailer(Arc::new(Notify::new()), Arc::new(Mutex::new(0))));
        let address = serve(app(Arc::new(FailingStore), held, lines.clone())).await;
        let answer = exchange(
            address,
            "GET /confirmer?jeton=x HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
        )
        .await;
        assert!(answer.starts_with("HTTP/1.1 500"));
        assert!(answer.ends_with("Erreur du serveur"));
        assert_eq!(
            *lines.lock().unwrap(),
            vec![r#"{"event":"server.error"}"#.to_owned()]
        );
    }

    #[tokio::test]
    async fn the_answer_never_waits_for_the_send_and_a_failed_send_is_logged() {
        let lines = Arc::new(Mutex::new(Vec::new()));
        let release = Arc::new(Notify::new());
        let attempts = Arc::new(Mutex::new(0));
        let mailer = Arc::new(HeldMailer(release.clone(), attempts.clone()));
        let app = app(Arc::new(CreatingStore), mailer, lines.clone());
        let address = serve(app.clone()).await;
        let body = "courriel=a%40example.org";
        let answer = exchange(
            address,
            &format!(
                "POST /inscription HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            ),
        )
        .await;
        // The send is still held: the answer came anyway.
        assert!(answer.starts_with("HTTP/1.1 303"));
        assert!(
            !app.mail
                .in_flight()
                .settled(Duration::from_millis(50))
                .await
        );
        // The dispatcher calls the mailer after the answer, on its own.
        for _ in 0..500 {
            if *attempts.lock().unwrap() == 1 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        assert_eq!(*attempts.lock().unwrap(), 1);
        // A stored permit: the release holds even if the send is not awaiting yet.
        release.notify_one();
        assert!(app.mail.in_flight().settled(Duration::from_secs(5)).await);
        assert!(
            lines
                .lock()
                .unwrap()
                .contains(&r#"{"event":"mail.failed"}"#.to_owned())
        );
    }

    /// A store that answers the outcome it is given.
    struct OutcomeStore(RequestOutcome);

    impl Store for OutcomeStore {
        fn request<'a>(
            &'a self,
            _: &'a SubscriptionRequest,
            _: &'a str,
            _: &'a str,
            _: OffsetDateTime,
        ) -> StoreFuture<'a, RequestOutcome> {
            let outcome = self.0;
            Box::pin(async move { Ok(outcome) })
        }
        fn confirm<'a>(&'a self, _: &'a str, _: OffsetDateTime) -> StoreFuture<'a, bool> {
            Box::pin(async { Ok(false) })
        }
        fn unsubscribe<'a>(&'a self, _: &'a str) -> StoreFuture<'a, bool> {
            Box::pin(async { Ok(false) })
        }
        fn purge_expired(&self, _: OffsetDateTime) -> StoreFuture<'_, u64> {
            Box::pin(async { Ok(0) })
        }
    }

    /// A mailer whose `send` blocks the calling thread until released, the way a synchronous
    /// preparation (certificates read from disk, TLS set up) would: whatever calls it in the
    /// request path holds the answer back.
    struct BlockingMailer {
        release: Mutex<std::sync::mpsc::Receiver<()>>,
        calls: Arc<AtomicUsize>,
    }

    impl Mailer for BlockingMailer {
        fn send(&self, _: MailMessage) -> SendFuture {
            self.calls.fetch_add(1, Ordering::SeqCst);
            // Err once the sender is dropped: the end of the test always unblocks it.
            let _ = self.release.lock().unwrap().recv();
            Box::pin(async { Ok(()) })
        }
    }

    /// One subscription on a blocking socket with a read deadline. The deadline is the operating
    /// system's, not a tokio timer: a runtime worker held by a blocking call can stall the
    /// runtime's own timers, and the test would hang instead of failing.
    async fn subscribe_within(address: SocketAddr, bound: Duration) -> std::io::Result<String> {
        tokio::task::spawn_blocking(move || {
            use std::io::{Read, Write};
            let body = "courriel=a%40example.org";
            let mut socket = std::net::TcpStream::connect(address)?;
            socket.set_read_timeout(Some(bound))?;
            socket.write_all(format!(
                "POST /inscription HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            ).as_bytes())?;
            let mut answer = Vec::new();
            socket.read_to_end(&mut answer)?;
            Ok(String::from_utf8_lossy(&answer).into_owned())
        })
        .await
        .map_err(std::io::Error::other)?
    }

    /// ADR 0006 §4: a new and a confirmed address must answer alike, so no mail work — not even
    /// its synchronous preparation — may run before the answer. A mailer that blocks its caller
    /// shows it: the answer of a new address still comes, and a confirmed one never reaches the
    /// mailer at all. One worker only: mail work that held a runtime worker, in the request or
    /// in the dispatcher, would hold every answer back.
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn no_mail_work_runs_before_the_answer_on_either_path() {
        for (outcome, expected_calls) in [
            (RequestOutcome::Created, 2),
            (RequestOutcome::Renewed, 2),
            (RequestOutcome::AlreadyConfirmed, 0),
        ] {
            let (release, held) = std::sync::mpsc::channel();
            let calls = Arc::new(AtomicUsize::new(0));
            let mailer = Arc::new(BlockingMailer {
                release: Mutex::new(held),
                calls: calls.clone(),
            });
            let lines = Arc::new(Mutex::new(Vec::new()));
            let app = app(Arc::new(OutcomeStore(outcome)), mailer, lines);
            let address = serve(app.clone()).await;
            let first = subscribe_within(address, Duration::from_secs(5)).await;
            // Time for the first send to start and block, measured without a runtime timer.
            tokio::task::spawn_blocking(|| std::thread::sleep(Duration::from_millis(200)))
                .await
                .unwrap();
            // The first send is held now: the next answer must not wait for it either.
            let second = subscribe_within(address, Duration::from_secs(5)).await;
            // Released before any assertion, so a failure never leaves a worker blocked.
            drop(release);
            for answer in [first, second] {
                let answer = answer
                    .unwrap_or_else(|_| panic!("{outcome:?}: an answer waited for the mailer"));
                assert!(answer.starts_with("HTTP/1.1 303"), "{outcome:?}: {answer}");
            }
            assert!(app.mail.in_flight().settled(Duration::from_secs(5)).await);
            assert_eq!(calls.load(Ordering::SeqCst), expected_calls, "{outcome:?}");
        }
    }

    /// `Headers.get` in Bun (1.4.0-canary.1 and 1.4.4), measured on 2026-11-23: one code point
    /// per byte, occurrences joined by `, `.
    #[test]
    fn reads_header_bytes_as_bun_does() {
        let mut headers = HeaderMap::new();
        headers.append("x-probe", HeaderValue::from_bytes(b"a\xe9b").unwrap());
        headers.append("x-probe", HeaderValue::from_bytes(b"a\xc3\xa9b").unwrap());
        headers.append("x-probe", HeaderValue::from_bytes(b"\xff\x80").unwrap());
        assert_eq!(
            header(&headers, "x-probe").as_deref(),
            Some("a\u{e9}b, a\u{c3}\u{a9}b, \u{ff}\u{80}")
        );
        assert_eq!(header(&headers, "absent"), None);
    }

    #[test]
    fn reads_the_canonical_origin() {
        assert_eq!(
            canonical("https://libre-ia.fr/x").unwrap(),
            ("https://libre-ia.fr".to_owned(), "libre-ia.fr".to_owned())
        );
        assert_eq!(canonical("ftp://libre-ia.fr"), None);
    }

    /// Whether `new URL(request.url)` succeeds for a request `GET /x?q` with this Host value,
    /// measured on 2026-11-23 under the pinned reference (1.4.0-canary.1+57f349f63) and under
    /// 1.4.4-canary.1+963452075: the lists come from Bun, not from this port. Both versions
    /// agree on every host below; the port follows them.
    #[test]
    fn builds_the_request_url_as_the_reference_measured() {
        // Accepted by the pinned reference, refused by 1.4.4 and by the port: an `xn--` label
        // that is not valid punycode (admitted divergence, ADR 0009).
        for host in [
            "xn--a.fr",
            "XN--A.libreia.fr",
            "xn--a",
            "a.xn--a.fr",
            "xn--.fr",
            "xn--abc-.fr",
        ] {
            assert!(
                request_url(Some(host.as_bytes()), "/x?q").is_none(),
                "{host:?}"
            );
        }
        let accepted = [
            "xn--9ca.fr",
            "a%41.fr",
            "[::1]:80",
            "%41",
            "a%2Eb",
            "libre-ia.fr",
            "a!b.fr",
            "a$b.fr",
            "a&b.fr",
            "a'b.fr",
            "a(b.fr",
            "a)b.fr",
            "a*b.fr",
            "a+b.fr",
            "a,b.fr",
            "a-b.fr",
            "a.b.fr",
            "a0b.fr",
            "a;b.fr",
            "a=b.fr",
            "aAb.fr",
            "a_b.fr",
            "a~b.fr",
            "a:0",
            "a:65535",
            "[::1]",
            "a.",
            ".a",
            "a..b",
            "1.2.3.4",
            "0x7f.1",
            "xn--zca.fr",
            "a%41b",
            "a%2eb",
            "A.B",
            "a.fr:",
            "A.FR:08",
        ];
        let refused = [
            "a\"b.fr",
            "a#b.fr",
            "a%b.fr",
            "a/b.fr",
            "a:b.fr",
            "a<b.fr",
            "a>b.fr",
            "a?b.fr",
            "a@b.example",
            "a[b.fr",
            "a\\b.fr",
            "a]b.fr",
            "a^b.fr",
            "a`b.fr",
            "a{b.fr",
            "a|b.fr",
            "a}b.fr",
            "a\tb",
            ":80",
            "a:80:90",
            "a:65536",
            "a:-1",
            "a:+1",
            "[::1",
            "::1",
            "[zz]",
            "1.2.3.256",
            "a b",
            "aé",
            "ÿ",
            "",
            "a@libre-ai.fr",
            "libre-ia.fr:99999",
            "libre-ia.fr:+1",
            "é.fr",
            "a%zz",
        ];
        for host in accepted {
            assert!(
                request_url(Some(host.as_bytes()), "/x?q").is_some(),
                "{host:?}"
            );
        }
        for host in refused {
            assert!(
                request_url(Some(host.as_bytes()), "/x?q").is_none(),
                "{host:?}"
            );
        }
        assert!(request_url(None, "/x").is_none());
    }
}
