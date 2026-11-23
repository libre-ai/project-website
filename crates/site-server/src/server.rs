//! The HTTP/1.1 listener of the served runtime, with the connection limits of the reference
//! (ADR 0009). `Bun.serve` closes a connection that stays idle for 10 s; `axum::serve` has no
//! timer at all, so a client that never finishes its request held a connection — and a stop —
//! for as long as it liked. Here:
//!
//! - a request must arrive whole, headers and body, within `request` of its first byte, however
//!   slowly it trickles: `Bun.serve` closes a body sent one byte every 7 s after about 12 s
//!   (measured on 2026-11-23), where an idle timer alone, restarted by each byte, never would;
//! - a connection with no byte read or written for `idle` between requests, or while its answer
//!   is written, is closed (Bun's `idleTimeout`);
//! - request headers must arrive whole within `header_read`;
//! - at most `connections` are served at once: past them, the next connection waits in the
//!   listen backlog until a place frees, instead of taking a descriptor. A slow request frees its
//!   place within `request`; a slow reader of a large answer only within `idle` of each write, or
//!   at the stop. There is no cap per client: keyed on the connection address, it closed the
//!   lingering keep-alive connections of browsers sharing one (Firefox in the e2e run), and
//!   behind a proxy every client shares one; a cap per client belongs to the front proxy, which
//!   knows the client (ADR 0009);
//! - a request whose body cannot be read (timed out, cut) gets no answer: the connection is
//!   closed, as Bun closes it, instead of an answer that would blame the body's size;
//! - a stop closes the listener, lets requests in progress finish, and gives up on the
//!   connections still open after `stop`: the caller then drains the sends and exits, instead of
//!   waiting on a slow client until the orchestrator kills the process.

use std::future::Future;
use std::io;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;

use axum::Router;
use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::response::Response;
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper_util::rt::{TokioIo, TokioTimer};
use hyper_util::server::graceful::GracefulShutdown;
use hyper_util::service::TowerToHyperService;
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::net::TcpListener;
use tokio::sync::Semaphore;
use tokio::time::{Instant, Sleep};

/// The bounds of one connection, of the connections at once, and of a stop.
#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub idle: Duration,
    pub header_read: Duration,
    /// From the first byte of a request until its answer starts: headers and body.
    pub request: Duration,
    pub stop: Duration,
    pub connections: usize,
}

impl Limits {
    /// The served runtime: the 10 s `idleTimeout` default of `Bun.serve` for the timers; a stop
    /// gives open connections as long, before the sends are drained. The connection cap is this
    /// port's own: Bun has none. It assumes the descriptor limit of the deployment leaves room
    /// for 512 connections beside the database pool and the sends (not measured, ADR 0009).
    pub const SERVED: Self = Self {
        idle: Duration::from_secs(10),
        header_read: Duration::from_secs(10),
        request: Duration::from_secs(10),
        stop: Duration::from_secs(10),
        connections: 512,
    };
}

/// Marks a response that must not be sent: the connection is closed without an answer.
#[derive(Debug, Clone, Copy)]
pub struct CloseWithoutAnswer;

/// What a handler returns when the request cannot be answered meaningfully (its body failed).
pub fn close_without_answer() -> Response {
    let mut response = Response::new(Body::empty());
    response.extensions_mut().insert(CloseWithoutAnswer);
    response
}

/// How a stop ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stopped {
    /// Every connection closed within the bound.
    Drained,
    /// Connections were still open when the bound passed; they are dropped with the runtime.
    Abandoned,
}

/// A connection that fails once its deadline passes while it waits to read or write. The first
/// byte of a request sets the deadline `request` ahead, and further bytes of that request never
/// move it; a write (the answer) ends the request and sets it `idle` ahead, as does each later
/// write. A connection busy elsewhere (a handler awaiting the database) is not polled, so it is
/// never cut for that.
struct BoundedIo<T> {
    inner: T,
    idle: Duration,
    request: Duration,
    in_request: bool,
    deadline: Pin<Box<Sleep>>,
}

impl<T> BoundedIo<T> {
    fn new(inner: T, idle: Duration, request: Duration) -> Self {
        Self {
            inner,
            idle,
            request,
            in_request: false,
            deadline: Box::pin(tokio::time::sleep(idle)),
        }
    }

    fn read_some(&mut self) {
        if !self.in_request {
            self.in_request = true;
            let next = Instant::now() + self.request;
            self.deadline.as_mut().reset(next);
        }
    }

    fn wrote_some(&mut self) {
        self.in_request = false;
        let next = Instant::now() + self.idle;
        self.deadline.as_mut().reset(next);
    }

    /// `Pending` stays pending until the deadline, which then turns it into an error.
    fn waiting<R>(&mut self, cx: &mut Context<'_>) -> Poll<io::Result<R>> {
        match self.deadline.as_mut().poll(cx) {
            Poll::Ready(()) => Poll::Ready(Err(io::Error::from(io::ErrorKind::TimedOut))),
            Poll::Pending => Poll::Pending,
        }
    }
}

impl<T: AsyncRead + Unpin> AsyncRead for BoundedIo<T> {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let this = self.get_mut();
        let before = buf.filled().len();
        match Pin::new(&mut this.inner).poll_read(cx, buf) {
            Poll::Ready(result) => {
                if buf.filled().len() > before {
                    this.read_some();
                }
                Poll::Ready(result)
            }
            Poll::Pending => this.waiting(cx),
        }
    }
}

impl<T: AsyncWrite + Unpin> AsyncWrite for BoundedIo<T> {
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        let this = self.get_mut();
        match Pin::new(&mut this.inner).poll_write(cx, buf) {
            Poll::Ready(result) => {
                this.wrote_some();
                Poll::Ready(result)
            }
            Poll::Pending => this.waiting(cx),
        }
    }

    fn poll_write_vectored(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        bufs: &[io::IoSlice<'_>],
    ) -> Poll<io::Result<usize>> {
        let this = self.get_mut();
        match Pin::new(&mut this.inner).poll_write_vectored(cx, bufs) {
            Poll::Ready(result) => {
                this.wrote_some();
                Poll::Ready(result)
            }
            Poll::Pending => this.waiting(cx),
        }
    }

    fn is_write_vectored(&self) -> bool {
        self.inner.is_write_vectored()
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        let this = self.get_mut();
        match Pin::new(&mut this.inner).poll_flush(cx) {
            Poll::Ready(result) => Poll::Ready(result),
            Poll::Pending => this.waiting(cx),
        }
    }

    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().inner).poll_shutdown(cx)
    }
}

/// An accept error that concerns one connection only, retried at once; any other (the process
/// out of file descriptors) waits a moment before the next accept, as `axum::serve` does.
fn is_connection_error(error: &io::Error) -> bool {
    matches!(
        error.kind(),
        io::ErrorKind::ConnectionRefused
            | io::ErrorKind::ConnectionAborted
            | io::ErrorKind::ConnectionReset
    )
}

/// Serves `router` on `listener` until `stop` resolves, then stops within `limits.stop`.
/// Each request carries the client address as `ConnectInfo<SocketAddr>`.
pub async fn serve(
    listener: TcpListener,
    router: Router,
    limits: Limits,
    stop: impl Future<Output = ()>,
) -> Stopped {
    let graceful = GracefulShutdown::new();
    let places = Arc::new(Semaphore::new(limits.connections));
    let mut stop = std::pin::pin!(stop);
    loop {
        // A place first: past the cap, connections wait in the listen backlog, not in memory.
        let place = tokio::select! {
            place = places.clone().acquire_owned() => place,
            () = &mut stop => break,
        };
        // The semaphore is never closed.
        let Ok(place) = place else { break };
        let accepted = tokio::select! {
            accepted = listener.accept() => accepted,
            () = &mut stop => break,
        };
        let (stream, peer) = match accepted {
            Ok(pair) => pair,
            Err(error) => {
                if !is_connection_error(&error) {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
                continue;
            }
        };
        let tower = TowerToHyperService::new(router.clone());
        let service = service_fn(move |mut request: hyper::Request<Incoming>| {
            request
                .extensions_mut()
                .insert(ConnectInfo::<SocketAddr>(peer));
            let answer = hyper::service::Service::call(&tower, request);
            async move {
                match answer.await {
                    Ok(response) if response.extensions().get::<CloseWithoutAnswer>().is_some() => {
                        // An error from the service makes hyper close without writing anything.
                        Err(io::Error::from(io::ErrorKind::ConnectionAborted))
                    }
                    Ok(response) => Ok(response),
                    Err(never) => match never {},
                }
            }
        });
        let mut builder = http1::Builder::new();
        builder
            .timer(TokioTimer::new())
            .header_read_timeout(limits.header_read);
        let io = BoundedIo::new(stream, limits.idle, limits.request);
        let connection = builder.serve_connection(TokioIo::new(io), service);
        let watched = graceful.watch(connection);
        tokio::spawn(async move {
            // A connection that fails (reset, timed out) concerns its client only.
            let _ = watched.await;
            drop(place);
        });
    }
    drop(listener);
    tokio::select! {
        () = graceful.shutdown() => Stopped::Drained,
        () = tokio::time::sleep(limits.stop) => Stopped::Abandoned,
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
    use std::time::Instant as StdInstant;

    use axum::routing::{get, post};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;
    use tokio::sync::oneshot;

    use super::*;

    const LONG: Duration = Duration::from_secs(60);

    /// `/` answers the client address; `/body` reads the whole body before answering, as the
    /// waitlist routes do.
    fn router() -> Router {
        Router::new()
            .route(
                "/",
                get(|ConnectInfo(peer): ConnectInfo<SocketAddr>| async move {
                    peer.ip().to_string()
                }),
            )
            .route("/body", post(|body: String| async move { body }))
    }

    struct Running {
        address: SocketAddr,
        stop: oneshot::Sender<()>,
        stopped: tokio::task::JoinHandle<Stopped>,
    }

    async fn start(limits: Limits) -> Running {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let (stop, stopping) = oneshot::channel::<()>();
        let stopped = tokio::spawn(serve(listener, router(), limits, async move {
            let _ = stopping.await;
        }));
        Running {
            address,
            stop,
            stopped,
        }
    }

    /// Reads until the server closes the connection or fails it, within `bound`; the time it
    /// took, or `None` when the connection was still open at the bound.
    async fn closed_within(socket: &mut TcpStream, bound: Duration) -> Option<Duration> {
        let started = StdInstant::now();
        let mut sink = Vec::new();
        match tokio::time::timeout(bound, socket.read_to_end(&mut sink)).await {
            Ok(_) => Some(started.elapsed()),
            Err(_) => None,
        }
    }

    #[tokio::test]
    async fn serves_a_request_with_the_client_address() {
        let running = start(Limits::SERVED).await;
        let mut socket = TcpStream::connect(running.address).await.unwrap();
        socket
            .write_all(b"GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        let mut answer = String::new();
        socket.read_to_string(&mut answer).await.unwrap();
        assert!(answer.starts_with("HTTP/1.1 200"), "{answer}");
        assert!(answer.ends_with("127.0.0.1"), "{answer}");
        running.stop.send(()).unwrap();
        assert_eq!(running.stopped.await.unwrap(), Stopped::Drained);
    }

    #[tokio::test]
    async fn closes_a_connection_that_never_sends_a_request() {
        let running = start(Limits {
            idle: Duration::from_millis(300),
            header_read: LONG,
            request: LONG,
            stop: LONG,
            ..Limits::SERVED
        })
        .await;
        let mut socket = TcpStream::connect(running.address).await.unwrap();
        let closed = closed_within(&mut socket, Duration::from_secs(10)).await;
        assert!(closed.is_some(), "an idle connection was kept");
    }

    #[tokio::test]
    async fn closes_a_connection_whose_headers_stop_arriving() {
        let running = start(Limits {
            idle: LONG,
            header_read: LONG,
            request: Duration::from_millis(300),
            stop: LONG,
            ..Limits::SERVED
        })
        .await;
        let mut socket = TcpStream::connect(running.address).await.unwrap();
        socket
            .write_all(b"GET / HTTP/1.1\r\nHost: x\r\n")
            .await
            .unwrap();
        let closed = closed_within(&mut socket, Duration::from_secs(10)).await;
        assert!(closed.is_some(), "a half-sent request kept its connection");
    }

    #[tokio::test]
    async fn closes_a_connection_whose_body_stops_arriving() {
        let running = start(Limits {
            idle: LONG,
            header_read: LONG,
            request: Duration::from_millis(300),
            stop: LONG,
            ..Limits::SERVED
        })
        .await;
        let mut socket = TcpStream::connect(running.address).await.unwrap();
        socket
            .write_all(b"POST /body HTTP/1.1\r\nHost: x\r\nContent-Length: 100\r\n\r\ncourriel=")
            .await
            .unwrap();
        let closed = closed_within(&mut socket, Duration::from_secs(10)).await;
        assert!(closed.is_some(), "a half-sent body kept its connection");
    }

    #[tokio::test]
    async fn closes_a_connection_whose_headers_trickle_past_the_bound() {
        let running = start(Limits {
            idle: LONG,
            header_read: Duration::from_millis(500),
            request: LONG,
            stop: LONG,
            ..Limits::SERVED
        })
        .await;
        let mut socket = TcpStream::connect(running.address).await.unwrap();
        socket.write_all(b"GET / HTTP/1.1\r\n").await.unwrap();
        // One byte every 100 ms keeps the connection busy, never idle, for up to 10 s.
        let started = StdInstant::now();
        let mut closed = false;
        while started.elapsed() < Duration::from_secs(10) {
            if socket.write_all(b"X").await.is_err() {
                closed = true;
                break;
            }
            let mut byte = [0_u8; 1];
            match tokio::time::timeout(Duration::from_millis(100), socket.read(&mut byte)).await {
                Ok(Ok(0) | Err(_)) => {
                    closed = true;
                    break;
                }
                // A 408 or other answer also ends the request: the headers never completed.
                Ok(Ok(_)) => {
                    closed = true;
                    break;
                }
                Err(_) => {}
            }
        }
        assert!(closed, "trickled headers kept their connection");
    }

    #[tokio::test]
    async fn a_stop_ends_within_its_bound_while_a_client_stays_connected() {
        let running = start(Limits {
            idle: LONG,
            header_read: LONG,
            stop: Duration::from_millis(300),
            ..Limits::SERVED
        })
        .await;
        let mut socket = TcpStream::connect(running.address).await.unwrap();
        socket
            .write_all(b"GET / HTTP/1.1\r\nHost: x\r\n")
            .await
            .unwrap();
        // Let the connection be accepted and its request start before the stop.
        tokio::time::sleep(Duration::from_millis(100)).await;
        running.stop.send(()).unwrap();
        let stopped = tokio::time::timeout(Duration::from_secs(10), running.stopped)
            .await
            .expect("the stop waited on the slow client")
            .unwrap();
        assert_eq!(stopped, Stopped::Abandoned);
        drop(socket);
    }

    /// The probe of the review: a body sent one byte every 7 s, under the served limits. Each
    /// byte arrives before the 10 s idle timer, so only a bound on the whole request ends it.
    #[tokio::test]
    async fn closes_a_request_whose_body_trickles_past_the_bound() {
        let running = start(Limits::SERVED).await;
        let socket = TcpStream::connect(running.address).await.unwrap();
        let (mut reader, mut writer) = socket.into_split();
        writer
            .write_all(b"POST /body HTTP/1.1\r\nHost: x\r\nContent-Length: 4096\r\n\r\nc")
            .await
            .unwrap();
        let started = StdInstant::now();
        let trickle = tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(7)).await;
                if writer.write_all(b"c").await.is_err() {
                    break;
                }
            }
        });
        let mut sink = Vec::new();
        let read = tokio::time::timeout(Duration::from_secs(20), reader.read_to_end(&mut sink));
        let closed = read.await.is_ok();
        let elapsed = started.elapsed();
        trickle.abort();
        assert!(closed, "a trickled body kept its connection past 20 s");
        assert!(
            elapsed < Duration::from_secs(11),
            "closed after {elapsed:?}, past the 10 s bound"
        );
    }

    #[tokio::test]
    async fn past_the_cap_a_connection_waits_for_a_place() {
        let running = start(Limits {
            connections: 1,
            ..Limits::SERVED
        })
        .await;
        let mut holder = TcpStream::connect(running.address).await.unwrap();
        holder.write_all(b"GET / HTTP/1.1\r\n").await.unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
        let mut waiting = TcpStream::connect(running.address).await.unwrap();
        waiting
            .write_all(b"GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        let mut byte = [0_u8; 1];
        let early = tokio::time::timeout(Duration::from_millis(500), waiting.read(&mut byte)).await;
        assert!(early.is_err(), "a connection past the cap was served");
        drop(holder);
        let mut answer = String::new();
        tokio::time::timeout(Duration::from_secs(5), waiting.read_to_string(&mut answer))
            .await
            .expect("the place freed by the first connection was not given")
            .unwrap();
        assert!(answer.starts_with("HTTP/1.1 200"), "{answer}");
    }

    #[tokio::test]
    async fn one_address_holding_many_open_connections_is_still_answered() {
        // Browsers sharing an address keep idle connections open; a cap per address closed them
        // (Firefox in the e2e run). 64 idle connections, then a request on each.
        let running = start(Limits::SERVED).await;
        let mut held = Vec::new();
        for _ in 0..64 {
            held.push(TcpStream::connect(running.address).await.unwrap());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
        for mut stream in held {
            stream
                .write_all(b"GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n")
                .await
                .unwrap();
            let mut answer = String::new();
            stream.read_to_string(&mut answer).await.unwrap();
            assert!(answer.starts_with("HTTP/1.1 200"), "{answer}");
        }
    }
}
