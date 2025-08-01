mod config;
mod private_relay;

use crate::config::get_config;
use crate::private_relay::get_private_relay_range;
use actix_web::dev::Service;
use actix_web::http::header::{
    Accept, ContentType, CONTENT_SECURITY_POLICY, LOCATION, PERMISSIONS_POLICY, REFERRER_POLICY,
    STRICT_TRANSPORT_SECURITY, X_CONTENT_TYPE_OPTIONS, X_FRAME_OPTIONS,
};
use actix_web::http::header::{Header, X_XSS_PROTECTION};
use actix_web::http::uri::Scheme;
use actix_web::{get, web, App, HttpResponse, HttpServer};
use actix_web::{middleware::Logger, HttpRequest, Responder};
use askama::Template;
use askama_web::WebTemplate;
use futures_util::future::{self, Either};
use rustls_acme::{caches::DirCache, futures_rustls::rustls::ServerConfig, AcmeConfig};
use serde_json::Value;
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use tokio_stream::StreamExt;

fn get_user_agent(header: &str) -> woothee::parser::WootheeResult {
    let parser = woothee::parser::Parser::new();
    parser.parse(header).unwrap_or_default()
}

fn requested_html(accept_header: &Option<Accept>) -> bool {
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

#[derive(Template, WebTemplate)]
#[template(path = "uuid.html")]
struct UuidTemplate<'a> {
    path: &'a str,
    value: &'a str,
}

#[get("/uuid")]
async fn uuid_route(req: HttpRequest) -> impl Responder {
    let result = uuid::Uuid::new_v4();
    if requested_html(&Accept::parse(&req).ok()) {
        let template = UuidTemplate {
            path: req.path(),
            value: &result.to_string(),
        };
        template.respond_to(&req)
    } else {
        HttpResponse::Ok()
            .content_type(ContentType::plaintext())
            .body(format!("{}\n", result))
    }
}

#[derive(Template, WebTemplate)]
#[template(path = "index.html")]
struct IndexTemplate<'a> {
    path: &'a str,
}

#[get("/")]
async fn index(req: HttpRequest) -> impl Responder {
    let template = IndexTemplate { path: req.path() };
    template.respond_to(&req)
}

#[get("/sha")]
async fn sha() -> impl Responder {
    let sha = option_env!("GITHUB_SHA").unwrap_or("unknown");
    HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(sha)
}

#[get("/icloud-private-relay")]
async fn icloud_private_relay(req: HttpRequest) -> impl Responder {
    let socket_addr = match req.peer_addr() {
        Some(socket_addr) => socket_addr,
        None => {
            return HttpResponse::BadRequest()
                .content_type(ContentType::plaintext())
                .body("missing IP address");
        }
    };

    match get_private_relay_range(&socket_addr.ip()).await {
        Ok(None) => HttpResponse::Ok()
            .content_type(ContentType::plaintext())
            .body(format!("{} is not iCloud Private Relay", socket_addr.ip())),

        Ok(Some(line)) => HttpResponse::Ok()
            .content_type(ContentType::plaintext())
            .body(format!("{}: {}", socket_addr.ip(), line)),

        Err(e) => HttpResponse::InternalServerError()
            .content_type(ContentType::plaintext())
            .body(e.to_string()),
    }
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

#[derive(Template, WebTemplate)]
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

    let connection_info = req.connection_info();

    let request_body = String::from_utf8(body.as_ref().into())
        .unwrap_or_else(|e| format!("<binary {} bytes>", e.as_bytes().len()));

    let response = serde_json::json!({
        "connection_info": {
            "realip_remote_addr": connection_info.realip_remote_addr(),
            "peer_addr": connection_info.peer_addr(),
            "host": connection_info.host(),
            "scheme": connection_info.scheme(),
        },
        "version": format!("{:?}", req.head().version),
        "method": req.method().as_str(),
        "uri": req.uri().to_string(),
        "app_config": {
            "host": req.app_config().host(),
            "secure": req.app_config().secure(),
        },
        "uri_parts": {
            "authority": req.uri().authority().map(|a| a.as_ref()),
            "host": req.uri().host(),
            "path": req.uri().path(),
            "port": req.uri().port().map(|p| p.as_u16()),
            "query": req.uri().query(),
            "scheme": req.uri().scheme_str(),
        },
        "peer_addr": req.head().peer_addr,
        "path": req.path(),
        "query_string": req.query_string(),
        "ip": ip_addr,
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
            if requested_html(&Accept::parse(&req).ok()) {
                let template = EchoTemplate {
                    path: req.path(),
                    body: &request_body,
                    value: &body,
                };
                template.respond_to(&req)
            } else {
                HttpResponse::Ok()
                    .content_type(ContentType::json())
                    .body(format!("{body}\n"))
            }
        }
        Err(err) => HttpResponse::from_error(actix_web::error::JsonPayloadError::Serialize(err)),
    }
}

async fn not_found() -> HttpResponse {
    HttpResponse::NotFound()
        .content_type(ContentType::html())
        .body("<h1>404 - Not Found</h1>")
}

// https://github.com/FlorianUekermann/rustls-acme/issues/54
fn make_auto_rustls_config(domain: &str) -> ServerConfig {
    let mut state = AcmeConfig::new([domain])
        .contact_push("mailto:george@witteman.me")
        .cache(DirCache::new("./rustls_acme_cache"))
        .directory("https://acme-v02.api.letsencrypt.org/directory")
        .state();
    let rustls_config = state.challenge_rustls_config();

    tokio::spawn(async move {
        loop {
            match state.next().await.unwrap() {
                Ok(ok) => log::info!("ACME configuration event: {ok:?}"),
                Err(err) => log::error!("ACME configuration error: {err:?}"),
            }
        }
    });

    ServerConfig::clone(&rustls_config)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    log::info!("Starting server");

    let config = get_config();

    let http_addrs = [
        SocketAddr::from((Ipv4Addr::UNSPECIFIED, config.http_port)),
        SocketAddr::from((Ipv6Addr::UNSPECIFIED, config.http_port)),
    ];
    let https_addrs = [
        SocketAddr::from((Ipv4Addr::UNSPECIFIED, config.https_port)),
        SocketAddr::from((Ipv6Addr::UNSPECIFIED, config.https_port)),
    ];

    let mut srv = HttpServer::new(|| {
        App::new()
            .wrap_fn(|sreq, srv| {
                log::debug!("Checking for https redirection");
                let config = get_config();
                if !config.tls_enabled {
                    log::debug!("Skipping https redirection due to tls_enabled = false");
                    return Either::Left(srv.call(sreq));
                }

                // Based on https://github.com/petertrotman/actix-web-middleware-redirect-https
                if sreq.connection_info().scheme() == &Scheme::HTTPS {
                    return Either::Left(srv.call(sreq));
                }

                let host = sreq.connection_info().host().to_owned();
                let uri = sreq.uri().to_owned();
                let url = format!("https://{}{}", host, uri);
                Either::Right(future::ready(Ok(sreq.into_response(
                    HttpResponse::MovedPermanently()
                        .append_header((LOCATION, url))
                        .finish(),
                ))))
            })
            .wrap(
                actix_web::middleware::DefaultHeaders::new()
                    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
                    .add((CONTENT_SECURITY_POLICY, "default-src 'self'"))
                    .add((PERMISSIONS_POLICY, "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"))
                    .add((REFERRER_POLICY, "same-origin"))
                    .add((STRICT_TRANSPORT_SECURITY, "max-age=31536000; includeSubDomains"))
                    .add((X_CONTENT_TYPE_OPTIONS, "nosniff"))
                    .add((X_FRAME_OPTIONS, "DENY"))
                    .add((X_XSS_PROTECTION, "1; mode=block")),
            )
            .wrap(actix_web::middleware::Compress::default())
            .wrap(Logger::default())
            .service(uuid_route)
            .service(sha)
            .service(index)
            .service(echo)
            .service(icloud_private_relay)
            .service(actix_files::Files::new("/", "./static").use_hidden_files())
            .default_service(web::route().to(not_found))
    })
    .server_hostname(&config.website_domain)
    // Short timeout for now to have faster deploys
    .shutdown_timeout(10)
    .bind(&http_addrs[..])?;

    if config.tls_enabled {
        srv = srv.bind_rustls_0_23(
            &https_addrs[..],
            make_auto_rustls_config(&config.website_domain),
        )?;
    }

    srv.run().await?;
    log::info!("Server finished");
    Ok(())
}
