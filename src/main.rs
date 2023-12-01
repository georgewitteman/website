use std::sync::OnceLock;

use actix_web::{
    get,
    http::header::HeaderName,
    middleware::Logger,
    web::{self},
    App, HttpRequest, HttpResponse, HttpServer, Responder,
};
use serde_json::Value;

fn templates() -> &'static tera::Tera {
    static TERA: OnceLock<tera::Tera> = OnceLock::new();
    TERA.get_or_init(|| {
        let mut tera = match tera::Tera::new("templates/**/*") {
            Ok(t) => t,
            Err(e) => {
                println!("Parsing error(s): {}", e);
                ::std::process::exit(1);
            }
        };
        tera.autoescape_on(vec![".html", ".sql"]);
        tera
    })
}

fn get_user_agent<'a>(header: &'a str) -> woothee::parser::WootheeResult<'a> {
    let parser = woothee::parser::Parser::new();
    parser.parse(&header).unwrap_or_default()
}

#[get("/uuid")]
async fn uuid_route(req: HttpRequest) -> impl Responder {
    let user_agent = get_user_agent(
        req.headers()
            .get("user-agent")
            .and_then(|v| v.to_str().ok())
            .unwrap_or(""),
    );
    let result = uuid::Uuid::new_v4();
    let mut context = tera::Context::new();
    context.insert("value", &result.to_string());
    context.insert("path", req.path());
    match templates().render("uuid.html", &context) {
        Ok(body) => {
            if user_agent.browser_type != "browser" {
                return HttpResponse::Ok()
                    .insert_header((
                        actix_web::http::header::CONTENT_TYPE,
                        actix_web::http::header::ContentType::plaintext(),
                    ))
                    .body(format!("{}\n", result));
            }
            HttpResponse::Ok()
                .insert_header((
                    actix_web::http::header::CONTENT_TYPE,
                    actix_web::http::header::ContentType::html(),
                ))
                .body(body)
        }
        Err(err) => HttpResponse::from_error(actix_web::error::ErrorInternalServerError(err)),
    }
}

#[get("/")]
async fn hello(req: HttpRequest) -> impl Responder {
    let mut context = tera::Context::new();
    context.insert("path", req.path());
    match templates().render("index.html", &context) {
        Ok(body) => HttpResponse::Ok()
            .insert_header((
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ContentType::html(),
            ))
            .body(body),
        Err(err) => HttpResponse::from_error(actix_web::error::ErrorInternalServerError(err)),
    }
}

#[get("/test")]
async fn test_page(req: HttpRequest) -> impl Responder {
    let mut context = tera::Context::new();
    context.insert("path", req.path());
    context.insert("hello", "Hello, ");
    context.insert("world", "world!");
    match templates().render("test.html", &context) {
        Ok(body) => HttpResponse::Ok()
            .insert_header((
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ContentType::html(),
            ))
            .body(body),
        Err(err) => HttpResponse::from_error(actix_web::error::ErrorInternalServerError(err)),
    }
}

#[get("/amazon-short-link")]
async fn amazon_short_link(req: HttpRequest) -> impl Responder {
    let mut context = tera::Context::new();
    context.insert("path", req.path());
    match templates().render("amazon-short-link.html", &context) {
        Ok(body) => HttpResponse::Ok()
            .insert_header((
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ContentType::html(),
            ))
            .body(body),
        Err(err) => HttpResponse::from_error(actix_web::error::ErrorInternalServerError(err)),
    }
}

fn first_header_value<'a>(
    req: &'a actix_web::dev::RequestHead,
    name: &'_ actix_web::http::header::HeaderName,
) -> Option<&'a str> {
    let hdr = req.headers.get(name)?.to_str().ok()?;
    let val = hdr.split(',').next()?.trim();
    Some(val)
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
    let ip_addr = first_header_value(req.head(), &HeaderName::from_static("x-forwarded-for"))
        .map(str::to_owned)
        .or_else(|| req.peer_addr().map(|addr| addr.ip().to_string()));

    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html
    let host = first_header_value(req.head(), &HeaderName::from_static("x-forwarded-host"))
        .or_else(|| {
            req.headers()
                .get(&HeaderName::from_static("host"))?
                .to_str()
                .ok()
        })
        .or_else(|| {
            req.uri()
                .authority()
                .map(actix_web::http::uri::Authority::as_str)
        })
        .unwrap_or_else(|| req.app_config().host())
        .to_owned();

    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html
    let scheme = first_header_value(req.head(), &HeaderName::from_static("x-forwarded-proto"))
        .or_else(|| req.uri().scheme().map(actix_web::http::uri::Scheme::as_str))
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
            let mut context = tera::Context::new();
            context.insert("value", &body);
            context.insert("path", req.path());
            context.insert("body", &request_body);
            match templates().render("echo.html", &context) {
                Ok(body) => {
                    if parsed_user_agent.browser_type != "browser" {
                        return HttpResponse::Ok()
                            .insert_header((
                                actix_web::http::header::CONTENT_TYPE,
                                actix_web::http::header::ContentType::json(),
                            ))
                            .body(body);
                    }
                    HttpResponse::Ok()
                        .insert_header((
                            actix_web::http::header::CONTENT_TYPE,
                            actix_web::http::header::ContentType::html(),
                        ))
                        .body(body)
                }
                Err(err) => {
                    HttpResponse::from_error(actix_web::error::ErrorInternalServerError(err))
                }
            }
        }
        Err(err) => HttpResponse::from_error(actix_web::error::JsonPayloadError::Serialize(err)),
    }
}

async fn manual_hello() -> impl Responder {
    HttpResponse::Ok().body("Hey there!")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    log::info!("Starting server");
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("debug"));
    HttpServer::new(|| {
        App::new()
            .service(amazon_short_link)
            .service(test_page)
            .service(uuid_route)
            .service(hello)
            .service(echo)
            .route("/hey", web::get().to(manual_hello))
            .service(actix_files::Files::new("/", "./static"))
            .wrap(Logger::default())
    })
    .bind("0.0.0.0:8000")?
    .run()
    .await?;
    log::info!("Server finished");
    Ok(())
}
