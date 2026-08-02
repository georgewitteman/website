//! iCloud Private Relay IP range lookup service.

use std::net::IpAddr;
use std::sync::LazyLock;

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(reqwest::Client::new);

const EGRESS_RANGES_URL: &str = "https://mask-api.icloud.com/egress-ip-ranges.csv";

/// Checks if an IP address belongs to iCloud Private Relay.
/// Returns the matching CSV line if found, or None if not a Private Relay IP.
pub async fn get_private_relay_range(ip_addr: &IpAddr) -> Result<Option<String>, reqwest::Error> {
    let csv = CLIENT
        .get(EGRESS_RANGES_URL)
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    Ok(find_egress_range(csv.as_ref(), ip_addr))
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
