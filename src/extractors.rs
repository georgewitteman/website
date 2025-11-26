//! Request extractors for handling proxy headers.
//!
//! These extractors safely handle X-Forwarded-* headers from trusted proxies (Caddy).

use axum::http::header::HeaderMap;
use std::net::{IpAddr, SocketAddr};

/// Returns true if the peer address is a trusted proxy (localhost).
pub fn is_trusted_proxy(peer_addr: &SocketAddr) -> bool {
    peer_addr.ip().is_loopback()
}

/// Extracts the real client IP from the X-Forwarded-For header set by Caddy.
/// Only trusts this header when the request comes from localhost (the proxy).
pub fn get_real_ip(headers: &HeaderMap, peer_addr: &SocketAddr) -> IpAddr {
    if is_trusted_proxy(peer_addr) {
        headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next())
            .map(|s| s.trim())
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(|| peer_addr.ip())
    } else {
        peer_addr.ip()
    }
}

/// Extracts the real protocol from the X-Forwarded-Proto header set by Caddy.
/// Only trusts this header when the request comes from localhost (the proxy).
pub fn get_real_proto<'a>(headers: &'a HeaderMap, peer_addr: &SocketAddr) -> &'a str {
    if is_trusted_proxy(peer_addr) {
        headers
            .get("x-forwarded-proto")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("http")
    } else {
        "http"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    // ==================== get_real_ip Tests ====================

    #[test]
    fn get_real_ip_uses_x_forwarded_for_from_trusted_proxy() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.50, 192.168.1.1"),
        );
        let peer_addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();

        let result = get_real_ip(&headers, &peer_addr);
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
        assert_eq!(result.to_string(), "127.0.0.1");
    }

    #[test]
    fn get_real_ip_ignores_headers_from_untrusted_source() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("8.8.8.8"));
        let peer_addr: SocketAddr = "203.0.113.50:12345".parse().unwrap();

        let result = get_real_ip(&headers, &peer_addr);
        assert_eq!(result.to_string(), "203.0.113.50");
    }

    #[test]
    fn get_real_ip_trusts_headers_from_ipv6_loopback() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", HeaderValue::from_static("203.0.113.50"));
        let peer_addr: SocketAddr = "[::1]:12345".parse().unwrap();

        let result = get_real_ip(&headers, &peer_addr);
        assert_eq!(result.to_string(), "203.0.113.50");
    }

    // ==================== get_real_proto Tests ====================

    #[test]
    fn get_real_proto_uses_header_from_trusted_proxy() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        let peer_addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();

        let result = get_real_proto(&headers, &peer_addr);
        assert_eq!(result, "https");
    }

    #[test]
    fn get_real_proto_falls_back_to_http_when_no_header() {
        let headers = HeaderMap::new();
        let peer_addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();

        let result = get_real_proto(&headers, &peer_addr);
        assert_eq!(result, "http");
    }

    #[test]
    fn get_real_proto_ignores_header_from_untrusted_source() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        let peer_addr: SocketAddr = "203.0.113.50:12345".parse().unwrap();

        let result = get_real_proto(&headers, &peer_addr);
        assert_eq!(result, "http");
    }

    #[test]
    fn get_real_proto_trusts_header_from_ipv6_loopback() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        let peer_addr: SocketAddr = "[::1]:12345".parse().unwrap();

        let result = get_real_proto(&headers, &peer_addr);
        assert_eq!(result, "https");
    }
}
