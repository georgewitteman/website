//! Utility functions used across handlers.

use axum::http::header::{self, HeaderMap};
use multimap::MultiMap;
use serde_json::Value;

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
