use actix_web::dev::Service;
use actix_web::http::header::Header;
use actix_web::{get, App, HttpResponse, HttpServer};
use actix_web::{
    http::header::HeaderName,
    middleware::Logger,
    web::{self},
    HttpRequest, Responder,
};
use askama_actix::TemplateToResponse;
use futures_util::future::{self, Either};
use rustls_pemfile::certs;
use rustls_pemfile::ec_private_keys;
use serde_json::Value;

fn get_user_agent(header: &str) -> woothee::parser::WootheeResult {
    let parser = woothee::parser::Parser::new();
    parser.parse(header).unwrap_or_default()
}

fn requested_html(accept_header: &Option<actix_web::http::header::Accept>) -> bool {
    let accept = match accept_header {
        Some(hdr) => hdr,
        None => return false,
    };
    for item in &accept.0 {
        if item.item.subtype() == "html" {
            return true;
        }
    }
    false
}

#[derive(askama_actix::Template)]
#[template(path = "uuid.html")]
struct UuidTemplate<'a> {
    path: &'a str,
    value: &'a str,
}

#[get("/uuid")]
async fn uuid_route(req: HttpRequest) -> impl Responder {
    let result = uuid::Uuid::new_v4();
    if requested_html(&actix_web::http::header::Accept::parse(&req).ok()) {
        let template = UuidTemplate {
            path: req.path(),
            value: &result.to_string(),
        };
        template.to_response()
    } else {
        HttpResponse::Ok()
            .insert_header((
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ContentType::plaintext(),
            ))
            .body(format!("{}\n", result))
    }
}

#[derive(askama_actix::Template)]
#[template(path = "index.html")]
struct IndexTemplate<'a> {
    path: &'a str,
}

#[get("/")]
async fn hello(req: HttpRequest) -> impl Responder {
    let template = IndexTemplate { path: req.path() };
    template.to_response()
}

#[derive(askama_actix::Template)]
#[template(path = "amazon-short-link.html")]
struct AmazonShortLinkTemplate<'a> {
    path: &'a str,
}

#[get("/amazon-short-link")]
async fn amazon_short_link(req: HttpRequest) -> impl Responder {
    let template = AmazonShortLinkTemplate { path: req.path() };
    template.to_response()
}

fn pretty_multimap(map: &multimap::MultiMap<String, String>) -> serde_json::Map<String, Value> {
    let mut pretty_map = serde_json::Map::new();
    for (k, v) in map.flat_iter() {
        let k = k.as_str().to_owned();
        let v = String::from_utf8_lossy(v.as_bytes()).into_owned();
        if let Some(existing_value) = pretty_map.get_mut(&k) {
            if let Some(existing_array) = existing_value.as_array_mut() {
                existing_array.push(v.into());
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

#[derive(askama_actix::Template)]
#[template(path = "echo.html")]
struct EchoTemplate<'a> {
    path: &'a str,
    value: &'a str,
    body: &'a str,
}

#[actix_web::route(
    "/echo",
    method = "GET",
    method = "POST",
    method = "PUT",
    method = "PATCH"
)]
async fn echo(req: HttpRequest, body: actix_web::web::Bytes) -> impl Responder {
    let parsed_user_agent = get_user_agent(
        req.headers()
            .get("user-agent")
            .and_then(|v| v.to_str().ok())
            .unwrap_or(""),
    );
    let mut headers = multimap::MultiMap::new();
    for (k, v) in req.headers() {
        let k = k.as_str().to_owned();
        let v = String::from_utf8_lossy(v.as_bytes()).into_owned();
        headers.insert(k, v)
    }
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html
    let ip_addr = req.peer_addr().map(|a| a.ip());

    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html
    let host = req
        .headers()
        .get(&HeaderName::from_static("host"))
        .and_then(|v| v.to_str().ok())
        .or_else(|| {
            req.uri()
                .authority()
                .map(actix_web::http::uri::Authority::as_str)
        })
        .unwrap_or_else(|| req.app_config().host())
        .to_owned();

    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html
    let scheme = req
        .uri()
        .scheme()
        .map(actix_web::http::uri::Scheme::as_str)
        .or_else(|| Some("https").filter(|_| req.app_config().secure()))
        .unwrap_or("http")
        .to_owned();

    let url = url::Url::parse(&format!(
        "{}://{}{}",
        scheme.as_str(),
        host.as_str(),
        req.uri().path_and_query().map_or("", |pq| pq.as_str())
    ))
    .unwrap_or(
        url::Url::parse("http://example.com").expect("http://example.com should be a valid URL"),
    );

    let query: multimap::MultiMap<String, String> = multimap::MultiMap::from_iter(
        url.query_pairs()
            .map(|val| (val.0.to_string(), val.1.to_string())),
    );

    let request_body = String::from_utf8(body.as_ref().into())
        .unwrap_or_else(|e| format!("<binary {} bytes>", e.as_bytes().len()));

    let response = serde_json::json!({
        "version": format!("{:?}", req.head().version),
        "method": req.method().to_string(),
        "full_url": url,
        "uri": req.uri().to_string(),
        "url": {
            "authority": url.authority(),
            "domain": url.domain(),
            "fragment": url.fragment(),
            "origin": url.origin().unicode_serialization(),
            "password": url.password(),
            "port": url.port(),
            "scheme": url.scheme(),
            "username": url.username(),
            "host": url.host_str(),
            "path": url.path(),
            "query": url.query(),
        },
        "query": pretty_multimap(&query),
        "ip": ip_addr,
        "host": url.host_str(),
        "headers": pretty_multimap(&headers),
        "body": &request_body,
        "user_agent": {
            "name": parsed_user_agent.name,
            "category": parsed_user_agent.category,
            "os": parsed_user_agent.os,
            "os_version": parsed_user_agent.os_version,
            "browser_type": parsed_user_agent.browser_type,
            "version": parsed_user_agent.version,
            "vendor": parsed_user_agent.vendor,
        }
    });
    match serde_json::to_string_pretty(&response) {
        Ok(body) => {
            if requested_html(&actix_web::http::header::Accept::parse(&req).ok()) {
                let template = EchoTemplate {
                    path: req.path(),
                    body: &request_body,
                    value: &body,
                };
                template.to_response()
            } else {
                HttpResponse::Ok()
                    .insert_header((
                        actix_web::http::header::CONTENT_TYPE,
                        actix_web::http::header::ContentType::json(),
                    ))
                    .body(format!("{body}\n"))
            }
        }
        Err(err) => HttpResponse::from_error(actix_web::error::JsonPayloadError::Serialize(err)),
    }
}

async fn manual_hello() -> impl Responder {
    HttpResponse::Ok().body("Hey there!")
}

fn get_tls_config() -> Result<rustls::ServerConfig, rustls::Error> {
    let config = rustls::ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth();

    let cert_file = &mut std::io::BufReader::new(
        std::fs::File::open("fullchain.pem")
            .map_err(|e| rustls::Error::General(format!("Missing fullchain.pem: {:?}", e)))?,
    );
    let key_file = &mut std::io::BufReader::new(
        std::fs::File::open("key.pem")
            .map_err(|e| rustls::Error::General(format!("Missing key.pem: {:?}", e)))?,
    );

    // convert files to key/cert objects
    let cert_chain = certs(cert_file)
        .unwrap()
        .into_iter()
        .map(rustls::Certificate)
        .collect();
    let keys: Vec<rustls::PrivateKey> = ec_private_keys(key_file)
        .unwrap()
        .into_iter()
        .map(rustls::PrivateKey)
        .collect();

    match keys.first() {
        None => Err(rustls::Error::General("Missing private key".to_string())),
        Some(private_key) => config.with_single_cert(cert_chain, private_key.to_owned()),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    log::info!("Starting server");
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let port = std::env::var("PORT").unwrap_or("8000".to_owned());
    let port_https = std::env::var("PORT_HTTPS").unwrap_or("8443".to_owned());
    log::info!("port: {port}; port_https: {port_https}");

    let maybe_tls_config = get_tls_config();
    let redirect_https = maybe_tls_config.is_ok();
    if let Err(tls_config_err) = &maybe_tls_config {
        log::info!(
            "skipping tls because we couldn't find the config: {:?}",
            tls_config_err
        );
    }

    let mut srv = HttpServer::new(move || {
        App::new()
            .wrap_fn(move |sreq, srv| {
                if !redirect_https {
                    return Either::Left(srv.call(sreq));
                }
                let host = sreq
                    .headers()
                    .get(&HeaderName::from_static("host"))
                    .and_then(|v| v.to_str().ok())
                    .or_else(|| {
                        sreq.uri()
                            .authority()
                            .map(actix_web::http::uri::Authority::as_str)
                    })
                    .unwrap_or_else(|| sreq.app_config().host())
                    .to_owned();
                let uri = sreq.uri().to_owned();
                let url = format!("https://{host}{uri}");

                // If the scheme is "https" then it will let other services below this wrap_fn
                // handle the request and if it's "http" then a response with redirect status code
                // will be sent whose "location" header will be same as before, with just "http"
                // changed to "https"

                let scheme = sreq
                    .uri()
                    .scheme()
                    .map(actix_web::http::uri::Scheme::as_str)
                    .or_else(|| Some("https").filter(|_| sreq.app_config().secure()))
                    .unwrap_or("http")
                    .to_owned();
                if scheme == "https" {
                    Either::Left(srv.call(sreq))
                } else {
                    Either::Right(future::ready(Ok(sreq.into_response(
                        HttpResponse::MovedPermanently()
                            .append_header((actix_web::http::header::LOCATION, url))
                            .finish(),
                    ))))
                }
            })
            .wrap(actix_web::middleware::Compress::default())
            .wrap(Logger::default())
            .service(amazon_short_link)
            .service(uuid_route)
            .service(hello)
            .service(echo)
            .route("/hey", web::get().to(manual_hello))
            .service(actix_files::Files::new("/", "./static").use_hidden_files())
    })
    // Short timeout for now to have faster deploys
    .shutdown_timeout(10)
    .bind(format!("0.0.0.0:{port}"))?;

    if let Ok(tls_config) = maybe_tls_config {
        srv = srv.bind_rustls_021(format!("0.0.0.0:{port_https}"), tls_config)?;
    }

    srv.run().await?;
    log::info!("Server finished");
    Ok(())
}
