//! Deployment slot endpoint.

use axum::http::header::{self, HeaderValue};
use axum::response::{IntoResponse, Response};

use crate::config::get_config;

pub async fn slot() -> Response {
    let config = get_config();
    let slot = match config.port {
        8080 => "blue",
        8081 => "green",
        _ => "unknown",
    };

    (
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        )],
        format!("{slot}\n"),
    )
        .into_response()
}
