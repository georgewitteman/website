//! iCloud Private Relay IP range lookup service.

use std::net::IpAddr;
use std::sync::LazyLock;

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(reqwest::Client::new);

/// Checks if an IP address belongs to iCloud Private Relay.
/// Returns the matching CSV line if found, or None if not a Private Relay IP.
pub async fn get_private_relay_range(ip_addr: &IpAddr) -> Result<Option<String>, reqwest::Error> {
    let response = CLIENT
        .get("https://mask-api.icloud.com/egress-ip-ranges.csv")
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(response.as_ref());

    for result in reader.records() {
        let record = result.expect("File should be a valid CSV");
        let subnet: ipnet::IpNet = record
            .get(0)
            .expect("First column should always exist")
            .parse()
            .expect("IP address should be valid");
        if subnet.contains(ip_addr) {
            return Ok(Some(record.as_slice().to_owned()));
        }
    }

    Ok(None)
}
