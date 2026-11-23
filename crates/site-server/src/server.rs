//! The HTTP/1.1 listener of the served runtime, with the connection limits of the reference
//! (ADR 0009). `Bun.serve` closes a connection that stays idle for 10 s; `axum::serve` has no
//! timer at all, so a client that never finishes its request held a connection — and a stop —
//! for as long as it liked. Here:
//!
//! - a connection with no byte read or written for `idle` is closed (Bun's `idleTimeout`);
//! - request headers must arrive whole within `header_read`, however slowly they trickle;
//! - a stop closes the listener, lets requests in progress finish, and gives up on the
//!   connections still open after `stop`: the caller then drains the sends and exits, instead of
//!   waiting on a slow client until the orchestrator kills the process.

use std::future::Future;
use std::io;
use std::net::SocketAddr;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Duration;

use axum::Router;
use axum::extract::ConnectInfo;
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper_util::rt::{TokioIo, TokioTimer};
use hyper_util::server::graceful::GracefulShutdown;
use hyper_util::service::TowerToHyperService;
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::net::TcpListener;
use tokio::time::{Instant, Sleep};

/// The bounds of one connection and of a stop.
#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub idle: Duration,
    pub header_read: Duration,
    pub stop: Duration,
}

impl Limits {
    /// The served runtime: the 10 s `idleTimeout` default of `Bun.serve` for the first two; a
    /// stop gives open connections as long, before the sends are drained.
    pub const SERVED: Self = Self {
        idle: Duration::from_secs(10),
        header_read: Duration::from_secs(10),
        stop: Duration::from_secs(10),
    };
}

/// How a stop ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stopped {
    /// Every connection closed within the bound.
    Drained,
    /// Connections were still open when the bound passed; they are dropped with the runtime.
    Abandoned,
}

/// A connection that fails once it has neither read nor written anything for `idle` while it
/// waits to. Progress in either direction restarts the clock; a connection busy elsewhere (a
/// handler awaiting the database) is not polled, so it is never cut for that.
struct IdleIo<T> {
    inner: T,
    idle: Duration,
    deadline: Pin<Box<Sleep>>,
}

impl<T> IdleIo<T> {
    fn new(inner: T, idle: Duration) -> Self {
        Self {
            inner,
            idle,
            deadline: Box::pin(tokio::time::sleep(idle)),
        }
    }

    fn progressed(&mut self) {
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

impl<T: AsyncRead + Unpin> AsyncRead for IdleIo<T> {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let this = self.get_mut();
        match Pin::new(&mut this.inner).poll_read(cx, buf) {
            Poll::Ready(result) => {
                this.progressed();
                Poll::Ready(result)
            }
            Poll::Pending => this.waiting(cx),
        }
    }
}

impl<T: AsyncWrite + Unpin> AsyncWrite for IdleIo<T> {
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        let this = self.get_mut();
        match Pin::new(&mut this.inner).poll_write(cx, buf) {
            Poll::Ready(result) => {
                this.progressed();
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
                this.progressed();
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
    let mut stop = std::pin::pin!(stop);
    loop {
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
            hyper::service::Service::call(&tower, request)
        });
        let mut builder = http1::Builder::new();
        builder
            .timer(TokioTimer::new())
            .header_read_timeout(limits.header_read);
        let connection =
            builder.serve_connection(TokioIo::new(IdleIo::new(stream, limits.idle)), service);
        let watched = graceful.watch(connection);
        tokio::spawn(async move {
            // A connection that fails (reset, timed out) concerns its client only.
            let _ = watched.await;
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
    async fn closes_a_connection_whose_headers_stop_arriving() {
        let running = start(Limits {
            idle: Duration::from_millis(300),
            header_read: LONG,
            stop: LONG,
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
            idle: Duration::from_millis(300),
            header_read: LONG,
            stop: LONG,
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
            stop: LONG,
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
}
