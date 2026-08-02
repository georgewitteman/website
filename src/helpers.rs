//! Utility functions used across handlers.

use axum::http::header::{self, HeaderMap};
use multimap::MultiMap;
use serde_json::Value;

/// Percent-encodes one query-string value.
///
/// Hand-rolled because `reqwest`'s `query` feature is not enabled and turning
/// it on would pull `serde_urlencoded` in for the handful of parameters this
/// site sends.
pub fn urlencode(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push('+'),
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

/// Builds a `key=value&key=value` query string, encoding each value.
pub fn query_string(parameters: &[(&str, &str)]) -> String {
    parameters
        .iter()
        .map(|(key, value)| format!("{key}={}", urlencode(value)))
        .collect::<Vec<String>>()
        .join("&")
}

/// Parses a User-Agent string into structured data.
pub fn get_user_agent(header: &str) -> woothee::parser::WootheeResult<'_> {
    let parser = woothee::parser::Parser::new();
    parser.parse(header).unwrap_or_default()
}

/// Checks if the request accepts HTML responses.
pub fn requested_html(headers: &HeaderMap) -> bool {
    headers
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .map(|accept| accept.split(',').any(|value| value.contains("text/html")))
        .unwrap_or(false)
}

/// Converts a MultiMap to a JSON-friendly format, merging duplicate keys into arrays.
pub fn pretty_multimap(map: &MultiMap<String, String>) -> serde_json::Map<String, Value> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn urlencode_escapes_everything_outside_the_unreserved_set() {
        assert_eq!(urlencode("San Francisco"), "San+Francisco");
        assert_eq!(urlencode("Ni\u{f1}o"), "Ni%C3%B1o");
        assert_eq!(urlencode("a-b_c.d~e"), "a-b_c.d~e");
        assert_eq!(urlencode("a&b=c"), "a%26b%3Dc");
        assert_eq!(
            urlencode("temperature_2m,cloud_cover"),
            "temperature_2m%2Ccloud_cover"
        );
        assert_eq!(urlencode(""), "");
    }

    #[test]
    fn query_string_joins_and_encodes_each_value() {
        assert_eq!(
            query_string(&[("latitude", "37.7596"), ("name", "San Francisco")]),
            "latitude=37.7596&name=San+Francisco"
        );
        assert_eq!(query_string(&[]), "");
    }

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
}
