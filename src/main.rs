//! Personal website backend server.

mod config;
mod extractors;
mod handlers;
mod helpers;
mod router;
mod services;

use std::net::SocketAddr;

use tracing_subscriber::{fmt, EnvFilter};

use crate::config::get_config;
use crate::router::create_app_router;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Configure log level from RUST_LOG, with a fallback
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    fmt().with_env_filter(filter).compact().init();
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
    use axum::body::Body;
    use axum::extract::ConnectInfo;
    use axum::http::header;
    use axum::http::{Method, Request, StatusCode};
    use axum::Router;
    use http_body_util::BodyExt;
    use std::net::SocketAddr;
    use tower::ServiceExt;

    use crate::router::create_app_router;

    fn test_app() -> Router {
        create_app_router()
    }

    async fn body_string(body: Body) -> String {
        let bytes = body.collect().await.unwrap().to_bytes();
        String::from_utf8(bytes.to_vec()).unwrap()
    }

    async fn send_with_connect_info(
        app: Router,
        mut request: Request<Body>,
    ) -> axum::response::Response {
        let mock_addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();
        request.extensions_mut().insert(ConnectInfo(mock_addr));
        app.oneshot(request).await.unwrap()
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

    // ==================== Slot Endpoint Tests ====================

    #[tokio::test]
    async fn slot_returns_200() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/slot").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn slot_returns_plain_text() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/slot").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert!(content_type.to_str().unwrap().contains("text/plain"));
    }

    #[tokio::test]
    async fn slot_returns_valid_slot_name() {
        let app = test_app();
        let response = app
            .oneshot(Request::builder().uri("/slot").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let body = body_string(response.into_body()).await;
        let slot = body.trim();
        assert!(
            slot == "blue" || slot == "green" || slot == "unknown",
            "Expected slot to be 'blue', 'green', or 'unknown', got: {}",
            slot
        );
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
        assert!(
            body.contains("203.0.113.50"),
            "Response should contain the forwarded IP, got: {}",
            body
        );
    }

    #[tokio::test]
    async fn icloud_private_relay_falls_back_to_peer_addr() {
        let app = test_app();
        let request = Request::builder()
            .uri("/icloud-private-relay")
            .body(Body::empty())
            .unwrap();
        let response = send_with_connect_info(app, request).await;
        let body = body_string(response.into_body()).await;
        assert!(
            body.contains("127.0.0.1"),
            "Response should fall back to peer address, got: {}",
            body
        );
    }
}
