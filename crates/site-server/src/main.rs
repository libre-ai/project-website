//! Entry point of the served runtime (ADR 0009).
//!
//! `site-server` serves the site and the waitlist with the settings of the environment
//! (`config.rs`), purges expired requests every hour, and on SIGTERM or SIGINT stops accepting,
//! finishes the requests in progress and waits for the messages being sent.
//! `site-server purge` deletes the expired requests once and exits: the same purge, for a
//! scheduled task or a test.
#![forbid(unsafe_code)]

use std::process::ExitCode;
use std::sync::Arc;
use std::time::Duration;

use site_server::config::{Config, ConfigError, DatabaseSetting, MailSetting};
use site_server::http::{App, RATE_LIMIT, RATE_WINDOW_MS, canonical, router};
use site_server::limiter::Limiter;
use site_server::log::Logger;
use site_server::mailer::{InFlight, MailQueue, Mailer, OutboxMailer, sender_domain};
use site_server::policy;
use site_server::server::{self, Limits, Stopped};
use site_server::site::load_site;
use site_server::smtp::SmtpMailer;
use site_server::store::{PgStore, Store, connect_options};
use time::OffsetDateTime;

const PURGE_INTERVAL: Duration = Duration::from_secs(3600);
/// The longest a stop waits for messages still being sent.
const SEND_DRAIN: Duration = Duration::from_secs(30);

fn environment(name: &str) -> Option<String> {
    std::env::var(name).ok()
}

/// A start that cannot go on, named by a code.
struct StartFailure(&'static str);

impl From<ConfigError> for StartFailure {
    fn from(_: ConfigError) -> Self {
        Self("server.config_invalid")
    }
}

/// Deletes expired pending requests and logs how many, never which.
async fn purge_once(store: &dyn Store, logger: &Logger) -> bool {
    match store.purge_expired(OffsetDateTime::now_utc()).await {
        Ok(purged) => {
            logger.event("subscription.purge", &[("purged", purged.into())]);
            true
        }
        Err(_) => {
            logger.event("server.error", &[]);
            false
        }
    }
}

/// The stop request. The handlers are installed when this is called, not when the future is
/// first polled: a SIGTERM that follows the start line at once must stop the server gracefully,
/// not kill it with the default action.
#[cfg(unix)]
fn stop_signal() -> impl std::future::Future<Output = ()> {
    use tokio::signal::unix::{SignalKind, signal};
    let terminate = signal(SignalKind::terminate()).ok();
    let interrupt = signal(SignalKind::interrupt()).ok();
    async move {
        let wait = |stream: Option<tokio::signal::unix::Signal>| async move {
            match stream {
                Some(mut stream) => {
                    stream.recv().await;
                }
                None => std::future::pending::<()>().await,
            }
        };
        tokio::select! {
            () = wait(terminate) => {}
            () = wait(interrupt) => {}
        }
    }
}

#[cfg(not(unix))]
fn stop_signal() -> impl std::future::Future<Output = ()> {
    async {
        let _ = tokio::signal::ctrl_c().await;
    }
}

async fn serve(logger: &Logger) -> Result<(), StartFailure> {
    let policy = policy::embedded().map_err(|_| StartFailure("server.policy_invalid"))?;
    let config = Config::from_source(&environment).inspect_err(|error| {
        logger.event("server.config_invalid", &[("variable", error.0.into())]);
    })?;
    let (origin, canonical_host) = canonical(&config.origin).ok_or_else(|| {
        logger.event(
            "server.config_invalid",
            &[("variable", "SITE_ORIGIN".into())],
        );
        StartFailure("server.config_invalid")
    })?;
    // The sender is checked before anything opens: a wrong one would only fail at the first send.
    sender_domain(&config.from).map_err(|error| StartFailure(error.0))?;
    let mailer: Arc<dyn Mailer> = match config.mail {
        MailSetting::Outbox(directory) => Arc::new(OutboxMailer::new(directory)),
        MailSetting::Smtp(smtp) => {
            // The relay client is prepared here, once: no send prepares anything (ADR 0006 §4).
            Arc::new(SmtpMailer::new(smtp, &config.from).map_err(|error| StartFailure(error.0))?)
        }
    };
    let site = load_site(&config.site_directory).map_err(|error| StartFailure(error.code()))?;
    // Refused before any connection: an unverified channel is never opened.
    let options = connect_options(&config.database.url, config.database.allow_insecure_local)
        .map_err(StartFailure)?;
    let store = Arc::new(
        PgStore::connect(
            options,
            config.database_max_connections,
            policy.consent_text_version.clone(),
        )
        .await
        .map_err(|_| StartFailure("server.database_unavailable"))?,
    );
    let listener = tokio::net::TcpListener::bind(config.listen)
        .await
        .map_err(|_| StartFailure("server.listen_failed"))?;
    let port = listener
        .local_addr()
        .map_err(|_| StartFailure("server.listen_failed"))?
        .port();

    let in_flight = InFlight::default();
    let mail = MailQueue::start(mailer, in_flight.clone(), logger.clone());
    let app = Arc::new(App {
        site,
        origin,
        canonical_host,
        redirect_hosts: config.redirect_hosts,
        store: store.clone(),
        mail,
        from: config.from,
        limiter: Limiter::new(RATE_LIMIT, RATE_WINDOW_MS),
        logger: logger.clone(),
        policy,
        clock: OffsetDateTime::now_utc,
    });

    // A purge at every start, before the first request: restarts more frequent than the interval
    // never leave expired requests behind. A failure is logged and does not stop the start.
    purge_once(store.as_ref(), logger).await;
    let purge_store = store.clone();
    let purge_logger = logger.clone();
    let purge = tokio::spawn(async move {
        let mut ticks = tokio::time::interval(PURGE_INTERVAL);
        // The first tick is immediate, and the start has just purged.
        ticks.tick().await;
        loop {
            ticks.tick().await;
            purge_once(purge_store.as_ref(), &purge_logger).await;
        }
    });

    let stop = stop_signal();
    logger.event("server.listening", &[("port", u64::from(port).into())]);
    // Bounded at every stage: connections still open after `Limits::SERVED.stop` are dropped,
    // then the sends get `SEND_DRAIN`, so a slow client can never keep the process past both.
    if server::serve(listener, router(app), Limits::SERVED, stop).await == Stopped::Abandoned {
        logger.event("server.connections_abandoned", &[]);
    }
    purge.abort();
    if !in_flight.settled(SEND_DRAIN).await {
        logger.event("mail.abandoned", &[]);
    }
    store.close().await;
    logger.event("server.stopped", &[]);
    Ok(())
}

async fn purge_command(logger: &Logger) -> Result<(), StartFailure> {
    let policy = policy::embedded().map_err(|_| StartFailure("server.policy_invalid"))?;
    let database = DatabaseSetting::from_source(&environment).inspect_err(|error| {
        logger.event("server.config_invalid", &[("variable", error.0.into())]);
    })?;
    let options =
        connect_options(&database.url, database.allow_insecure_local).map_err(StartFailure)?;
    let store = PgStore::connect(options, 1, policy.consent_text_version)
        .await
        .map_err(|_| StartFailure("server.database_unavailable"))?;
    let purged = purge_once(&store, logger).await;
    store.close().await;
    if purged {
        Ok(())
    } else {
        Err(StartFailure("server.purge_failed"))
    }
}

fn main() -> ExitCode {
    let logger = Logger::Stdout;
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(_) => {
            logger.event(
                "server.start_failed",
                &[("reason", "server.runtime_unavailable".into())],
            );
            return ExitCode::FAILURE;
        }
    };
    let outcome = match arguments
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>()
        .as_slice()
    {
        [] => runtime.block_on(serve(&logger)),
        ["purge"] => runtime.block_on(purge_command(&logger)),
        _ => Err(StartFailure("server.arguments_invalid")),
    };
    match outcome {
        Ok(()) => ExitCode::SUCCESS,
        Err(StartFailure(reason)) => {
            logger.event("server.start_failed", &[("reason", reason.into())]);
            ExitCode::FAILURE
        }
    }
}
