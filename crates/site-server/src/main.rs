//! Entry point of the served runtime (ADR 0009).
//!
//! `site-server` serves the site and the waitlist with the settings of the environment
//! (`config.rs`), purges expired requests every hour, and on SIGTERM or SIGINT stops accepting,
//! finishes the requests in progress and waits for the messages being sent.
//! `site-server purge` deletes the expired requests once and exits: the same purge, for a
//! scheduled task or a test.
#![forbid(unsafe_code)]

use std::net::SocketAddr;
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Duration;

use site_server::config::{Config, ConfigError, MailSetting};
use site_server::http::{App, InFlight, RATE_LIMIT, RATE_WINDOW_MS, canonical, router};
use site_server::limiter::Limiter;
use site_server::log::Logger;
use site_server::mailer::{Mailer, OutboxMailer, sender_address, sender_domain};
use site_server::policy;
use site_server::site::load_site;
use site_server::smtp::SmtpMailer;
use site_server::store::{PgStore, Store};
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

async fn stop_signal() {
    let interrupt = tokio::signal::ctrl_c();
    #[cfg(unix)]
    {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut terminate) => {
                tokio::select! {
                    _ = interrupt => {}
                    _ = terminate.recv() => {}
                }
            }
            Err(_) => {
                let _ = interrupt.await;
            }
        }
    }
    #[cfg(not(unix))]
    {
        let _ = interrupt.await;
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
            sender_address(&config.from).map_err(|error| StartFailure(error.0))?;
            Arc::new(SmtpMailer::new(smtp).map_err(|error| StartFailure(error.0))?)
        }
    };
    let site = load_site(&config.site_directory).map_err(|error| StartFailure(error.code()))?;
    let store = Arc::new(
        PgStore::connect(
            &config.database_url,
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
    let app = Arc::new(App {
        site,
        origin,
        canonical_host,
        redirect_hosts: config.redirect_hosts,
        store: store.clone(),
        mailer,
        from: config.from,
        limiter: Limiter::new(RATE_LIMIT, RATE_WINDOW_MS),
        logger: logger.clone(),
        policy,
        clock: OffsetDateTime::now_utc,
        in_flight: in_flight.clone(),
    });

    let purge_store = store.clone();
    let purge_logger = logger.clone();
    let purge = tokio::spawn(async move {
        let mut ticks = tokio::time::interval(PURGE_INTERVAL);
        // The first tick is immediate: the first purge comes one interval after the start.
        ticks.tick().await;
        loop {
            ticks.tick().await;
            purge_once(purge_store.as_ref(), &purge_logger).await;
        }
    });

    logger.event("server.listening", &[("port", u64::from(port).into())]);
    let service = router(app).into_make_service_with_connect_info::<SocketAddr>();
    let served = axum::serve(listener, service)
        .with_graceful_shutdown(stop_signal())
        .await;
    purge.abort();
    if !in_flight.settled(SEND_DRAIN).await {
        logger.event("mail.abandoned", &[]);
    }
    store.close().await;
    logger.event("server.stopped", &[]);
    served.map_err(|_| StartFailure("server.listen_failed"))
}

async fn purge_command(logger: &Logger) -> Result<(), StartFailure> {
    let policy = policy::embedded().map_err(|_| StartFailure("server.policy_invalid"))?;
    let url = environment("POSTGRESQL_ADDON_URI")
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            logger.event(
                "server.config_invalid",
                &[("variable", "POSTGRESQL_ADDON_URI".into())],
            );
            StartFailure("server.config_invalid")
        })?;
    let store = PgStore::connect(&url, 1, policy.consent_text_version)
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
