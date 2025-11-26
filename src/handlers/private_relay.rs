//! iCloud Private Relay detection endpoint.

use axum::extract::ConnectInfo;
use axum::http::header::{self, HeaderMap, HeaderValue};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use std::net::SocketAddr;

use crate::extractors::get_real_ip;
use crate::services::private_relay::get_private_relay_range;

pub async fn icloud_private_relay(
    headers: HeaderMap,
    ConnectInfo(peer_addr): ConnectInfo<SocketAddr>,
) -> Response {
    let real_ip = get_real_ip(&headers, &peer_addr);
    match get_private_relay_range(&real_ip).await {
        Ok(None) => (
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; charset=utf-8"),
            )],
            format!("{} is not iCloud Private Relay", real_ip),
        )
            .into_response(),
        Ok(Some(line)) => (
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain; charset=utf-8"),
            )],
            format!("{}: {}", real_ip, line),
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
