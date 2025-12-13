//! Microwave time calculator handler.

use askama::Template;
use askama_web::WebTemplate;
use axum::extract::{OriginalUri, Query};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct MicrowaveQuery {
    bw: Option<u32>,
    bm: Option<u32>,
    bs: Option<u32>,
    bp: Option<u32>,
    w: Option<u32>,
}

struct MicrowaveResult {
    minutes: u32,
    seconds: u32,
    power: u32,
}

fn calculate_microwave_time(
    box_wattage: u32,
    box_seconds: u32,
    box_power: u32,
    your_wattage: u32,
) -> MicrowaveResult {
    // We want the desired power to be as close to the power of the microwave
    // used to make the calculations on the box. Obviously, this can't be greater
    // than 10 (i.e. 100%).
    let result_power = std::cmp::min(
        (box_power as f64 * (box_wattage as f64 / your_wattage as f64)).round() as u32,
        10,
    );

    // Now that we have the power setting for the user's microwave that gets them
    // closest to the box wattage, we need to calculate what the effective wattages
    // of both are after taking into account the power settings for each. This
    // assumes 10 = 100%, 5 = 50%, etc.
    let effective_box_wattage = box_wattage as f64 * (box_power as f64 / 10.0);
    let effective_your_wattage = your_wattage as f64 * (result_power as f64 / 10.0);

    let result_seconds = box_seconds as f64 * (effective_box_wattage / effective_your_wattage);

    MicrowaveResult {
        minutes: (result_seconds / 60.0).floor() as u32,
        seconds: (result_seconds % 60.0).round() as u32,
        power: result_power,
    }
}

#[derive(Template, WebTemplate)]
#[template(path = "microwave.html.jinja")]
struct MicrowaveTemplate {
    path: String,
    box_wattage: u32,
    box_minutes: u32,
    box_seconds: u32,
    box_power: u32,
    your_wattage: u32,
    result: Option<MicrowaveResult>,
}

pub async fn microwave(
    OriginalUri(uri): OriginalUri,
    Query(query): Query<MicrowaveQuery>,
) -> Response {
    let box_wattage = query.bw.unwrap_or(1100);
    let box_minutes = query.bm.unwrap_or(1);
    let box_seconds = query.bs.unwrap_or(0);
    let box_power = query.bp.unwrap_or(10).clamp(1, 10);
    let your_wattage = query.w.unwrap_or(900);

    let total_box_seconds = box_minutes * 60 + box_seconds;

    // Only calculate if we have valid input (at least some time)
    let result = if total_box_seconds > 0 && box_wattage > 0 && your_wattage > 0 {
        Some(calculate_microwave_time(
            box_wattage,
            total_box_seconds,
            box_power,
            your_wattage,
        ))
    } else {
        None
    };

    MicrowaveTemplate {
        path: uri.path().to_string(),
        box_wattage,
        box_minutes,
        box_seconds,
        box_power,
        your_wattage,
        result,
    }
    .into_response()
}
