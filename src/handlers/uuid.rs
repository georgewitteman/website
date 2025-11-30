//! UUID generator endpoint.

use askama::Template;
use askama_web::WebTemplate;
use axum::extract::OriginalUri;
use axum::http::header::{self, HeaderMap, HeaderValue};
use axum::response::{IntoResponse, Response};

use crate::helpers::requested_html;

#[derive(Template, WebTemplate)]
#[template(path = "uuid.html.jinja")]
struct UuidTemplate {
    path: String,
    value: String,
}

pub async fn uuid_route(headers: HeaderMap, OriginalUri(uri): OriginalUri) -> Response {
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
