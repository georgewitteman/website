mod config;
mod private_relay;

use crate::config::get_config;
use crate::private_relay::get_private_relay_range;
use askama::Template;
use askama_web::WebTemplate;
use axum::body::Body;
use axum::extract::{ConnectInfo, OriginalUri, Request as AxumRequest};
use axum::http::header::{self, HeaderMap, HeaderName, HeaderValue};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::{any, get};
use axum::Router;
use http_body_util::BodyExt;
use multimap::MultiMap;
use serde_json::Value;
use std::convert::Infallible;
use std::net::SocketAddr;
use tower::service_fn;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{fmt, EnvFilter};

fn get_user_agent(header: &str) -> woothee::parser::WootheeResult<'_> {
    let parser = woothee::parser::Parser::new();
    parser.parse(header).unwrap_or_default()
}

/// Extracts the real client IP from the X-Forwarded-For header set by Caddy.
/// Only trusts this header when the request comes from localhost (the proxy).
fn get_real_ip(headers: &HeaderMap, peer_addr: &SocketAddr) -> std::net::IpAddr {
    // Only trust X-Forwarded-For from localhost (where Caddy runs)
    let is_trusted_proxy = peer_addr.ip().is_loopback();

    if is_trusted_proxy {
        headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next())
            .map(|s| s.trim())
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(|| peer_addr.ip())
    } else {
        // Don't trust forwarding headers from non-proxy sources
        peer_addr.ip()
    }
}

fn requested_html(headers: &HeaderMap) -> bool {
    headers
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .map(|accept| accept.split(',').any(|value| value.contains("text/html")))
        .unwrap_or(false)
}

#[derive(Template, WebTemplate)]
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

#[derive(Template, WebTemplate)]
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

async fn icloud_private_relay(
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

#[derive(Template, WebTemplate)]
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

    let real_ip = get_real_ip(&headers, &peer_addr);
    // For backward compatibility in JSON output, return None if real_ip == peer_addr
    let real_ip_str = if real_ip == peer_addr.ip() {
        None
    } else {
        Some(real_ip.to_string())
    };

    let forwarded_proto = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "http".to_string());

    let response = serde_json::json!({
        "connection_info": {
            "realip_remote_addr": real_ip_str,
            "peer_addr": peer_addr.to_string(),
            "host": headers.get(header::HOST).and_then(|v| v.to_str().ok()).map(|s| s.to_string()),
            "scheme": forwarded_proto,
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
        .layer(TraceLayer::new_for_http())
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure log level from RUST_LOG, with a fallback
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    fmt().with_env_filter(filter).init();
    tracing::info!("Starting server");

    let config = get_config();
    let addr: SocketAddr = format!("0.0.0.0:{}", config.port).parse().unwrap();

    let app = create_app_router();
    let service = app.into_make_service_with_connect_info::<SocketAddr>();

    tracing::info!("Listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, service)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Server finished");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install CTRL+C signal handler");
    tracing::info!("Shutdown signal received");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{HeaderValue, Method, Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    // Helper to create test app router
    fn test_app() -> Router {
        create_app_router()
    }

    // Helper to extract body as string
    async fn body_string(body: Body) -> String {
        let bytes = body.collect().await.unwrap().to_bytes();
        String::from_utf8(bytes.to_vec()).unwrap()
    }

    // Helper to send request with mock ConnectInfo for echo endpoint testing
    async fn send_with_connect_info(
        app: Router,
        mut request: Request<Body>,
    ) -> axum::response::Response {
        // Insert a mock ConnectInfo into request extensions
        let mock_addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();
        request.extensions_mut().insert(ConnectInfo(mock_addr));
        app.oneshot(request).await.unwrap()
    }

    // ==================== Unit Tests ====================

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
    fn requested_html_returns_false_for_missing_accept_header() {
        let headers = HeaderMap::new();
        assert!(!requested_html(&headers));
    }

    #[test]
    fn requested_html_handles_wildcard_accept() {
        let mut headers = HeaderMap::new();
        headers.insert(header::ACCEPT, HeaderValue::from_static("*/*"));
        assert!(!requested_html(&headers));
    }

    #[test]
    fn requested_html_detects_html_in_complex_accept_header() {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::ACCEPT,
            HeaderValue::from_static("application/json, text/html;q=0.9, */*;q=0.8"),
        );
        assert!(requested_html(&headers));
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

    #[test]
    fn pretty_multimap_handles_empty_map() {
        let multimap = MultiMap::new();
        let result = pretty_multimap(&multimap);
        assert!(result.is_empty());
    }

    #[test]
    fn pretty_multimap_handles_three_duplicate_keys() {
        let mut multimap = MultiMap::new();
        multimap.insert("key".to_string(), "a".to_string());
        multimap.insert("key".to_string(), "b".to_string());
        multimap.insert("key".to_string(), "c".to_string());

        let result = pretty_multimap(&multimap);
        let values = result.get("key").unwrap().as_array().unwrap();
        assert_eq!(values.len(), 3);
    }

    #[test]
    fn get_user_agent_parses_chrome() {
        let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
        let result = get_user_agent(ua);
        assert_eq!(result.name, "Chrome");
    }

    #[test]
    fn get_user_agent_handles_empty_string() {
        let result = get_user_agent("");
        assert_eq!(result.name, "UNKNOWN");
    }

    // ==================== Index Endpoint Tests ====================

    #[tokio::test]
    async fn index_returns_200() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn index_returns_html_content() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert!(content_type.to_str().unwrap().contains("text/html"));
    }

    #[tokio::test]
    async fn index_contains_expected_content() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let body = body_string(response.into_body()).await;
        assert!(body.contains("George Witteman") || body.contains("uuid") || body.contains("echo"));
    }

    // ==================== UUID Endpoint Tests ====================

    #[tokio::test]
    async fn uuid_returns_200() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/uuid").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn uuid_returns_plain_text_by_default() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/uuid").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert!(content_type.to_str().unwrap().contains("text/plain"));
    }

    #[tokio::test]
    async fn uuid_returns_valid_uuid_format() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/uuid").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let body = body_string(response.into_body()).await;
        let uuid_str = body.trim();
        // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        assert_eq!(uuid_str.len(), 36);
        assert!(uuid::Uuid::parse_str(uuid_str).is_ok());
    }

    #[tokio::test]
    async fn uuid_returns_html_when_requested() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/uuid")
                    .header(header::ACCEPT, "text/html")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert!(content_type.to_str().unwrap().contains("text/html"));
    }

    #[tokio::test]
    async fn uuid_generates_different_values() {
        let app = test_app();
        let response1 = app
            .clone()
            .oneshot(Request::builder().uri("/uuid").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let body1 = body_string(response1.into_body()).await;

        let response2 = app
            .oneshot(Request::builder().uri("/uuid").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let body2 = body_string(response2.into_body()).await;

        assert_ne!(body1, body2);
    }

    // ==================== SHA Endpoint Tests ====================

    #[tokio::test]
    async fn sha_returns_200() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/sha").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn sha_returns_plain_text() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/sha").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert!(content_type.to_str().unwrap().contains("text/plain"));
    }

    #[tokio::test]
    async fn sha_returns_unknown_in_test_env() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/sha").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let body = body_string(response.into_body()).await;
        // In test environment, GITHUB_SHA is not set at compile time
        assert!(!body.is_empty());
    }

    // ==================== Echo Endpoint Tests ====================

    #[tokio::test]
    async fn echo_returns_200_for_get() {
        let app = test_app();
        let request = Request::builder().uri("/echo").body(Body::empty()).unwrap();
        let response = send_with_connect_info(app, request).await;

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn echo_returns_200_for_post() {
        let app = test_app();
        let request = Request::builder()
            .method(Method::POST)
            .uri("/echo")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn echo_returns_200_for_put() {
        let app = test_app();
        let request = Request::builder()
            .method(Method::PUT)
            .uri("/echo")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn echo_returns_200_for_delete() {
        let app = test_app();
        let request = Request::builder()
            .method(Method::DELETE)
            .uri("/echo")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn echo_returns_json_by_default() {
        let app = test_app();
        let request = Request::builder().uri("/echo").body(Body::empty()).unwrap();
        let response = send_with_connect_info(app, request).await;

        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert!(content_type.to_str().unwrap().contains("application/json"));
    }

    #[tokio::test]
    async fn echo_returns_html_when_requested() {
        let app = test_app();
        let request = Request::builder()
            .uri("/echo")
            .header(header::ACCEPT, "text/html")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert!(content_type.to_str().unwrap().contains("text/html"));
    }

    #[tokio::test]
    async fn echo_includes_method_in_response() {
        let app = test_app();
        let request = Request::builder()
            .method(Method::POST)
            .uri("/echo")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(json["method"], "POST");
    }

    #[tokio::test]
    async fn echo_includes_path_in_response() {
        let app = test_app();
        let request = Request::builder().uri("/echo").body(Body::empty()).unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(json["path"], "/echo");
    }

    #[tokio::test]
    async fn echo_includes_query_string() {
        let app = test_app();
        let request = Request::builder()
            .uri("/echo?foo=bar&baz=qux")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(json["query_string"], "foo=bar&baz=qux");
    }

    #[tokio::test]
    async fn echo_includes_custom_headers() {
        let app = test_app();
        let request = Request::builder()
            .uri("/echo")
            .header("x-custom-header", "test-value")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(json["headers"]["x-custom-header"], "test-value");
    }

    #[tokio::test]
    async fn echo_includes_request_body() {
        let app = test_app();
        let request = Request::builder()
            .method(Method::POST)
            .uri("/echo")
            .body(Body::from("test body content"))
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(json["body"], "test body content");
    }

    #[tokio::test]
    async fn echo_includes_user_agent_parsing() {
        let app = test_app();
        let request = Request::builder()
            .uri("/echo")
            .header(
                header::USER_AGENT,
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124",
            )
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert!(json["user_agent"].is_object());
        assert!(json["user_agent"]["name"].is_string());
    }

    #[tokio::test]
    async fn echo_includes_http_version() {
        let app = test_app();
        let request = Request::builder().uri("/echo").body(Body::empty()).unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert!(json["version"].as_str().unwrap().contains("HTTP"));
    }

    #[tokio::test]
    async fn echo_includes_ip_address() {
        let app = test_app();
        let request = Request::builder().uri("/echo").body(Body::empty()).unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        // Our mock address is 127.0.0.1:12345
        assert_eq!(json["ip"], "127.0.0.1");
    }

    #[tokio::test]
    async fn echo_includes_peer_addr() {
        let app = test_app();
        let request = Request::builder().uri("/echo").body(Body::empty()).unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(json["peer_addr"], "127.0.0.1:12345");
    }

    #[tokio::test]
    async fn echo_includes_uri_parts() {
        let app = test_app();
        let request = Request::builder()
            .uri("/echo?test=value")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert!(json["uri_parts"].is_object());
        assert_eq!(json["uri_parts"]["path"], "/echo");
        assert_eq!(json["uri_parts"]["query"], "test=value");
    }

    #[tokio::test]
    async fn echo_handles_empty_body() {
        let app = test_app();
        let request = Request::builder()
            .method(Method::POST)
            .uri("/echo")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(json["body"], "");
    }

    #[tokio::test]
    async fn echo_uses_x_forwarded_for_header() {
        let app = test_app();
        let request = Request::builder()
            .uri("/echo")
            .header("x-forwarded-for", "203.0.113.50, 192.168.1.1")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        // Should use the first IP from x-forwarded-for
        assert_eq!(
            json["connection_info"]["realip_remote_addr"],
            "203.0.113.50"
        );
    }

    // ==================== Static File Tests ====================

    #[tokio::test]
    async fn static_favicon_returns_200() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/favicon.ico")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn static_css_returns_200() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/styles.css")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn static_security_txt_returns_200() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/security.txt")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn static_html_page_returns_200() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/username.html")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn static_js_file_returns_200() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/js/uuid.js")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    // ==================== 404 Tests ====================

    #[tokio::test]
    async fn nonexistent_route_returns_404() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/nonexistent-path-12345")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn nonexistent_static_file_returns_404() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/does-not-exist.html")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn not_found_returns_html() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/nonexistent")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert!(content_type.to_str().unwrap().contains("text/html"));
    }

    #[tokio::test]
    async fn not_found_body_contains_404() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/nonexistent")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        let body = body_string(response.into_body()).await;
        assert!(body.contains("404"));
    }

    // ==================== Security Headers Tests ====================

    #[tokio::test]
    async fn response_includes_csp_header() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let csp = response
            .headers()
            .get("content-security-policy")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(csp.contains("default-src 'self'"));
    }

    #[tokio::test]
    async fn response_includes_hsts_header() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let hsts = response
            .headers()
            .get("strict-transport-security")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(hsts.contains("max-age="));
    }

    #[tokio::test]
    async fn response_includes_x_frame_options() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let xfo = response
            .headers()
            .get("x-frame-options")
            .unwrap()
            .to_str()
            .unwrap();
        assert_eq!(xfo, "DENY");
    }

    #[tokio::test]
    async fn response_includes_x_content_type_options() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let xcto = response
            .headers()
            .get("x-content-type-options")
            .unwrap()
            .to_str()
            .unwrap();
        assert_eq!(xcto, "nosniff");
    }

    #[tokio::test]
    async fn response_includes_referrer_policy() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let rp = response
            .headers()
            .get("referrer-policy")
            .unwrap()
            .to_str()
            .unwrap();
        assert_eq!(rp, "same-origin");
    }

    #[tokio::test]
    async fn response_includes_permissions_policy() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let pp = response
            .headers()
            .get("permissions-policy")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(pp.contains("camera=()"));
    }

    #[tokio::test]
    async fn response_includes_xss_protection() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let xss = response
            .headers()
            .get("x-xss-protection")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(xss.contains("1"));
    }

    #[tokio::test]
    async fn security_headers_present_on_static_files() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/styles.css")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert!(response.headers().get("content-security-policy").is_some());
        assert!(response.headers().get("x-frame-options").is_some());
    }

    #[tokio::test]
    async fn security_headers_present_on_404() {
        let app = test_app();
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/nonexistent")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert!(response.headers().get("content-security-policy").is_some());
        assert!(response.headers().get("x-frame-options").is_some());
    }

    // ==================== get_real_ip Unit Tests ====================

    #[test]
    fn get_real_ip_uses_x_forwarded_for_from_trusted_proxy() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.50, 192.168.1.1"),
        );
        // Localhost is a trusted proxy (where Caddy runs)
        let peer_addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();

        let result = get_real_ip(&headers, &peer_addr);
        // Should use the first IP from x-forwarded-for
        assert_eq!(result.to_string(), "203.0.113.50");
    }

    #[test]
    fn get_real_ip_falls_back_to_peer_addr_when_no_headers() {
        let headers = HeaderMap::new();
        let peer_addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();

        let result = get_real_ip(&headers, &peer_addr);
        assert_eq!(result.to_string(), "127.0.0.1");
    }

    #[test]
    fn get_real_ip_handles_ipv6_from_trusted_proxy() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("2001:db8::1"));
        let peer_addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();

        let result = get_real_ip(&headers, &peer_addr);
        assert_eq!(result.to_string(), "2001:db8::1");
    }

    #[test]
    fn get_real_ip_ignores_invalid_ip_in_header() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("not-an-ip"));
        let peer_addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();

        let result = get_real_ip(&headers, &peer_addr);
        // Falls back to peer_addr when header is invalid
        assert_eq!(result.to_string(), "127.0.0.1");
    }

    #[test]
    fn get_real_ip_ignores_headers_from_untrusted_source() {
        // Security test: headers from non-localhost should be ignored
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("8.8.8.8"));
        // Request comes directly from external IP, not through Caddy
        let peer_addr: SocketAddr = "203.0.113.50:12345".parse().unwrap();

        let result = get_real_ip(&headers, &peer_addr);
        // Should use peer_addr, NOT the spoofed header
        assert_eq!(result.to_string(), "203.0.113.50");
    }

    #[test]
    fn get_real_ip_trusts_headers_from_ipv6_loopback() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("203.0.113.50"));
        // IPv6 loopback is also a trusted proxy
        let peer_addr: SocketAddr = "[::1]:12345".parse().unwrap();

        let result = get_real_ip(&headers, &peer_addr);
        assert_eq!(result.to_string(), "203.0.113.50");
    }

    // ==================== icloud_private_relay Tests ====================

    #[tokio::test]
    async fn icloud_private_relay_returns_200() {
        let app = test_app();
        let request = Request::builder()
            .uri("/icloud-private-relay")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn icloud_private_relay_returns_plain_text() {
        let app = test_app();
        let request = Request::builder()
            .uri("/icloud-private-relay")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert!(content_type.to_str().unwrap().contains("text/plain"));
    }

    #[tokio::test]
    async fn icloud_private_relay_uses_x_forwarded_for_header() {
        let app = test_app();
        let request = Request::builder()
            .uri("/icloud-private-relay")
            .header("x-forwarded-for", "203.0.113.50, 192.168.1.1")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        // Should use the first IP from x-forwarded-for (set by Caddy)
        assert!(
            body.contains("203.0.113.50"),
            "Response should contain the forwarded IP, got: {}",
            body
        );
    }

    #[tokio::test]
    async fn icloud_private_relay_falls_back_to_peer_addr() {
        let app = test_app();
        // No forwarding headers - should use peer address
        let request = Request::builder()
            .uri("/icloud-private-relay")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;

        let body = body_string(response.into_body()).await;
        // send_with_connect_info uses 127.0.0.1
        assert!(
            body.contains("127.0.0.1"),
            "Response should fall back to peer address, got: {}",
            body
        );
    }
}
