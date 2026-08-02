//! Weather page: what to wear, and whether to carry a layer.
//!
//! Everything is rendered server-side in one pass so the page is readable the
//! moment it arrives. The only client-side work is remembering which location
//! was last chosen.

use askama::Template;
use askama_web::WebTemplate;
use axum::extract::{OriginalUri, Query};
use axum::http::header::{self, HeaderValue};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;

use crate::comfort::{self, Conditions, Felt};
use crate::helpers::urlencode;
use crate::locations;
use crate::scale::{self, Score};
use crate::services::open_meteo::{self, Day, Forecast, Hour, Place};
use crate::units::{Speed, Temperature};

/// How long a browser may reuse the page. Comfortably inside the upstream
/// cache window, and short enough that a reload before leaving is current.
const CACHE_CONTROL: &str = "public, max-age=300";

// ==================== Query ====================

/// Strings rather than typed numbers so a hand-mangled URL falls back to home
/// instead of returning a bare 400 from the extractor.
#[derive(Deserialize)]
pub struct WeatherQuery {
    /// Slug of a pinned location.
    loc: Option<String>,
    /// Free-text place search.
    q: Option<String>,
    lat: Option<String>,
    lon: Option<String>,
    name: Option<String>,
}

/// A resolved place, however it was asked for.
struct Target {
    name: String,
    detail: String,
    latitude: f64,
    longitude: f64,
    /// Query string that reproduces this target, e.g. `loc=fidi`.
    param: String,
    /// Slug if this is a pinned location, for highlighting the shortcut row.
    pin: Option<String>,
}

impl Target {
    fn from_pin(location: &'static locations::Location) -> Self {
        Target {
            name: location.name.to_owned(),
            detail: location.detail.to_owned(),
            latitude: location.latitude,
            longitude: location.longitude,
            param: format!("loc={}", location.slug),
            pin: Some(location.slug.to_owned()),
        }
    }

    fn from_place(place: &Place) -> Self {
        Target {
            name: place.name.clone(),
            detail: place.detail.clone(),
            latitude: place.latitude,
            longitude: place.longitude,
            param: place_param(place),
            pin: None,
        }
    }
}

/// The canonical link for a searched place: coordinates plus a display name, so
/// the URL is stable and does not re-run the search on every load.
fn place_param(place: &Place) -> String {
    coordinate_param(place.latitude, place.longitude, &place.name)
}

fn coordinate_param(latitude: f64, longitude: f64, name: &str) -> String {
    format!(
        "lat={latitude:.4}&lon={longitude:.4}&name={}",
        urlencode(name)
    )
}

/// Resolves the query into a place, plus any other candidates worth offering.
async fn resolve(query: &WeatherQuery) -> (Target, Vec<Alternate>, Option<String>) {
    if let (Some(latitude), Some(longitude)) = (
        query
            .lat
            .as_ref()
            .and_then(|value| value.parse::<f64>().ok()),
        query
            .lon
            .as_ref()
            .and_then(|value| value.parse::<f64>().ok()),
    ) {
        if (-90.0..=90.0).contains(&latitude) && (-180.0..=180.0).contains(&longitude) {
            let name = query
                .name
                .clone()
                .filter(|name| !name.trim().is_empty())
                .unwrap_or_else(|| format!("{latitude:.3}, {longitude:.3}"));
            return (
                Target {
                    param: coordinate_param(latitude, longitude, &name),
                    detail: format!("{latitude:.4}, {longitude:.4}"),
                    name,
                    latitude,
                    longitude,
                    pin: None,
                },
                Vec::new(),
                None,
            );
        }
    }

    if let Some(search) = query
        .q
        .as_ref()
        .map(|query| query.trim())
        .filter(|query| !query.is_empty())
    {
        return match open_meteo::geocode(search).await {
            Ok(places) => {
                let target = Target::from_place(&places[0]);
                // Everything after the best match becomes a "did you mean".
                let alternates = places
                    .iter()
                    .skip(1)
                    .map(|place| Alternate {
                        label: if place.detail.is_empty() {
                            place.name.clone()
                        } else {
                            format!("{}, {}", place.name, place.detail)
                        },
                        href: format!("/weather?{}", place_param(place)),
                    })
                    .collect();
                (target, alternates, None)
            }
            Err(err) => (
                Target::from_pin(locations::home()),
                Vec::new(),
                Some(err.to_string()),
            ),
        };
    }

    let pin = query
        .loc
        .as_deref()
        .and_then(locations::find)
        .unwrap_or_else(locations::home);
    (Target::from_pin(pin), Vec::new(), None)
}

// ==================== Local time helpers ====================
//
// Open-Meteo is asked for `timezone=auto`, so every timestamp arrives as a
// naive local ISO 8601 string in the location's own clock. That makes ordering,
// grouping and "which hour is it there" pure string work, and keeps a date
// library out of the dependency list.

/// `2026-08-02T14:00` -> `2026-08-02`.
fn date_of(iso: &str) -> &str {
    iso.get(..10).unwrap_or(iso)
}

/// `2026-08-02T14:00` -> `14`.
fn hour_of(iso: &str) -> Option<u32> {
    iso.get(11..13)?.parse().ok()
}

/// `2026-08-02T14:30` -> `14.5`, for placing markers between hour columns.
fn fractional_hour(iso: &str) -> Option<f64> {
    let hour = f64::from(hour_of(iso)?);
    let minute = f64::from(iso.get(14..16)?.parse::<u32>().ok()?);
    Some(hour + minute / 60.0)
}

/// `14` -> `2 PM`.
fn hour_label(hour: u32) -> String {
    let (display, suffix) = twelve_hour(hour);
    format!("{display} {suffix}")
}

/// `14` -> `2p`, for the chart's cramped axis.
fn short_hour_label(hour: u32) -> String {
    let (display, suffix) = twelve_hour(hour);
    format!("{display}{}", if suffix == "AM" { 'a' } else { 'p' })
}

/// `2026-08-02T20:17` -> `8:17 PM`.
fn clock_label(iso: &str) -> String {
    let Some(hour) = hour_of(iso) else {
        return iso.to_owned();
    };
    let minute = iso.get(14..16).unwrap_or("00");
    let (display, suffix) = twelve_hour(hour);
    format!("{display}:{minute} {suffix}")
}

fn twelve_hour(hour: u32) -> (u32, &'static str) {
    match hour {
        0 => (12, "AM"),
        1..=11 => (hour, "AM"),
        12 => (12, "PM"),
        _ => (hour - 12, "PM"),
    }
}

// ==================== Derived hourly data ====================

/// One hour, with the comfort model already applied.
#[derive(Clone, Copy)]
struct Modelled<'a> {
    raw: &'a Hour,
    hour: u32,
    felt: Felt,
}

impl<'a> Modelled<'a> {
    fn new(raw: &'a Hour) -> Option<Self> {
        Some(Modelled {
            hour: hour_of(&raw.time)?,
            felt: comfort::felt(&Conditions {
                air: raw.air,
                relative_humidity: raw.relative_humidity,
                wind: raw.wind,
                direct_normal: raw.direct_normal,
                direct_horizontal: raw.direct_horizontal,
                diffuse: raw.diffuse,
                cloud_cover: raw.cloud_cover,
                sunlit_fraction: raw.sunshine_seconds / 3600.0,
            }),
            raw,
        })
    }

    /// Whether there is enough beam for "in sun" to mean anything.
    fn sunlit(&self) -> bool {
        self.raw.direct_normal > 5.0
    }

    /// A score with everything behind it, for the numbers that stand alone.
    ///
    /// The hourly table needs no probe: its own row already spells out the air
    /// temperature, wind, cloud and rain that produced the figure.
    fn probe(&self, exposure: Exposure) -> Probe {
        let felt = match exposure {
            Exposure::Sun => self.felt.sun,
            Exposure::Shade => self.felt.shade,
            Exposure::Typical => self.felt.typical,
        };
        let score = scale::score(felt);
        Probe {
            level: score.level(),
            score: score.to_string(),
            label: score.label(),
            degrees: felt.round_fahrenheit(),
            hour_label: hour_label(self.hour),
            air_f: self.raw.air.round_fahrenheit(),
            wind_mph: self.raw.wind.round_miles_per_hour(),
            humidity: self.raw.relative_humidity.round() as i32,
            cloud: self.raw.cloud_cover.round() as i32,
        }
    }
}

/// Which reading of an hour a number refers to.
#[derive(Clone, Copy)]
enum Exposure {
    Sun,
    Shade,
    /// The sun/shade pair weighted by how much sky is clear.
    Typical,
}

/// Every modelled hour belonging to one local date.
fn hours_on<'a>(forecast: &'a Forecast, date: &str) -> Vec<Modelled<'a>> {
    forecast
        .hours
        .iter()
        .filter(|hour| date_of(&hour.time) == date)
        .filter_map(Modelled::new)
        .collect()
}

/// The stretch of the day worth showing: an hour before sunrise through a
/// couple of hours past sunset, which is exactly the window in which the
/// sun/shade distinction and the evening drop-off matter.
fn daylight_window(day: &Day) -> (u32, u32) {
    let start = hour_of(&day.sunrise)
        .unwrap_or(6)
        .saturating_sub(1)
        .clamp(4, 11);
    let end = (hour_of(&day.sunset).unwrap_or(20) + 2).clamp(15, 23);
    (start, end)
}

/// Summary statistics over the visible window.
struct Extremes {
    min_shade: Temperature,
    peak_sun_score: Score,
    min_shade_score: Score,
    /// The middle of the day's exposure-weighted hours.
    typical_score: Score,
    typical: Temperature,
    air_high: Temperature,
    max_wind: Speed,
    mean_cloud: f64,
    max_rain_chance: f64,
    total_rain_inches: f64,
}

/// The middle value, which shrugs off an hour or two of freak weather in a way
/// a mean does not.
fn median(scores: impl Iterator<Item = Score>) -> Option<Score> {
    let mut sorted: Vec<Score> = scores.collect();
    sorted.sort_by(|a, b| a.value().partial_cmp(&b.value()).expect("no NaN"));
    sorted.get(sorted.len() / 2).copied()
}

fn median_temperature(values: impl Iterator<Item = Temperature>) -> Option<Temperature> {
    let mut sorted: Vec<Temperature> = values.collect();
    sorted.sort_by(|a, b| a.partial_cmp(b).expect("no NaN"));
    sorted.get(sorted.len() / 2).copied()
}

/// The share of hours that round to the same whole point as `typical`, which is
/// what lets the page say "8.2, and that is most of the day".
fn share_near(hours: &[Modelled], typical: Score) -> i32 {
    if hours.is_empty() {
        return 0;
    }
    let near = hours
        .iter()
        .filter(|hour| (scale::score(hour.felt.typical).value() - typical.value()).abs() <= 0.5)
        .count();
    (near as f64 / hours.len() as f64 * 100.0).round() as i32
}

fn extremes(hours: &[Modelled]) -> Option<Extremes> {
    Some(Extremes {
        // `reduce` yields None on an empty window, which is the only failure
        // mode here and short-circuits the whole struct.
        min_shade: hours
            .iter()
            .map(|h| h.felt.shade)
            .reduce(Temperature::min)?,
        peak_sun_score: hours
            .iter()
            .map(|h| scale::score(h.felt.sun))
            .reduce(Score::max)?,
        min_shade_score: hours
            .iter()
            .map(|h| scale::score(h.felt.shade))
            .reduce(Score::min)?,
        typical_score: median(hours.iter().map(|h| scale::score(h.felt.typical)))?,
        typical: median_temperature(hours.iter().map(|h| h.felt.typical))?,
        air_high: hours.iter().map(|h| h.raw.air).reduce(Temperature::max)?,
        max_wind: hours.iter().map(|h| h.raw.wind).reduce(Speed::max)?,
        mean_cloud: hours.iter().map(|h| h.raw.cloud_cover).sum::<f64>() / hours.len() as f64,
        max_rain_chance: hours
            .iter()
            .map(|h| h.raw.precipitation_probability)
            .fold(0.0, f64::max),
        total_rain_inches: hours.iter().map(|h| h.raw.precipitation_mm).sum::<f64>() / 25.4,
    })
}

// ==================== Chart ====================

const CHART_WIDTH: f64 = 320.0;
const CHART_HEIGHT: f64 = 172.0;
const PLOT_LEFT: f64 = 26.0;
const PLOT_RIGHT: f64 = 314.0;
const PLOT_TOP: f64 = 18.0;
const PLOT_BOTTOM: f64 = 136.0;
/// Baseline for the hour labels under the plot.
const AXIS_LABEL_Y: f64 = 150.0;
/// Baseline for the sunset caption above the plot.
const MARKER_LABEL_Y: f64 = 11.0;
/// Never show a vertical range tighter than this many scale points, or
/// ordinary noise looks like a dramatic swing.
const MIN_SCALE_SPAN: f64 = 2.5;

struct GridLine {
    y: f64,
    label: i32,
}

/// A horizontal stripe of the plot, tinted with the colour of one whole point
/// on the scale. Reading the chart's height against these says what a given
/// height actually feels like without going back to the axis.
struct FeelBand {
    y: f64,
    height: f64,
    level: u8,
}

struct AxisTick {
    x: f64,
    label: String,
}

struct Marker {
    x: f64,
    /// Caption position, pulled in from the edges so it cannot overflow.
    label_x: f64,
    label: String,
    /// False when the caption would collide with another marker's.
    show_label: bool,
}

/// A whole-day picture of the felt range: the filled band is today's shade-to-
/// sun spread, the dashed outline is yesterday's.
struct Chart {
    width: f64,
    height: f64,
    plot_left: f64,
    plot_right: f64,
    plot_width: f64,
    plot_top: f64,
    plot_bottom: f64,
    axis_label_y: f64,
    marker_label_y: f64,
    grid_label_x: f64,
    sun_line: String,
    shade_line: String,
    yesterday_band: Option<String>,
    grid: Vec<GridLine>,
    bands: Vec<FeelBand>,
    ticks: Vec<AxisTick>,
    sunset: Option<Marker>,
    now: Option<Marker>,
}

/// One decimal is plenty for SVG geometry and keeps the markup small.
fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

struct ChartInput<'a> {
    today: &'a [Modelled<'a>],
    yesterday: &'a [Modelled<'a>],
    window: (u32, u32),
    sunset: &'a str,
    now: &'a str,
}

impl Chart {
    fn build(input: &ChartInput) -> Option<Chart> {
        let (start, end) = input.window;
        if end <= start || input.today.len() < 2 {
            return None;
        }

        // Both days share one scale, otherwise the comparison lies. The axis is
        // the 0-10 comfort scale, the same units as the headline.
        let mut lowest = f64::MAX;
        let mut highest = f64::MIN;
        for hour in input.today.iter().chain(input.yesterday.iter()) {
            lowest = lowest.min(scale::score(hour.felt.shade).value());
            highest = highest.max(scale::score(hour.felt.sun).value());
        }
        let mut floor = (lowest - 0.3).floor();
        let mut ceiling = (highest + 0.3).ceil();
        if ceiling - floor < MIN_SCALE_SPAN {
            let padding = (MIN_SCALE_SPAN - (ceiling - floor)) / 2.0;
            floor -= padding;
            ceiling += padding;
        }
        floor = floor.max(0.0);
        ceiling = ceiling.min(10.0);

        let span = f64::from(end - start);
        let x_at = |hour: f64| {
            PLOT_LEFT
                + ((hour - f64::from(start)) / span).clamp(0.0, 1.0) * (PLOT_RIGHT - PLOT_LEFT)
        };
        let y_at = |degrees: f64| {
            PLOT_BOTTOM - ((degrees - floor) / (ceiling - floor)) * (PLOT_BOTTOM - PLOT_TOP)
        };

        let trace = |hours: &[Modelled], pick: fn(&Modelled) -> Temperature| {
            hours
                .iter()
                .map(|hour| {
                    format!(
                        "{},{}",
                        round1(x_at(f64::from(hour.hour))),
                        round1(y_at(scale::score(pick(hour)).value()))
                    )
                })
                .collect::<Vec<String>>()
                .join(" ")
        };
        // Sun edge left to right, shade edge back again: one closed outline.
        // Only yesterday needs it -- today is drawn as two live edges.
        let band = |hours: &[Modelled]| {
            let mut shade: Vec<&str> = Vec::new();
            let shade_trace = trace(hours, |hour| hour.felt.shade);
            shade.extend(shade_trace.split(' ').rev());
            format!("{} {}", trace(hours, |hour| hour.felt.sun), shade.join(" "))
        };

        let whole_points = floor.ceil() as i32..=ceiling.floor() as i32;
        let grid = whole_points
            .clone()
            .map(|point| GridLine {
                y: round1(y_at(f64::from(point))),
                label: point,
            })
            .collect();

        // One stripe per whole point, clipped to the plot.
        let bands = whole_points
            .map(|point| {
                let top = y_at(f64::from(point) + 0.5).max(PLOT_TOP);
                let bottom = y_at(f64::from(point) - 0.5).min(PLOT_BOTTOM);
                FeelBand {
                    y: round1(top),
                    height: round1((bottom - top).max(0.0)),
                    level: point.clamp(0, 10) as u8,
                }
            })
            .collect();

        let ticks = (start..=end)
            .filter(|hour| hour % 3 == 0)
            .map(|hour| AxisTick {
                x: round1(x_at(f64::from(hour))),
                label: short_hour_label(hour),
            })
            .collect();

        // Captions are half a caption-width in from either edge so long labels
        // like "sunset 8:17 PM" stay inside the viewBox.
        const CAPTION_INSET: f64 = 46.0;
        let marker_at = |iso: &str, label: String| {
            fractional_hour(iso)
                .filter(|hour| *hour >= f64::from(start) && *hour <= f64::from(end))
                .map(|hour| {
                    let x = round1(x_at(hour));
                    Marker {
                        x,
                        label_x: round1(x.clamp(CAPTION_INSET, CHART_WIDTH - CAPTION_INSET)),
                        label,
                        show_label: true,
                    }
                })
        };

        let sunset = marker_at(
            input.sunset,
            format!("sunset {}", clock_label(input.sunset)),
        );
        let now = marker_at(input.now, "now".to_owned()).map(|mut marker| {
            // Late in the day "now" and "sunset" sit on top of each other;
            // sunset is the one that changes the decision, so it wins.
            marker.show_label = sunset
                .as_ref()
                .is_none_or(|other| (other.label_x - marker.label_x).abs() > 70.0);
            marker
        });

        Some(Chart {
            width: CHART_WIDTH,
            height: CHART_HEIGHT,
            plot_left: PLOT_LEFT,
            plot_right: PLOT_RIGHT,
            plot_width: PLOT_RIGHT - PLOT_LEFT,
            plot_top: PLOT_TOP,
            plot_bottom: PLOT_BOTTOM,
            axis_label_y: AXIS_LABEL_Y,
            marker_label_y: MARKER_LABEL_Y,
            grid_label_x: PLOT_LEFT - 4.0,
            sun_line: trace(input.today, |hour| hour.felt.sun),
            shade_line: trace(input.today, |hour| hour.felt.shade),
            // A handful of stray hours would draw a misleading stub, so only
            // show yesterday when it covers a comparable stretch of the day.
            yesterday_band: (input.yesterday.len() >= input.today.len() / 2)
                .then(|| band(input.yesterday)),
            grid,
            bands,
            ticks,
            sunset,
            now,
        })
    }
}

// ==================== View model ====================

struct Pin {
    name: String,
    detail: String,
    href: String,
    active: bool,
}

struct Alternate {
    label: String,
    href: String,
}

/// One row of the printed scale key.
struct KeyStep {
    level: u8,
    word: &'static str,
    advice: &'static str,
    /// The felt temperature that lands on this point, not the air temperature.
    degrees: i32,
}

/// A score plus everything that produced it, revealed on hover or tap.
///
/// Only used where the raw numbers are not already on screen. The hourly table
/// needs no probe: its own row spells out air, wind, cloud and rain already.
struct Probe {
    /// 0-10, the colour band this reading sits in.
    level: u8,
    score: String,
    label: String,
    degrees: i32,
    hour_label: String,
    air_f: i32,
    wind_mph: i32,
    humidity: i32,
    cloud: i32,
}

struct HourRow {
    label: String,
    sun_level: u8,
    shade_level: u8,
    sun_score: String,
    shade_score: String,
    sun_f: i32,
    shade_f: i32,
    /// Blank when there is no sun to be in, so the table does not print two
    /// identical numbers and imply a choice that does not exist.
    has_sun: bool,
    air_f: i32,
    wind_mph: i32,
    humidity: i32,
    cloud: i32,
    rain_chance: i32,
    is_now: bool,
    past: bool,
    /// The sun goes down between this row and the next.
    sunset_follows: bool,
}

struct NowRow {
    label: String,
    sun: Probe,
    shade: Probe,
    has_sun: bool,
    air_f: i32,
    wind_mph: i32,
    versus_yesterday: Option<String>,
}

struct Comparison {
    label: String,
    today: String,
    yesterday: String,
    delta: String,
    /// Direction, for colouring: `up`, `down` or `flat`.
    direction: &'static str,
}

struct Report {
    // Headline: the range and swing, not the air temperature.
    /// `the rest of today` or `today`, depending on how much is left of it.
    headline_scope: &'static str,
    /// What the rest of the day mostly feels like, and how much of it that
    /// covers. This is the headline; the bounds are context for it.
    typical: Probe,
    typical_share: i32,
    /// The coldest it gets out of the sun, and the warmest it gets at all.
    low: Probe,
    high: Probe,
    high_hour: String,
    swing_f: i32,
    verdict: Vec<String>,
    now: Option<NowRow>,

    chart: Option<Chart>,

    hours: Vec<HourRow>,
    sunrise_label: String,
    sunset_label: String,

    // Deliberately secondary.
    air_high_f: i32,
    air_low_f: i32,
    rain_chance: i32,
    rain_total_in: String,

    comparisons: Vec<Comparison>,
    has_yesterday: bool,

    grid_distance_mi: String,
    grid_elevation_ft: i32,
    timezone: String,
    updated_label: String,
}

#[derive(Template, WebTemplate)]
#[template(path = "weather.html.jinja")]
struct WeatherTemplate {
    path: String,
    place_name: String,
    place_detail: String,
    place_param: String,
    search_query: String,
    pins: Vec<Pin>,
    alternates: Vec<Alternate>,
    report: Option<Report>,
    error: Option<String>,
    key: Vec<KeyStep>,
}

// ==================== Report assembly ====================

fn signed(difference: f64, unit: &str) -> String {
    let rounded = difference.round() as i32;
    match rounded {
        0 => "same".to_owned(),
        _ if rounded > 0 => format!("+{rounded}{unit}"),
        _ => format!("{rounded}{unit}"),
    }
}

fn direction_of(difference: f64) -> &'static str {
    match difference.round() as i32 {
        0 => "flat",
        rounded if rounded > 0 => "up",
        _ => "down",
    }
}

fn row(label: &str, today: f64, yesterday: f64, unit: &str) -> Comparison {
    Comparison {
        label: label.to_owned(),
        today: format!("{}{unit}", today.round() as i32),
        yesterday: format!("{}{unit}", yesterday.round() as i32),
        delta: signed(today - yesterday, unit),
        direction: direction_of(today - yesterday),
    }
}

fn temperature_row(label: &str, today: Temperature, yesterday: Temperature) -> Comparison {
    row(label, today.fahrenheit(), yesterday.fahrenheit(), "\u{b0}")
}

/// A comparison on the 0-10 scale, which needs its own formatting: whole
/// degrees would hide a change of half a point.
fn score_row(label: &str, today: Score, yesterday: Score) -> Comparison {
    let difference = today.value() - yesterday.value();
    Comparison {
        label: label.to_owned(),
        today: today.to_string(),
        yesterday: yesterday.to_string(),
        delta: match format!("{difference:+.1}").as_str() {
            "+0.0" | "-0.0" => "same".to_owned(),
            signed => signed.to_owned(),
        },
        direction: match (difference * 10.0).round() as i32 {
            0 => "flat",
            tenths if tenths > 0 => "up",
            _ => "down",
        },
    }
}

/// The answer to the question the page exists for, in at most four sentences.
///
/// Written in the 0-10 scale with degrees in brackets: the score is the
/// decision, the temperature is the evidence for it.
fn verdict(today: &Extremes, peak: Score, peak_hour: &str, sunset_label: &str) -> Vec<String> {
    let typical = today.typical_score;
    let low = today.min_shade_score;

    let mut sentences = vec![format!(
        "Dress for {typical} \u{2014} {} at {}\u{b0}: {}.",
        typical.word(),
        today.typical.round_fahrenheit(),
        typical.advice()
    )];

    // Only worth a sentence when the peak lands somewhere else on the scale.
    if peak.value() - typical.value() >= 0.4 {
        sentences.push(format!(
            "Around {peak_hour}, out in the open, it reaches {peak} \u{2014} {}.",
            peak.word()
        ));
    }

    let shade_clause = format!(
        "Out of the sun, and once it goes at {sunset_label}, it eases to {low} ({}\u{b0})",
        today.min_shade.round_fahrenheit()
    );
    sentences.push(if peak.value() - low.value() >= 1.0 {
        format!("{shade_clause} \u{2014} enough of a spread to carry a layer for.")
    } else {
        format!("{shade_clause}.")
    });

    if today.max_wind.miles_per_hour() >= 18.0 {
        sentences.push(format!(
            "Wind peaks near {} mph, which is most of why the shade reads colder than the air.",
            today.max_wind.round_miles_per_hour()
        ));
    } else if today.max_rain_chance >= 40.0 {
        sentences.push(format!(
            "Rain reaches {}% at its likeliest \u{2014} bring the shell rather than the sweater.",
            today.max_rain_chance.round() as i32
        ));
    }

    sentences
}

fn build_report(forecast: &Forecast, target: &Target) -> Option<Report> {
    let today_date = date_of(&forecast.current_time);
    let today_index = forecast
        .days
        .iter()
        .position(|day| day.date == today_date)?;
    let today = &forecast.days[today_index];
    let yesterday = today_index
        .checked_sub(1)
        .map(|index| &forecast.days[index]);

    let (start, end) = daylight_window(today);
    let in_window = |hour: &Modelled| hour.hour >= start && hour.hour <= end;

    let all_today = hours_on(forecast, &today.date);
    let visible: Vec<Modelled> = all_today.iter().copied().filter(in_window).collect();
    // Fall back to whatever the day has, rather than rendering an empty page.
    let visible = if visible.is_empty() {
        all_today
    } else {
        visible
    };

    let all_yesterday = yesterday
        .map(|day| hours_on(forecast, &day.date))
        .unwrap_or_default();
    let yesterday_visible: Vec<Modelled> =
        all_yesterday.iter().copied().filter(in_window).collect();

    let now_hour = hour_of(&forecast.current_time);
    let sunset_hour = hour_of(&today.sunset).unwrap_or(20);
    let sunset_label = clock_label(&today.sunset);

    // The headline answers "what do I put on now", so it covers the hours still
    // ahead. Including hours already gone would let a cold dawn set the advice
    // for someone walking out at nine. Before dawn, or with almost nothing left
    // of the day, the whole window is the more useful answer.
    let remaining: Vec<Modelled> = now_hour
        .map(|now| {
            visible
                .iter()
                .copied()
                .filter(|hour| hour.hour >= now)
                .collect()
        })
        .unwrap_or_default();
    let looking_ahead = remaining.len() >= 3;
    let decision = if looking_ahead { &remaining } else { &visible };

    let today_extremes = extremes(decision)?;
    // The day-versus-day table compares whole days, so it keeps the full window.
    let full_day = extremes(&visible)?;
    let yesterday_extremes = extremes(&yesterday_visible);

    let hours: Vec<HourRow> = visible
        .iter()
        .map(|hour| HourRow {
            label: hour_label(hour.hour),
            sun_level: scale::score(hour.felt.sun).level(),
            shade_level: scale::score(hour.felt.shade).level(),
            sun_score: scale::score(hour.felt.sun).to_string(),
            shade_score: scale::score(hour.felt.shade).to_string(),
            sun_f: hour.felt.sun.round_fahrenheit(),
            shade_f: hour.felt.shade.round_fahrenheit(),
            has_sun: hour.sunlit(),
            air_f: hour.raw.air.round_fahrenheit(),
            wind_mph: hour.raw.wind.round_miles_per_hour(),
            humidity: hour.raw.relative_humidity.round() as i32,
            cloud: hour.raw.cloud_cover.round() as i32,
            rain_chance: hour.raw.precipitation_probability.round() as i32,
            is_now: now_hour == Some(hour.hour),
            past: now_hour.is_some_and(|now| hour.hour < now),
            sunset_follows: hour.hour == sunset_hour,
        })
        .collect();

    let now = now_hour
        .and_then(|hour| visible.iter().find(|modelled| modelled.hour == hour))
        .map(|current| NowRow {
            label: clock_label(&forecast.current_time),
            sun: current.probe(Exposure::Sun),
            shade: current.probe(Exposure::Shade),
            has_sun: current.sunlit(),
            air_f: current.raw.air.round_fahrenheit(),
            wind_mph: current.raw.wind.round_miles_per_hour(),
            versus_yesterday: yesterday_visible
                .iter()
                .find(|previous| previous.hour == current.hour)
                .map(|previous| {
                    let difference = current.felt.shade - previous.felt.shade;
                    match difference.round_fahrenheit() {
                        0 => "same as this time yesterday".to_owned(),
                        degrees => format!(
                            "{}\u{b0} {} than this time yesterday",
                            degrees.abs(),
                            if degrees > 0 { "warmer" } else { "colder" }
                        ),
                    }
                }),
        });

    let comparisons = yesterday_extremes
        .as_ref()
        .map(|previous| {
            vec![
                score_row(
                    "Typical feel",
                    full_day.typical_score,
                    previous.typical_score,
                ),
                score_row(
                    "Coldest, out of the sun",
                    full_day.min_shade_score,
                    previous.min_shade_score,
                ),
                score_row(
                    "Peak in direct sun",
                    full_day.peak_sun_score,
                    previous.peak_sun_score,
                ),
                temperature_row(
                    "Air temperature, high",
                    full_day.air_high,
                    previous.air_high,
                ),
                row(
                    "Strongest wind",
                    full_day.max_wind.miles_per_hour(),
                    previous.max_wind.miles_per_hour(),
                    " mph",
                ),
                row(
                    "Cloud cover, daytime mean",
                    full_day.mean_cloud,
                    previous.mean_cloud,
                    "%",
                ),
            ]
        })
        .unwrap_or_default();

    let chart = Chart::build(&ChartInput {
        today: &visible,
        yesterday: &yesterday_visible,
        window: (start, end),
        sunset: &today.sunset,
        now: &forecast.current_time,
    });

    // The headline numbers each belong to a specific hour, and the probe shows
    // which one and what the air was doing at the time.
    let coldest = decision
        .iter()
        .min_by(|a, b| a.felt.shade.partial_cmp(&b.felt.shade).expect("no NaN"))?;
    // The peak is the exposure-weighted hour, not the sunlit ceiling: under a
    // solid overcast that ceiling is a place nobody actually stands.
    let warmest = decision
        .iter()
        .max_by(|a, b| a.felt.typical.partial_cmp(&b.felt.typical).expect("no NaN"))?;
    // A real hour near the middle, so the headline number has data behind it.
    let representative = decision.iter().min_by(|a, b| {
        let distance = |hour: &Modelled| {
            (scale::score(hour.felt.typical).value() - today_extremes.typical_score.value()).abs()
        };
        distance(a).partial_cmp(&distance(b)).expect("no NaN")
    })?;
    let swing_f = warmest.felt.typical.round_fahrenheit() - coldest.felt.shade.round_fahrenheit();

    Some(Report {
        headline_scope: if looking_ahead {
            "the rest of today"
        } else {
            "today"
        },
        typical: representative.probe(Exposure::Typical),
        typical_share: share_near(decision, today_extremes.typical_score),
        low: coldest.probe(Exposure::Shade),
        high: warmest.probe(Exposure::Typical),
        high_hour: hour_label(warmest.hour),
        // Derived from the rounded pair rather than rounded separately, so the
        // swing always equals the two numbers printed beside it.
        swing_f,
        verdict: verdict(
            &today_extremes,
            scale::score(warmest.felt.typical),
            &hour_label(warmest.hour),
            &sunset_label,
        ),
        now,
        chart,
        hours,
        sunrise_label: clock_label(&today.sunrise),
        sunset_label,
        air_high_f: today.high.round_fahrenheit(),
        air_low_f: today.low.round_fahrenheit(),
        rain_chance: full_day.max_rain_chance.round() as i32,
        rain_total_in: format!("{:.2}", full_day.total_rain_inches),
        comparisons,
        has_yesterday: yesterday_extremes.is_some(),
        grid_distance_mi: format!(
            "{:.1}",
            open_meteo::distance_miles(
                target.latitude,
                target.longitude,
                forecast.grid_latitude,
                forecast.grid_longitude,
            )
        ),
        grid_elevation_ft: (forecast.grid_elevation * 3.280_84).round() as i32,
        timezone: forecast.timezone_abbreviation.clone(),
        updated_label: clock_label(&forecast.current_time),
    })
}

// ==================== Handler ====================

pub async fn weather(OriginalUri(uri): OriginalUri, Query(query): Query<WeatherQuery>) -> Response {
    let (target, alternates, mut error) = resolve(&query).await;

    let report = match open_meteo::forecast(target.latitude, target.longitude).await {
        Ok(forecast) => {
            let report = build_report(&forecast, &target);
            if report.is_none() {
                error = Some("Open-Meteo returned no usable hours for today.".to_owned());
            }
            report
        }
        Err(err) => {
            error = Some(err.to_string());
            None
        }
    };

    let pins = locations::PINNED
        .iter()
        .map(|location| Pin {
            name: location.name.to_owned(),
            detail: location.detail.to_owned(),
            href: format!("/weather?loc={}", location.slug),
            active: target.pin.as_deref() == Some(location.slug),
        })
        .collect();

    let page = WeatherTemplate {
        path: uri.path().to_string(),
        place_name: target.name,
        place_detail: target.detail,
        place_param: target.param,
        search_query: query.q.unwrap_or_default(),
        pins,
        alternates,
        report,
        error,
        key: scale::key()
            .into_iter()
            .map(|(level, word, advice, degrees)| KeyStep {
                level,
                word,
                advice,
                degrees,
            })
            .collect(),
    };

    (
        [(
            header::CACHE_CONTROL,
            HeaderValue::from_static(CACHE_CONTROL),
        )],
        page,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hour(time: &str, air_c: f64, direct_normal: f64) -> Hour {
        Hour {
            time: time.to_owned(),
            air: Temperature::from_celsius(air_c),
            relative_humidity: 70.0,
            wind: Speed::from_meters_per_second(5.0),
            precipitation_mm: 0.0,
            precipitation_probability: 0.0,
            cloud_cover: 10.0,
            sunshine_seconds: if direct_normal > 0.0 { 3600.0 } else { 0.0 },
            direct_normal,
            // A 58° solar elevation, near enough for a fixture.
            direct_horizontal: direct_normal * 0.85,
            diffuse: if direct_normal > 0.0 { 90.0 } else { 0.0 },
        }
    }

    /// An ordinary diurnal curve in °C: coldest just before dawn, warmest mid
    /// afternoon, easing off into the evening but never back to the dawn low.
    const DIURNAL: [f64; 24] = [
        14.0, 13.5, 13.0, 12.8, 12.5, 12.3, 12.5, 13.5, 15.0, 17.0, 19.0, 20.5, 21.5, 22.0, 22.5,
        22.8, 22.5, 22.0, 21.0, 19.5, 18.0, 16.5, 15.5, 14.7,
    ];

    /// Two days of hourly data: yesterday fogged in, today clear, with the same
    /// air temperatures on both. That is the case the page exists to tell apart.
    fn forecast() -> Forecast {
        let mut hours = Vec::new();
        for date in ["2026-08-01", "2026-08-02"] {
            for (clock, air_c) in DIURNAL.iter().enumerate() {
                let daylight = (9..=19).contains(&clock);
                let beam = if daylight && date == "2026-08-02" {
                    850.0
                } else {
                    0.0
                };
                hours.push(hour(&format!("{date}T{clock:02}:00"), *air_c, beam));
            }
        }
        Forecast {
            grid_latitude: 37.7561,
            grid_longitude: -122.4457,
            grid_elevation: 65.0,
            timezone_abbreviation: "GMT-7".to_owned(),
            current_time: "2026-08-02T13:15".to_owned(),
            hours,
            days: vec![
                Day {
                    date: "2026-08-01".to_owned(),
                    high: Temperature::from_celsius(22.0),
                    low: Temperature::from_celsius(12.6),
                    sunrise: "2026-08-01T06:13".to_owned(),
                    sunset: "2026-08-01T20:18".to_owned(),
                },
                Day {
                    date: "2026-08-02".to_owned(),
                    high: Temperature::from_celsius(23.0),
                    low: Temperature::from_celsius(12.4),
                    sunrise: "2026-08-02T06:14".to_owned(),
                    sunset: "2026-08-02T20:17".to_owned(),
                },
            ],
        }
    }

    fn target() -> Target {
        Target::from_pin(locations::home())
    }

    fn report() -> Report {
        build_report(&forecast(), &target()).expect("report")
    }

    // ---- time helpers ----

    #[test]
    fn splits_local_iso_timestamps() {
        assert_eq!(date_of("2026-08-02T14:00"), "2026-08-02");
        assert_eq!(hour_of("2026-08-02T14:00"), Some(14));
        assert_eq!(hour_of("2026-08-02T00:00"), Some(0));
        assert_eq!(hour_of("garbage"), None);
        assert_eq!(fractional_hour("2026-08-02T14:30"), Some(14.5));
        assert_eq!(fractional_hour("nope"), None);
    }

    #[test]
    fn formats_twelve_hour_clock_labels() {
        assert_eq!(hour_label(0), "12 AM");
        assert_eq!(hour_label(9), "9 AM");
        assert_eq!(hour_label(12), "12 PM");
        assert_eq!(hour_label(13), "1 PM");
        assert_eq!(hour_label(23), "11 PM");
        assert_eq!(short_hour_label(0), "12a");
        assert_eq!(short_hour_label(15), "3p");
        assert_eq!(clock_label("2026-08-02T20:17"), "8:17 PM");
        assert_eq!(clock_label("2026-08-02T00:05"), "12:05 AM");
        assert_eq!(clock_label("nonsense"), "nonsense");
    }

    #[test]
    fn window_covers_sunrise_through_after_sunset() {
        let day = &forecast().days[1];
        assert_eq!(daylight_window(day), (5, 22));
    }

    #[test]
    fn window_is_clamped_for_polar_style_days() {
        let midnight_sun = Day {
            date: "2026-06-21".to_owned(),
            high: Temperature::from_celsius(10.0),
            low: Temperature::from_celsius(4.0),
            sunrise: "2026-06-21T00:30".to_owned(),
            sunset: "2026-06-21T23:50".to_owned(),
        };
        assert_eq!(daylight_window(&midnight_sun), (4, 23));
    }

    // ---- report ----

    #[test]
    fn headline_is_the_felt_range_not_the_air_temperature() {
        let report = report();
        assert!(report.high.level > report.low.level);
        assert_eq!(report.swing_f, report.high.degrees - report.low.degrees);
        // The felt peak exceeds the air high; that difference is the entire
        // point of the page.
        assert!(report.high.degrees > report.air_high_f);
    }

    #[test]
    fn the_headline_is_the_typical_hour_not_the_sunlit_ceiling() {
        let report = report();
        // Typical sits inside the bounds, and covers a real share of the day.
        assert!(report.typical.degrees >= report.low.degrees);
        assert!(report.typical.degrees <= report.high.degrees);
        assert!(
            (1..=100).contains(&report.typical_share),
            "share was {}",
            report.typical_share
        );
        assert!(report.high_hour.ends_with("AM") || report.high_hour.ends_with("PM"));
    }

    #[test]
    fn heavy_cloud_pulls_the_headline_down_to_the_shaded_figure() {
        // The New York case: 95% cloud must not headline the full-sun ceiling.
        let mut overcast = forecast();
        for hour in &mut overcast.hours {
            hour.cloud_cover = 95.0;
            hour.sunshine_seconds = 180.0;
        }
        let clear = report();
        let socked_in = build_report(&overcast, &target()).unwrap();

        assert!(
            socked_in.typical.degrees < clear.typical.degrees,
            "overcast typical {} should sit below clear {}",
            socked_in.typical.degrees,
            clear.typical.degrees
        );
        // And it should land near the shaded floor rather than the sun ceiling.
        let sunlit_ceiling = socked_in
            .hours
            .iter()
            .map(|row| row.sun_f)
            .max()
            .expect("hours");
        assert!(
            socked_in.high.degrees < sunlit_ceiling,
            "headline {} should stay under the {}° sunlit ceiling",
            socked_in.high.degrees,
            sunlit_ceiling
        );
    }

    #[test]
    fn headline_numbers_are_scale_points_with_their_colour_band() {
        let report = report();
        for probe in [&report.typical, &report.low, &report.high] {
            // One decimal, and a level that matches the number printed.
            assert!(probe.score.contains('.'), "{}", probe.score);
            let parsed: f64 = probe.score.parse().unwrap();
            assert_eq!(probe.level, parsed.round() as u8);
            assert!(!probe.label.is_empty());
        }
    }

    #[test]
    fn every_headline_number_carries_the_data_behind_it() {
        // The scale only works if the raw figures are one tap away.
        let report = report();
        for probe in [&report.typical, &report.low, &report.high] {
            assert!(probe.hour_label.ends_with("AM") || probe.hour_label.ends_with("PM"));
            assert!(probe.degrees > -100 && probe.degrees < 150);
            assert!(probe.wind_mph >= 0);
            assert!((0..=100).contains(&probe.humidity));
            assert!((0..=100).contains(&probe.cloud));
        }
    }

    #[test]
    fn headline_covers_the_hours_still_ahead_not_the_ones_already_gone() {
        // The fixture's coldest hour is dawn, long before the 1:15 PM "now".
        // Letting it set the advice would tell someone leaving after lunch to
        // dress for a morning they already missed.
        let report = report();
        assert_eq!(report.headline_scope, "the rest of today");

        let dawn = report
            .hours
            .iter()
            .find(|row| row.label == "5 AM")
            .unwrap()
            .shade_f;
        assert!(
            report.low.degrees > dawn,
            "headline low {} should ignore the dawn value {dawn}",
            report.low.degrees
        );
    }

    #[test]
    fn late_in_the_day_the_headline_falls_back_to_the_whole_day() {
        let mut nearly_over = forecast();
        nearly_over.current_time = "2026-08-02T22:00".to_owned();
        let report = build_report(&nearly_over, &target()).unwrap();
        assert_eq!(report.headline_scope, "today");
    }

    #[test]
    fn the_yesterday_table_still_compares_whole_days() {
        // Scoping the headline must not quietly scope the comparison too, or
        // "today vs yesterday" would be an hour count apart.
        let midday = report();
        let mut evening = forecast();
        evening.current_time = "2026-08-02T19:00".to_owned();
        let evening = build_report(&evening, &target()).unwrap();

        // Midday still has the sunny peak ahead of it; 7 PM does not.
        assert!(midday.high.degrees > evening.high.degrees);
        // But both report the same whole-day figures in the comparison table.
        assert_eq!(midday.comparisons[0].today, evening.comparisons[0].today);
        assert_eq!(midday.comparisons[1].today, evening.comparisons[1].today);
    }

    #[test]
    fn verdict_tells_you_what_to_wear_and_whether_to_carry_a_layer() {
        let report = report();
        assert!(report.verdict[0].starts_with("Dress for "));
        assert!(report.verdict.len() >= 2);
        assert!(
            report
                .verdict
                .iter()
                .any(|line| line.contains("once it goes at 8:17 PM")),
            "{:?}",
            report.verdict
        );
        assert!(
            report
                .verdict
                .iter()
                .any(|line| line.contains("carry a layer for")),
            "{:?}",
            report.verdict
        );
    }

    #[test]
    fn a_sunless_day_says_so_instead_of_promising_a_layer() {
        let mut fogged = forecast();
        for hour in &mut fogged.hours {
            hour.direct_normal = 0.0;
            hour.direct_horizontal = 0.0;
            hour.diffuse = 120.0;
            hour.cloud_cover = 100.0;
            hour.sunshine_seconds = 0.0;
        }
        let report = build_report(&fogged, &target()).unwrap();
        // With no beam at all, each hour's sun and shade readings collapse
        // together, so what range is left is the ordinary daily cycle rather
        // than anything the sun is doing.
        for row in &report.hours {
            assert!(!row.has_sun);
            assert_eq!(row.sun_f, row.shade_f);
            assert_eq!(row.sun_score, row.shade_score);
        }
        assert!(report.typical.degrees <= report.high.degrees);
    }

    #[test]
    fn hourly_rows_cover_the_window_and_mark_now_and_sunset() {
        let report = report();
        assert_eq!(report.hours.len(), 18); // 5 AM through 10 PM
        assert_eq!(report.hours[0].label, "5 AM");

        let now: Vec<&HourRow> = report.hours.iter().filter(|row| row.is_now).collect();
        assert_eq!(now.len(), 1);
        assert_eq!(now[0].label, "1 PM");
        assert!((0..=100).contains(&now[0].humidity));

        let sunset: Vec<&HourRow> = report
            .hours
            .iter()
            .filter(|row| row.sunset_follows)
            .collect();
        assert_eq!(sunset.len(), 1);
        assert_eq!(sunset[0].label, "8 PM");

        assert!(report.hours[0].past);
        assert!(!report.hours.last().unwrap().past);
    }

    #[test]
    fn hours_without_sun_do_not_offer_a_sun_reading() {
        let report = report();
        let dawn = &report.hours[0]; // 5 AM
        assert!(!dawn.has_sun);
        assert_eq!(dawn.sun_f, dawn.shade_f);

        let noon = report
            .hours
            .iter()
            .find(|row| row.label == "12 PM")
            .unwrap();
        assert!(noon.has_sun);
        assert!(noon.sun_f > noon.shade_f);
    }

    #[test]
    fn sunrise_and_sunset_are_surfaced_for_the_hourly_view() {
        let report = report();
        assert_eq!(report.sunset_label, "8:17 PM");
        assert_eq!(report.sunrise_label, "6:14 AM");
    }

    #[test]
    fn compares_against_yesterdays_actuals() {
        let report = report();
        assert!(report.has_yesterday);
        assert_eq!(report.comparisons.len(), 6);

        let typical = &report.comparisons[0];
        assert_eq!(typical.label, "Typical feel");
        assert_eq!(typical.direction, "up");
        assert!(typical.delta.starts_with('+'));

        // Same air temperatures both days, so the air row is flat while the
        // felt rows are not: exactly the "same temperature, different day" case.
        let air = &report.comparisons[3];
        assert_eq!(air.direction, "flat");
        assert_eq!(air.delta, "same");
    }

    #[test]
    fn a_day_with_no_yesterday_still_renders() {
        let mut only_today = forecast();
        only_today
            .hours
            .retain(|hour| date_of(&hour.time) == "2026-08-02");
        only_today.days.remove(0);
        let report = build_report(&only_today, &target()).unwrap();
        assert!(!report.has_yesterday);
        assert!(report.comparisons.is_empty());
        assert!(report.chart.expect("chart").yesterday_band.is_none());
    }

    #[test]
    fn now_row_reports_the_delta_against_the_same_hour_yesterday() {
        let now = report().now.expect("now row");
        assert_eq!(now.label, "1:15 PM");
        assert!(now.has_sun);
        assert!(now.sun.degrees > now.shade.degrees);
        assert!(now.sun.level >= now.shade.level);
        let versus = now.versus_yesterday.expect("comparison");
        assert!(versus.ends_with("than this time yesterday"), "{versus}");
    }

    #[test]
    fn grid_point_distance_is_reported_for_honesty() {
        let report = report();
        // Home is the Inner Sunset; the grid cell used sits a mile or so east.
        assert_eq!(report.grid_distance_mi, "1.1");
        assert_eq!(report.grid_elevation_ft, 213);
    }

    #[test]
    fn returns_nothing_when_today_is_missing_from_the_response() {
        let mut stale = forecast();
        stale.current_time = "2026-09-09T13:00".to_owned();
        assert!(build_report(&stale, &target()).is_none());
    }

    // ---- chart ----

    #[test]
    fn chart_geometry_stays_inside_the_plot_area() {
        let chart = report().chart.expect("chart");
        let coordinates = format!(
            "{} {} {}",
            chart.sun_line,
            chart.shade_line,
            chart.yesterday_band.unwrap_or_default()
        );
        for pair in coordinates.split_whitespace() {
            let (x, y) = pair.split_once(',').expect("x,y pair");
            let x: f64 = x.parse().unwrap();
            let y: f64 = y.parse().unwrap();
            assert!((PLOT_LEFT..=PLOT_RIGHT).contains(&x), "x {x} out of range");
            assert!(
                (PLOT_TOP - 0.5..=PLOT_BOTTOM + 0.5).contains(&y),
                "y {y} out of range"
            );
        }
    }

    #[test]
    fn yesterdays_outline_closes_back_along_its_shade_edge() {
        let chart = report().chart.expect("chart");
        let outline: Vec<&str> = chart
            .yesterday_band
            .as_ref()
            .expect("yesterday")
            .split(' ')
            .collect();
        let today: Vec<&str> = chart.sun_line.split(' ').collect();

        // Sun edge out and shade edge back, so twice the hour count.
        assert_eq!(outline.len(), today.len() * 2);
        assert_eq!(outline[0], *outline.last().unwrap_or(&""), "not closed");
    }

    #[test]
    fn chart_marks_sunset_and_now() {
        let chart = report().chart.expect("chart");
        let sunset = chart.sunset.expect("sunset marker");
        assert_eq!(sunset.label, "sunset 8:17 PM");
        let now = chart.now.expect("now marker");
        assert!(now.x < sunset.x, "now should sit left of sunset");
        assert!(now.show_label, "midday now-marker has room for its caption");
    }

    #[test]
    fn chart_hides_the_now_caption_when_it_would_collide_with_sunset() {
        let mut dusk = forecast();
        dusk.current_time = "2026-08-02T20:00".to_owned();
        let chart = build_report(&dusk, &target())
            .unwrap()
            .chart
            .expect("chart");
        assert!(!chart.now.expect("now marker").show_label);
        assert!(chart.sunset.expect("sunset marker").show_label);
    }

    #[test]
    fn chart_bands_tile_the_plot_without_escaping_it() {
        let chart = report().chart.expect("chart");
        assert!(!chart.bands.is_empty());
        for band in &chart.bands {
            assert!((0..=10).contains(&band.level));
            assert!(band.height >= 0.0);
            assert!(band.y >= PLOT_TOP - 0.01, "band starts above the plot");
            assert!(
                band.y + band.height <= PLOT_BOTTOM + 0.01,
                "band runs past the bottom of the plot"
            );
        }
        // Bands ascend the scale, so they descend the y axis.
        for pair in chart.bands.windows(2) {
            assert!(pair[0].level < pair[1].level);
            assert!(pair[0].y > pair[1].y);
        }
    }

    #[test]
    fn chart_axis_is_the_comfort_scale_not_degrees() {
        let chart = report().chart.expect("chart");
        for line in &chart.grid {
            assert!(
                (0..=10).contains(&line.label),
                "gridline {} is not a scale point",
                line.label
            );
        }
    }

    #[test]
    fn chart_shares_one_scale_across_both_days() {
        let chart = report().chart.expect("chart");
        assert!(!chart.grid.is_empty());
        // Gridlines ascend in temperature, so they descend the y axis.
        for pair in chart.grid.windows(2) {
            assert!(pair[0].label < pair[1].label);
            assert!(pair[0].y > pair[1].y);
        }
        assert!(chart.ticks.len() >= 4);
    }

    // ---- query resolution ----

    #[test]
    fn a_searched_place_round_trips_through_its_own_link() {
        let place = Place {
            name: "S\u{e3}o Paulo".to_owned(),
            detail: "S\u{e3}o Paulo, Brazil".to_owned(),
            latitude: -23.5475,
            longitude: -46.6361,
        };
        assert_eq!(
            place_param(&place),
            "lat=-23.5475&lon=-46.6361&name=S%C3%A3o+Paulo"
        );
    }

    fn query(loc: Option<&str>, lat: Option<&str>, lon: Option<&str>) -> WeatherQuery {
        WeatherQuery {
            loc: loc.map(str::to_owned),
            q: None,
            lat: lat.map(str::to_owned),
            lon: lon.map(str::to_owned),
            name: None,
        }
    }

    #[tokio::test]
    async fn an_empty_query_resolves_to_home() {
        let (target, alternates, error) = resolve(&query(None, None, None)).await;
        assert_eq!(target.name, "Inner Sunset");
        assert_eq!(target.param, "loc=inner-sunset");
        assert!(alternates.is_empty() && error.is_none());
    }

    #[tokio::test]
    async fn an_unknown_slug_falls_back_to_home() {
        let (target, _, error) = resolve(&query(Some("atlantis"), None, None)).await;
        assert_eq!(target.pin.as_deref(), Some("inner-sunset"));
        assert!(error.is_none());
    }

    #[tokio::test]
    async fn a_pinned_slug_resolves_to_that_neighbourhood() {
        let (target, _, _) = resolve(&query(Some("fidi"), None, None)).await;
        assert_eq!(target.name, "Financial District");
        assert_eq!(target.latitude, 37.7946);
    }

    #[tokio::test]
    async fn explicit_coordinates_are_used_verbatim() {
        let (target, _, _) = resolve(&WeatherQuery {
            loc: None,
            q: None,
            lat: Some("45.5234".to_owned()),
            lon: Some("-122.6762".to_owned()),
            name: Some("Portland".to_owned()),
        })
        .await;
        assert_eq!(target.name, "Portland");
        assert_eq!(target.latitude, 45.5234);
        assert_eq!(target.param, "lat=45.5234&lon=-122.6762&name=Portland");
    }

    #[tokio::test]
    async fn out_of_range_or_unparseable_coordinates_fall_back_to_home() {
        for (lat, lon) in [("999", "0"), ("abc", "-122.0"), ("37.7", "999")] {
            let (target, _, _) = resolve(&query(None, Some(lat), Some(lon))).await;
            assert_eq!(target.pin.as_deref(), Some("inner-sunset"), "{lat},{lon}");
        }
    }

    #[test]
    fn deltas_are_signed_and_directional() {
        assert_eq!(signed(4.4, "\u{b0}"), "+4\u{b0}");
        assert_eq!(signed(-4.4, "\u{b0}"), "-4\u{b0}");
        assert_eq!(signed(0.2, "\u{b0}"), "same");
        assert_eq!(signed(9.0, " mph"), "+9 mph");
        assert_eq!(direction_of(3.0), "up");
        assert_eq!(direction_of(-3.0), "down");
        assert_eq!(direction_of(0.4), "flat");
    }
}
