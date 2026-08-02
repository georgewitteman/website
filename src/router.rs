//! Application router configuration.

use axum::http::header::{HeaderName, HeaderValue};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get};
use axum::Router;
use std::convert::Infallible;
use tower::service_fn;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::{DefaultMakeSpan, DefaultOnRequest, DefaultOnResponse, TraceLayer};
use tracing::Level;

use crate::handlers::{
    echo, icloud_private_relay, index, microwave, sha, slot, uuid_route, weather,
};

/// Returns a 404 Not Found response.
fn not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        [(
            axum::http::header::CONTENT_TYPE,
            HeaderValue::from_static("text/html; charset=utf-8"),
        )],
        "<h1>404 - Not Found</h1>".to_string(),
    )
        .into_response()
}

/// Creates the main application router with all routes and middleware.
pub fn create_app_router() -> Router {
    // Static files carry no version in their names, so a browser that caches
    // `/styles.css` keeps serving it after a deploy changes it. With no
    // `Cache-Control` at all the browser is free to invent a freshness lifetime
    // — commonly a tenth of the file's age — which for a stylesheet last
    // touched weeks ago is days of stale CSS on an otherwise updated page.
    //
    // `no-cache` still lets the browser store the file; it just has to
    // revalidate first, and `ServeDir` answers that with a 304 off the ETag.
    // Fingerprinted filenames would allow real caching, but they need a build
    // step this site does not have.
    let static_files = axum::routing::get_service(ServeDir::new("./static").fallback(service_fn(
        |_req| async move { Ok::<_, Infallible>(not_found()) },
    )))
    .layer(SetResponseHeaderLayer::overriding(
        axum::http::header::CACHE_CONTROL,
        HeaderValue::from_static("no-cache"),
    ));

    Router::new()
        .route("/", get(index))
        .route("/uuid", get(uuid_route))
        .route("/sha", get(sha))
        .route("/icloud-private-relay", get(icloud_private_relay))
        .route("/slot", get(slot))
        .route("/microwave", get(microwave))
        .route("/weather", get(weather))
        .route("/echo", any(echo))
        .fallback_service(static_files)
        // Security headers
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
        .layer(
            TraceLayer::new_for_http()
            .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_request(DefaultOnRequest::new().level(Level::INFO))
                .on_response(
                    DefaultOnResponse::new()
                        .level(Level::INFO)
                        .latency_unit(tower_http::LatencyUnit::Micros),
                ),
        )
}
