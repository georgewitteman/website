use std::{fs::File, sync::OnceLock};

#[derive(Debug, Default, Clone)]
pub struct PrivateRelayIpRange {
    pub subnet: ipnet::IpNet,
    pub line: String,
}

fn get_ranges() -> &'static Vec<PrivateRelayIpRange> {
    static RANGES: OnceLock<Vec<PrivateRelayIpRange>> = OnceLock::new();
    RANGES.get_or_init(|| {
        let file =
            File::open("./static/private-relay-ip-addresses.csv").expect("File path should exist");
        let mut rdr = csv::Reader::from_reader(file);
        let mut ranges = vec![];
        for result in rdr.records() {
            let record = result.expect("File should be a valid CSV");
            let subnet: ipnet::IpNet = record
                .get(0)
                .expect("First column should always exist")
                .parse()
                .expect("IP address should be valid");
            let range = PrivateRelayIpRange {
                subnet,
                line: record.into_iter().collect::<Vec<&str>>().join(","),
            };
            ranges.push(range);
        }
        ranges
    })
}

pub fn get_private_relay_range(ip_addr: &std::net::IpAddr) -> Option<PrivateRelayIpRange> {
    let ranges = get_ranges();
    for range in ranges {
        if range.subnet.contains(ip_addr) {
            return Some(range.clone());
        }
    }
    None
}
