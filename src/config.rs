use std::str::FromStr;
use std::sync::OnceLock;
pub struct Config {
    pub tls_enabled: bool,

    pub http_port: u16,
    pub https_port: u16,

    pub website_domain: String,
    pub http_only_domain: String,
}

pub fn get_config() -> &'static Config {
    static CONFIG: OnceLock<Config> = OnceLock::new();
    CONFIG.get_or_init(|| {
        let http_port: u16 =
            u16::from_str(&std::env::var("PORT").unwrap_or_default()).unwrap_or(8000);
        let https_port: u16 =
            u16::from_str(&std::env::var("PORT_HTTPS").unwrap_or_default()).unwrap_or(8443);
        let website_domain = std::env::var("SERVER_HOSTNAME").unwrap_or("localhost".to_owned());
        let http_only_domain =
            std::env::var("HTTP_SERVER_HOSTNAME").unwrap_or("127.0.0.1".to_owned());

        Config {
            tls_enabled: website_domain != "localhost",
            http_port,
            https_port,
            website_domain,
            http_only_domain,
        }
    })
}
