use std::str::FromStr;
use std::sync::OnceLock;

pub struct Config {
    pub port: u16,
    pub website_domain: String,
}

pub fn get_config() -> &'static Config {
    static CONFIG: OnceLock<Config> = OnceLock::new();
    CONFIG.get_or_init(|| {
        let port: u16 = u16::from_str(&std::env::var("PORT").unwrap_or_default()).unwrap_or(8080);
        let website_domain = std::env::var("SERVER_HOSTNAME").unwrap_or("localhost".to_owned());

        Config {
            port,
            website_domain,
        }
    })
}
