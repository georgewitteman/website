mod config;
use tracing_subscriber::{fmt, EnvFilter};
mod private_relay;

use crate::config::get_config;
use crate::private_relay::get_private_relay_range;
use askama::Template;
use askama_axum::IntoResponse;
use axum::body::Body;
use axum::extract::{ConnectInfo, Host, OriginalUri, Request as AxumRequest};
use axum::http::header::{self, HeaderMap, HeaderName, HeaderValue};
use axum::http::StatusCode;
use axum::response::{Redirect, Response};
use axum::routing::{any, get};
use axum::Router;
use axum_server::tls_rustls::RustlsConfig;
use futures_util::StreamExt;
use http_body_util::BodyExt;
use multimap::MultiMap;
use rustls_acme::{caches::DirCache, AcmeConfig};
use serde_json::Value;
use std::convert::Infallible;
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use tower::service_fn;
use tower_http::compression::CompressionLayer;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::TraceLayer;

fn get_user_agent(header: &str) -> woothee::parser::WootheeResult<'_> {
    let parser = woothee::parser::Parser::new();
    parser.parse(header).unwrap_or_default()
}

fn requested_html(headers: &HeaderMap) -> bool {
    headers
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .map(|accept| accept.split(',').any(|value| value.contains("text/html")))
        .unwrap_or(false)
}

#[derive(Template)]
#[template(path = "uuid.html")]
struct UuidTemplate {
    path: String,
    value: String,
}

async fn uuid_route(headers: HeaderMap, OriginalUri(uri): OriginalUri) -> Response {
    let result = uuid::Uuid::new_v4();
    if requested_html(&headers) {
        UuidTemplate {
            path: uri.path().to_string(),
            value: result.to_string(),
        }
        .into_response()
    } else {
        (
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; charset=utf-8"),
            )],
            format!("{}\n", result),
        )
            .into_response()
    }
}

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTemplate {
    path: String,
}

async fn index(OriginalUri(uri): OriginalUri) -> Response {
    IndexTemplate {
        path: uri.path().to_string(),
    }
    .into_response()
}

async fn sha() -> Response {
    let sha = option_env!("GITHUB_SHA").unwrap_or("unknown");
    (
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        )],
        sha,
    )
        .into_response()
}

async fn icloud_private_relay(ConnectInfo(peer_addr): ConnectInfo<SocketAddr>) -> Response {
    match get_private_relay_range(&peer_addr.ip()).await {
        Ok(None) => (
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; charset=utf-8"),
            )],
            format!("{} is not iCloud Private Relay", peer_addr.ip()),
        )
            .into_response(),
        Ok(Some(line)) => (
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; charset=utf-8"),
            )],
            format!("{}: {}", peer_addr.ip(), line),
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; charset=utf-8"),
            )],
            err.to_string(),
        )
            .into_response(),
    }
}

fn pretty_multimap(map: &MultiMap<String, String>) -> serde_json::Map<String, Value> {
    let mut pretty_map = serde_json::Map::new();
    for (k, v) in map.flat_iter() {
        let k = k.as_str().to_owned();
        let v = String::from_utf8_lossy(v.as_bytes()).into_owned();
        if let Some(existing_value) = pretty_map.get_mut(&k) {
            if let Some(existing_array) = existing_value.as_array_mut() {
                existing_array.push(v.clone().into());
            } else {
                let owned = existing_value.to_owned();
                pretty_map.insert(k, vec![owned, v.into()].into());
            }
        } else {
            pretty_map.insert(k, v.into());
        }
    }
    pretty_map
}

#[derive(Template)]
#[template(path = "echo.html")]
struct EchoTemplate {
    path: String,
    value: String,
    body: String,
}

async fn echo(
    ConnectInfo(peer_addr): ConnectInfo<SocketAddr>,
    OriginalUri(original_uri): OriginalUri,
    mut request: AxumRequest<Body>,
) -> Response {
    let config = get_config();
    let headers = request.headers().clone();
    let parsed_user_agent = get_user_agent(
        headers
            .get(header::USER_AGENT)
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default(),
    );

    let mut header_map = MultiMap::new();
    for (name, value) in headers.iter() {
        if let Ok(value) = value.to_str() {
            header_map.insert(name.as_str().to_owned(), value.to_owned());
        }
    }

    let body_bytes = match request.body_mut().collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("text/plain; charset=utf-8"),
                )],
                format!("failed to read request body: {err}"),
            )
                .into_response();
        }
    };

    let request_body = match String::from_utf8(body_bytes.to_vec()) {
        Ok(body) => body,
        Err(err) => format!("<binary {} bytes>", err.as_bytes().len()),
    };

    let real_ip = headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .or_else(|| {
            headers
                .get("x-forwarded-for")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.split(',').next().map(|part| part.trim().to_string()))
        });

    let forwarded_proto = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            if config.tls_enabled {
                "https".to_string()
            } else {
                "http".to_string()
            }
        });

    let response = serde_json::json!({
        "connection_info": {
            "realip_remote_addr": real_ip,
            "peer_addr": peer_addr.to_string(),
            "host": headers.get(header::HOST).and_then(|v| v.to_str().ok()).map(|s| s.to_string()),
            "scheme": forwarded_proto,
        },
        "version": format!("{:?}", request.version()),
        "method": request.method().as_str(),
        "uri": request.uri().to_string(),
        "app_config": {
            "host": config.website_domain.clone(),
            "secure": config.tls_enabled,
        },
        "uri_parts": {
            "authority": request.uri().authority().map(|a| a.as_str().to_string()),
            "host": request.uri().host().map(|h| h.to_string()),
            "path": request.uri().path().to_string(),
            "port": request.uri().port_u16(),
            "query": request.uri().query().map(|q| q.to_string()),
            "scheme": request.uri().scheme_str().map(|s| s.to_string()),
        },
        "peer_addr": peer_addr.to_string(),
        "path": original_uri.path().to_string(),
        "query_string": original_uri
            .query()
            .map(|q| q.to_string())
            .unwrap_or_default(),
        "ip": peer_addr.ip().to_string(),
        "headers": pretty_multimap(&header_map),
        "body": request_body.clone(),
        "user_agent": {
            "name": parsed_user_agent.name,
            "category": parsed_user_agent.category,
            "os": parsed_user_agent.os,
            "os_version": parsed_user_agent.os_version,
            "browser_type": parsed_user_agent.browser_type,
            "version": parsed_user_agent.version,
            "vendor": parsed_user_agent.vendor,
        }
    });

    match serde_json::to_string_pretty(&response) {
        Ok(body) => {
            if requested_html(&headers) {
                EchoTemplate {
                    path: original_uri.path().to_string(),
                    body: request_body,
                    value: body,
                }
                .into_response()
            } else {
                (
                    [(
                        header::CONTENT_TYPE,
                        HeaderValue::from_static("application/json"),
                    )],
                    format!("{body}\n"),
                )
                    .into_response()
            }
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; charset=utf-8"),
            )],
            err.to_string(),
        )
            .into_response(),
    }
}

fn not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/html; charset=utf-8"),
        )],
        "<h1>404 - Not Found</h1>".to_string(),
    )
        .into_response()
}

fn create_app_router() -> Router {
    let static_files = axum::routing::get_service(ServeDir::new("./static").fallback(service_fn(
        |_req| async move { Ok::<_, Infallible>(not_found()) },
    )));

    Router::new()
        .route("/", get(index))
        .route("/uuid", get(uuid_route))
        .route("/sha", get(sha))
        .route("/icloud-private-relay", get(icloud_private_relay))
        .route("/echo", any(echo))
        .fallback_service(static_files)
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("content-security-policy"),
            HeaderValue::from_static("default-src 'self'"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static(
                "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
            ),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("same-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("strict-transport-security"),
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-xss-protection"),
            HeaderValue::from_static("1; mode=block"),
        ))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
}

async fn redirect_to_https(host: Option<Host>, OriginalUri(uri): OriginalUri) -> Response {
    match host {
        Some(Host(host)) => {
            let location = format!("https://{}{}", host, uri);
            Redirect::permanent(&location).into_response()
        }
        None => (
            StatusCode::BAD_REQUEST,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; charset=utf-8"),
            )],
            "missing host header".to_string(),
        )
            .into_response(),
    }
}

fn create_http_router() -> Router {
    Router::new().fallback(redirect_to_https)
}

// https://github.com/FlorianUekermann/rustls-acme/issues/54
fn make_auto_rustls_config(domain: &str) -> RustlsConfig {
    let state = AcmeConfig::new([domain])
        .contact_push("mailto:george@witteman.me")
        .cache(DirCache::new("./rustls_acme_cache"))
        .directory("https://acme-v02.api.letsencrypt.org/directory")
        .state();
    let tls_config = RustlsConfig::from_config(state.default_rustls_config());
    let mut state_for_task = state;
    let tls_config_handle = tls_config.clone();

    tokio::spawn(async move {
        while let Some(event) = state_for_task.next().await {
            match event {
                Ok(ok) => {
                    tracing::info!("ACME configuration event: {ok:?}");
                    tls_config_handle.reload_from_config(state_for_task.default_rustls_config());
                }
                Err(err) => tracing::error!("ACME configuration error: {err:?}"),
            }
        }
    });

    tls_config
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure log level from RUST_LOG, with a fallback
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("debug"));

    fmt().with_env_filter(filter).init();
    tracing::info!("Starting server");

    let config = get_config();

    let http_addrs = [
        SocketAddr::from((Ipv4Addr::UNSPECIFIED, config.http_port)),
        SocketAddr::from((Ipv6Addr::UNSPECIFIED, config.http_port)),
    ];
    let https_addrs = [
        SocketAddr::from((Ipv4Addr::UNSPECIFIED, config.https_port)),
        SocketAddr::from((Ipv6Addr::UNSPECIFIED, config.https_port)),
    ];

    let app = create_app_router();
    let https_service = app
        .clone()
        .into_make_service_with_connect_info::<SocketAddr>();
    let http_router = if config.tls_enabled {
        create_http_router()
    } else {
        app
    };
    let http_service = http_router.into_make_service_with_connect_info::<SocketAddr>();

    let mut servers = Vec::new();

    for addr in http_addrs {
        let service = http_service.clone();
        tracing::info!("Starting HTTP server on {addr}");
        servers.push(tokio::spawn(async move {
            axum_server::bind(addr).serve(service).await
        }));
    }

    if config.tls_enabled {
        let tls_config = make_auto_rustls_config(&config.website_domain);
        for addr in https_addrs {
            let service = https_service.clone();
            let tls_config = tls_config.clone();
            tracing::info!("Starting HTTPS server on {addr}");
            servers.push(tokio::spawn(async move {
                axum_server::bind_rustls(addr, tls_config)
                    .serve(service)
                    .await
            }));
        }
    }

    for server in servers {
        match server.await {
            Ok(Ok(())) => {}
            Ok(Err(err)) => {
                return Err(std::io::Error::other(err));
            }
            Err(err) => {
                return Err(std::io::Error::other(err));
            }
        }
    }

    tracing::info!("Server finished");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn requested_html_detects_html_accept_header() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::ACCEPT,
            HeaderValue::from_static("text/html,application/xhtml+xml"),
        );

        assert!(requested_html(&headers));
    }

    #[test]
    fn requested_html_rejects_non_html_accept_header() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::ACCEPT,
            HeaderValue::from_static("application/json,application/xml"),
        );

        assert!(!requested_html(&headers));
    }

    #[test]
    fn pretty_multimap_merges_duplicate_keys_into_arrays() {
        let mut multimap = MultiMap::new();
        multimap.insert("x-custom".to_string(), "first".to_string());
        multimap.insert("x-custom".to_string(), "second".to_string());
        multimap.insert("unique".to_string(), "value".to_string());

        let result = pretty_multimap(&multimap);

        let multi = result
            .get("x-custom")
            .expect("expected duplicate key to exist");
        match multi {
            Value::Array(values) => {
                assert_eq!(values.len(), 2);
                assert_eq!(values[0], Value::String("first".to_string()));
                assert_eq!(values[1], Value::String("second".to_string()));
            }
            other => panic!("expected array for duplicates, got {other:?}"),
        }

        let unique = result.get("unique").expect("expected single key to exist");
        assert_eq!(unique, &Value::String("value".to_string()));
    }
}
