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

/// One row of Apple's egress ranges CSV.
///
/// The file's fifth column is empty on every row, so it is not modelled.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EgressRange {
    pub subnet: ipnet::IpNet,
    /// ISO 3166-1 alpha-2, e.g. `GB`. Always present.
    pub country: String,
    /// ISO 3166-2 subdivision, e.g. `GB-EN`. Absent on roughly 10% of rows.
    pub region: Option<String>,
    /// e.g. `London`. Absent on a small number of rows.
    pub city: Option<String>,
}

impl std::fmt::Display for EgressRange {
    /// e.g. `172.224.226.0/27, London, GB-EN, GB`, skipping absent fields.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.subnet)?;
        let details = [
            self.city.as_deref(),
            self.region.as_deref(),
            Some(self.country.as_str()),
        ];
        for detail in details.into_iter().flatten() {
            write!(f, ", {detail}")?;
        }
        Ok(())
    }
}

#[derive(Clone)]
struct CachedRanges {
    ranges: Arc<[EgressRange]>,
    etag: Option<String>,
    fresh_until: Instant,
}

static CACHE: LazyLock<Mutex<Option<CachedRanges>>> = LazyLock::new(|| Mutex::new(None));

/// Checks if an IP address belongs to iCloud Private Relay.
/// Returns the matching CSV line if found, or None if not a Private Relay IP.
pub async fn get_private_relay_range(
    ip_addr: &IpAddr,
) -> Result<Option<EgressRange>, reqwest::Error> {
    let ranges = egress_ranges().await?;
    Ok(find_egress_range(&ranges, ip_addr).cloned())
}

/// Fetches and parses Apple's egress ranges, honouring `Cache-Control` and `ETag`.
///
/// The file is ~12 MB and nearly 300k rows, and it used to be downloaded and
/// parsed on every request. The parsed ranges are now held in memory for the
/// `max-age` the response advertises, then revalidated with `If-None-Match`:
/// Apple answers `304 Not Modified` when nothing changed, which refreshes the
/// entry without transferring or reparsing anything.
async fn egress_ranges() -> Result<Arc<[EgressRange]>, reqwest::Error> {
    // Cloned out so the lock is never held across an await.
    let cached = CACHE.lock().expect("cache mutex poisoned").clone();

    if let Some(entry) = &cached {
        if Instant::now() < entry.fresh_until {
            return Ok(entry.ranges.clone());
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

    let ranges = match cached {
        Some(entry) if status == StatusCode::NOT_MODIFIED => entry.ranges,
        _ => Arc::from(parse_egress_ranges(&response.bytes().await?)),
    };

    *CACHE.lock().expect("cache mutex poisoned") = Some(CachedRanges {
        ranges: ranges.clone(),
        etag,
        fresh_until,
    });

    Ok(ranges)
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

/// Parses Apple's egress ranges CSV.
///
/// Rows that are malformed or whose first column is not a subnet are skipped:
/// this file is fetched from a third party, so a bad row should not take down
/// the request.
fn parse_egress_ranges(csv: &[u8]) -> Vec<EgressRange> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(csv);

    reader
        .records()
        .flatten()
        .filter_map(|record| {
            Some(EgressRange {
                subnet: record.get(0)?.parse().ok()?,
                country: record.get(1)?.to_owned(),
                region: optional_field(record.get(2)),
                city: optional_field(record.get(3)),
            })
        })
        .collect()
}

/// Apple leaves an unknown field empty rather than omitting the column.
fn optional_field(field: Option<&str>) -> Option<String> {
    field.filter(|value| !value.is_empty()).map(str::to_owned)
}

/// Finds the first range covering `ip_addr`.
fn find_egress_range<'a>(ranges: &'a [EgressRange], ip_addr: &IpAddr) -> Option<&'a EgressRange> {
    ranges.iter().find(|range| range.subnet.contains(ip_addr))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Real rows from https://mask-api.icloud.com/egress-ip-ranges.csv.
    /// The fifth column is empty on every row of the real file.
    const SAMPLE: &[u8] = b"\
172.224.226.0/27,GB,GB-EN,London,
2a02:26f7:e52c:583a::/64,BR,BR-MG,Alfenas,
146.75.253.252/31,US,US-MA,NEEDHAM,
5.62.61.64/29,AD,,Andorra la Vella,
41.207.98.0/25,TG,,,
";

    /// Looks an address up the way the service does: parse, then search.
    fn lookup(csv: &[u8], ip: &str) -> Option<EgressRange> {
        find_egress_range(&parse_egress_ranges(csv), &ip.parse().unwrap()).cloned()
    }

    #[test]
    fn finds_ipv4_range_containing_address() {
        assert_eq!(
            lookup(SAMPLE, "172.224.226.5"),
            Some(EgressRange {
                subnet: "172.224.226.0/27".parse().unwrap(),
                country: "GB".to_owned(),
                region: Some("GB-EN".to_owned()),
                city: Some("London".to_owned()),
            })
        );
    }

    #[test]
    fn finds_ipv6_range_containing_address() {
        let found = lookup(SAMPLE, "2a02:26f7:e52c:583a::1").unwrap();
        assert_eq!(found.subnet, "2a02:26f7:e52c:583a::/64".parse().unwrap());
        assert_eq!(found.city.as_deref(), Some("Alfenas"));
    }

    #[test]
    fn treats_empty_columns_as_absent() {
        let no_region = lookup(SAMPLE, "5.62.61.65").unwrap();
        assert_eq!(no_region.region, None);
        assert_eq!(no_region.city.as_deref(), Some("Andorra la Vella"));

        let neither = lookup(SAMPLE, "41.207.98.1").unwrap();
        assert_eq!(neither.region, None);
        assert_eq!(neither.city, None);
        assert_eq!(neither.country, "TG");
    }

    #[test]
    fn formats_a_range_for_display() {
        assert_eq!(
            lookup(SAMPLE, "172.224.226.5").unwrap().to_string(),
            "172.224.226.0/27, London, GB-EN, GB"
        );
        // Absent fields are skipped rather than left as empty gaps.
        assert_eq!(
            lookup(SAMPLE, "5.62.61.65").unwrap().to_string(),
            "5.62.61.64/29, Andorra la Vella, AD"
        );
        assert_eq!(
            lookup(SAMPLE, "41.207.98.1").unwrap().to_string(),
            "41.207.98.0/25, TG"
        );
    }

    #[test]
    fn returns_none_for_address_outside_every_range() {
        assert_eq!(lookup(SAMPLE, "8.8.8.8"), None);
    }

    #[test]
    fn returns_none_for_empty_input() {
        assert_eq!(lookup(b"", "172.224.226.5"), None);
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
not-a-subnet,GB,GB-EN,London,

172.224.226.0/27,GB,GB-EN,London,
";
        assert_eq!(parse_egress_ranges(csv).len(), 1);
        assert!(lookup(csv, "172.224.226.5").is_some());
        assert_eq!(lookup(csv, "8.8.8.8"), None);
    }
}
