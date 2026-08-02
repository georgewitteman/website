//! iCloud Private Relay IP range lookup service.

use reqwest::header::{self, HeaderMap};
use reqwest::StatusCode;
use std::net::IpAddr;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(reqwest::Client::new);

const EGRESS_RANGES_URL: &str = "https://mask-api.icloud.com/egress-ip-ranges.csv";

/// Used when a response carries no usable `max-age`. Matches what Apple sends.
const DEFAULT_MAX_AGE: Duration = Duration::from_secs(3600);

#[derive(Clone)]
struct CachedRanges {
    body: Arc<[u8]>,
    etag: Option<String>,
    fresh_until: Instant,
}

static CACHE: LazyLock<Mutex<Option<CachedRanges>>> = LazyLock::new(|| Mutex::new(None));

/// Checks if an IP address belongs to iCloud Private Relay.
/// Returns the matching CSV line if found, or None if not a Private Relay IP.
pub async fn get_private_relay_range(ip_addr: &IpAddr) -> Result<Option<String>, reqwest::Error> {
    let csv = egress_ranges().await?;
    Ok(find_egress_range(&csv, ip_addr))
}

/// Fetches Apple's egress ranges, honouring `Cache-Control` and `ETag`.
///
/// The file is ~12 MB, and it was previously downloaded and parsed on every
/// request. It is now held in memory for the `max-age` the response advertises,
/// then revalidated with `If-None-Match`: Apple answers `304 Not Modified` when
/// nothing changed, which refreshes the entry without transferring the body.
async fn egress_ranges() -> Result<Arc<[u8]>, reqwest::Error> {
    // Cloned out so the lock is never held across an await.
    let cached = CACHE.lock().expect("cache mutex poisoned").clone();

    if let Some(entry) = &cached {
        if Instant::now() < entry.fresh_until {
            return Ok(entry.body.clone());
        }
    }

    let mut request = CLIENT.get(EGRESS_RANGES_URL);
    if let Some(etag) = cached.as_ref().and_then(|entry| entry.etag.as_deref()) {
        request = request.header(header::IF_NONE_MATCH, etag);
    }

    let response = request.send().await?.error_for_status()?;
    let status = response.status();
    let fresh_until = Instant::now() + max_age(response.headers());
    // A 304 should repeat the ETag, but keep the old one if it does not.
    let etag = response
        .headers()
        .get(header::ETAG)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
        .or_else(|| cached.as_ref().and_then(|entry| entry.etag.clone()));

    let body = match cached {
        Some(entry) if status == StatusCode::NOT_MODIFIED => entry.body,
        _ => Arc::from(response.bytes().await?.as_ref()),
    };

    *CACHE.lock().expect("cache mutex poisoned") = Some(CachedRanges {
        body: body.clone(),
        etag,
        fresh_until,
    });

    Ok(body)
}

/// Reads `max-age` out of `Cache-Control`, falling back to [`DEFAULT_MAX_AGE`].
fn max_age(headers: &HeaderMap) -> Duration {
    headers
        .get(header::CACHE_CONTROL)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| {
            value.split(',').find_map(|directive| {
                let (name, seconds) = directive.split_once('=')?;
                name.trim()
                    .eq_ignore_ascii_case("max-age")
                    .then_some(seconds)
            })
        })
        .and_then(|seconds| seconds.trim().parse().ok())
        .map(Duration::from_secs)
        .unwrap_or(DEFAULT_MAX_AGE)
}

/// Finds the egress range covering `ip_addr` in Apple's egress ranges CSV.
///
/// Rows that are malformed or whose first column is not a subnet are skipped:
/// this file is fetched from a third party, so a bad row should not take down
/// the request.
fn find_egress_range(csv: &[u8], ip_addr: &IpAddr) -> Option<String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(csv);

    for record in reader.records().flatten() {
        let Some(Ok(subnet)) = record.get(0).map(str::parse::<ipnet::IpNet>) else {
            continue;
        };
        if subnet.contains(ip_addr) {
            return Some(record.as_slice().to_owned());
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Same shape as https://mask-api.icloud.com/egress-ip-ranges.csv
    const SAMPLE: &[u8] = b"\
172.224.224.0/24,US,USCA,Santa Clara,7922
2a04:4e42:200::/48,US,USNY,New York,0
203.0.113.0/24,GB,GBENG,London,0
";

    #[test]
    fn finds_ipv4_range_containing_address() {
        let ip: IpAddr = "172.224.224.7".parse().unwrap();
        assert_eq!(
            find_egress_range(SAMPLE, &ip).as_deref(),
            Some("172.224.224.0/24USUSCASanta Clara7922")
        );
    }

    #[test]
    fn finds_ipv6_range_containing_address() {
        let ip: IpAddr = "2a04:4e42:200::1".parse().unwrap();
        assert!(find_egress_range(SAMPLE, &ip)
            .is_some_and(|line| line.starts_with("2a04:4e42:200::/48")));
    }

    #[test]
    fn returns_none_for_address_outside_every_range() {
        let ip: IpAddr = "8.8.8.8".parse().unwrap();
        assert_eq!(find_egress_range(SAMPLE, &ip), None);
    }

    #[test]
    fn returns_none_for_empty_input() {
        let ip: IpAddr = "172.224.224.7".parse().unwrap();
        assert_eq!(find_egress_range(b"", &ip), None);
    }

    fn headers(cache_control: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(header::CACHE_CONTROL, cache_control.parse().unwrap());
        headers
    }

    #[test]
    fn reads_max_age_from_cache_control() {
        // What mask-api.icloud.com actually sends.
        assert_eq!(max_age(&headers("max-age=3600")), Duration::from_secs(3600));
    }

    #[test]
    fn reads_max_age_alongside_other_directives() {
        assert_eq!(
            max_age(&headers("public, max-age=600, must-revalidate")),
            Duration::from_secs(600)
        );
        assert_eq!(
            max_age(&headers("no-cache, s-maxage=99, max-age=42")),
            Duration::from_secs(42)
        );
    }

    #[test]
    fn max_age_is_case_insensitive() {
        assert_eq!(max_age(&headers("Max-Age=120")), Duration::from_secs(120));
    }

    #[test]
    fn falls_back_when_max_age_is_missing_or_unusable() {
        assert_eq!(max_age(&HeaderMap::new()), DEFAULT_MAX_AGE);
        assert_eq!(max_age(&headers("no-store")), DEFAULT_MAX_AGE);
        assert_eq!(max_age(&headers("max-age=soon")), DEFAULT_MAX_AGE);
        // s-maxage is for shared caches; it must not be read as max-age.
        assert_eq!(max_age(&headers("s-maxage=60")), DEFAULT_MAX_AGE);
    }

    #[test]
    fn skips_malformed_rows_instead_of_panicking() {
        let csv = b"\
not-a-subnet,US,USCA,Santa Clara,7922

172.224.224.0/24,US,USCA,Santa Clara,7922
";
        let ip: IpAddr = "172.224.224.7".parse().unwrap();
        assert!(find_egress_range(csv, &ip).is_some());

        let ip: IpAddr = "8.8.8.8".parse().unwrap();
        assert_eq!(find_egress_range(csv, &ip), None);
    }
}
