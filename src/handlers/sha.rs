//! Git SHA endpoint for deployment tracking.

use axum::http::header::{self, HeaderValue};
use axum::response::{IntoResponse, Response};

pub async fn sha() -> Response {
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
