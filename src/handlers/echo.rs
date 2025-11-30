//! Echo endpoint that returns request information.

use askama::Template;
use askama_web::WebTemplate;
use axum::body::Body;
use axum::extract::{ConnectInfo, OriginalUri, Request as AxumRequest};
use axum::http::header::{self, HeaderValue};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use http_body_util::BodyExt;
use multimap::MultiMap;
use std::net::SocketAddr;

use crate::config::get_config;
use crate::extractors::{get_real_ip, get_real_proto};
use crate::helpers::{get_user_agent, pretty_multimap, requested_html};

#[derive(Template, WebTemplate)]
#[template(path = "echo.html.jinja")]
struct EchoTemplate {
    path: String,
    value: String,
    body: String,
}

pub async fn echo(
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

    let real_ip = get_real_ip(&headers, &peer_addr);
    // For backward compatibility in JSON output, return None if real_ip == peer_addr
    let real_ip_str = if real_ip == peer_addr.ip() {
        None
    } else {
        Some(real_ip.to_string())
    };

    let scheme = get_real_proto(&headers, &peer_addr);

    let response = serde_json::json!({
        "connection_info": {
            "realip_remote_addr": real_ip_str,
            "peer_addr": peer_addr.to_string(),
            "host": headers.get(header::HOST).and_then(|v| v.to_str().ok()).map(|s| s.to_string()),
            "scheme": scheme,
        },
        "version": format!("{:?}", request.version()),
        "method": request.method().as_str(),
        "uri": request.uri().to_string(),
        "app_config": {
            "host": config.website_domain.clone(),
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
