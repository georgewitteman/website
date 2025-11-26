//! Index page handler.

use askama::Template;
use askama_web::WebTemplate;
use axum::extract::OriginalUri;
use axum::response::{IntoResponse, Response};

#[derive(Template, WebTemplate)]
#[template(path = "index.html")]
struct IndexTemplate {
    path: String,
}

pub async fn index(OriginalUri(uri): OriginalUri) -> Response {
    IndexTemplate {
        path: uri.path().to_string(),
    }
    .into_response()
}
