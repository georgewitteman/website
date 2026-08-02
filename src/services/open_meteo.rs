//! Open-Meteo forecast and geocoding client.
//!
//! # Why Open-Meteo
//!
//! The sun/shade split needs the beam and the sky components of solar radiation
//! separately, which rules out most of the free tier:
//!
//! * OpenWeatherMap — no radiation components outside the paid Solar Energy API.
//! * Tomorrow.io / Weatherbit — a single `solarGHI`, no direct/diffuse split.
//! * NWS api.weather.gov — free and US-only, but publishes no radiation at all.
//! * Apple WeatherKit — needs a signed key and has no radiation fields.
//!
//! Open-Meteo publishes `direct_normal_irradiance`, `direct_radiation` and
//! `diffuse_radiation` hourly, needs no API key at all (so there is no secret
//! for this server to hold or rotate), serves history and forecast from one
//! endpoint via `past_days`, and is free for non-commercial use.

use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

use crate::helpers::query_string;
use crate::units::{Speed, Temperature};

/// Upstream is on the critical path of a page load, so fail fast rather than
/// leave someone waiting at the front door with their coat half on.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(6);

/// Open-Meteo updates hourly data every 15 minutes or so; a shorter window just
/// spends someone else's quota.
const CACHE_TTL: Duration = Duration::from_secs(600);

/// Upper bound on distinct locations held in memory. Small because the pinned
/// list is small and search traffic is one person.
const CACHE_CAPACITY: usize = 64;

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .expect("failed to build http client")
});

const FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL: &str = "https://geocoding-api.open-meteo.com/v1/search";

/// Anything that can stop the page rendering a forecast.
#[derive(Debug)]
pub enum Error {
    Request(reqwest::Error),
    /// The body arrived but was not the JSON this client expects.
    Decode(serde_json::Error),
    /// The response parsed but did not contain a usable day.
    Incomplete(&'static str),
    /// A place name that matched nothing.
    NoSuchPlace(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Request(err) if err.is_timeout() => {
                write!(f, "Open-Meteo did not answer in time.")
            }
            Error::Request(_) => write!(f, "Could not reach Open-Meteo."),
            Error::Decode(_) => write!(f, "Open-Meteo sent something unreadable."),
            Error::Incomplete(what) => write!(f, "Open-Meteo returned no {what}."),
            Error::NoSuchPlace(query) => write!(f, "No place matched \u{201c}{query}\u{201d}."),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Request(err) => Some(err),
            Error::Decode(err) => Some(err),
            Error::Incomplete(_) | Error::NoSuchPlace(_) => None,
        }
    }
}

impl From<reqwest::Error> for Error {
    fn from(err: reqwest::Error) -> Self {
        Error::Request(err)
    }
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Error::Decode(err)
    }
}

/// One hour of forecast, in local time.
#[derive(Clone, Debug)]
pub struct Hour {
    /// Local naive ISO 8601, e.g. `2026-08-02T14:00`. Times are already in the
    /// location's own timezone, so they sort and compare as plain strings and
    /// this server needs no date library to work with them.
    pub time: String,
    pub air: Temperature,
    pub relative_humidity: f64,
    /// The request asks for `wind_speed_unit=ms`, which this type pins down.
    pub wind: Speed,
    pub precipitation_mm: f64,
    pub precipitation_probability: f64,
    pub cloud_cover: f64,
    pub direct_normal: f64,
    pub direct_horizontal: f64,
    pub diffuse: f64,
}

/// One day's summary, in local time.
#[derive(Clone, Debug)]
pub struct Day {
    /// Local date, `YYYY-MM-DD`.
    pub date: String,
    pub high: Temperature,
    pub low: Temperature,
    /// Local naive ISO 8601.
    pub sunrise: String,
    pub sunset: String,
}

/// A forecast for one point, as this site uses it.
#[derive(Clone, Debug)]
pub struct Forecast {
    /// Centre of the model grid cell actually used, which is not the point that
    /// was asked for. Surfaced in the UI so the page cannot overclaim.
    pub grid_latitude: f64,
    pub grid_longitude: f64,
    /// Elevation of that grid cell (m).
    pub grid_elevation: f64,
    pub timezone_abbreviation: String,
    /// Current local time at the location, `YYYY-MM-DDTHH:MM`.
    pub current_time: String,
    pub hours: Vec<Hour>,
    pub days: Vec<Day>,
}

/// A geocoding hit.
#[derive(Clone, Debug)]
pub struct Place {
    pub name: String,
    /// Region and country, already assembled for display.
    pub detail: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Clone)]
struct CacheEntry {
    forecast: Arc<Forecast>,
    fresh_until: Instant,
}

static CACHE: LazyLock<Mutex<HashMap<String, CacheEntry>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Cache key. Rounded so that a search result and a pin for the same block
/// share an entry, and so float formatting cannot produce two keys for one
/// place.
fn cache_key(latitude: f64, longitude: f64) -> String {
    format!("{latitude:.4},{longitude:.4}")
}

/// Fetches yesterday, today and tomorrow for a point.
///
/// Yesterday comes from the same endpoint via `past_days`, which serves the
/// most recent model analysis for hours that have already happened rather than
/// the forecast that was live at the time.
pub async fn forecast(latitude: f64, longitude: f64) -> Result<Arc<Forecast>, Error> {
    let key = cache_key(latitude, longitude);

    if let Some(entry) = CACHE.lock().expect("cache mutex poisoned").get(&key) {
        if Instant::now() < entry.fresh_until {
            return Ok(entry.forecast.clone());
        }
    }

    let query = query_string(&[
        ("latitude", &format!("{latitude:.4}")),
        ("longitude", &format!("{longitude:.4}")),
        // Both direct components are requested: the normal one drives the
        // radiation budget, the horizontal one recovers the solar elevation.
        (
            "hourly",
            "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,\
             cloud_cover,wind_speed_10m,direct_radiation,diffuse_radiation,\
             direct_normal_irradiance",
        ),
        (
            "daily",
            "temperature_2m_max,temperature_2m_min,sunrise,sunset",
        ),
        ("current", "temperature_2m"),
        ("past_days", "1"),
        ("forecast_days", "2"),
        // Everything comes back in the location's own clock time, so a
        // stateless server never has to know what time it is anywhere.
        ("timezone", "auto"),
        ("wind_speed_unit", "ms"),
    ]);

    let body = CLIENT
        .get(format!("{FORECAST_URL}?{query}"))
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    let forecast = Arc::new(serde_json::from_slice::<ApiForecast>(&body)?.into_forecast()?);

    let mut cache = CACHE.lock().expect("cache mutex poisoned");
    let now = Instant::now();
    cache.retain(|_, entry| now < entry.fresh_until);
    if cache.len() >= CACHE_CAPACITY {
        cache.clear();
    }
    cache.insert(
        key,
        CacheEntry {
            forecast: forecast.clone(),
            fresh_until: now + CACHE_TTL,
        },
    );

    Ok(forecast)
}

/// Looks a place name up. Results are ordered by population, so the first is
/// almost always the intended one and the rest become "did you mean" links.
pub async fn geocode(query: &str) -> Result<Vec<Place>, Error> {
    let parameters = query_string(&[
        ("name", query),
        ("count", "5"),
        ("language", "en"),
        ("format", "json"),
    ]);

    let body = CLIENT
        .get(format!("{GEOCODING_URL}?{parameters}"))
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;

    let places: Vec<Place> = serde_json::from_slice::<ApiGeocoding>(&body)?
        .results
        .unwrap_or_default()
        .into_iter()
        .map(ApiPlace::into_place)
        .collect();

    if places.is_empty() {
        return Err(Error::NoSuchPlace(query.to_owned()));
    }
    Ok(places)
}

/// Great-circle distance in miles.
///
/// Used only to say how far the model's grid cell is from the requested point.
pub fn distance_miles(
    from_latitude: f64,
    from_longitude: f64,
    to_latitude: f64,
    to_longitude: f64,
) -> f64 {
    const EARTH_RADIUS_MILES: f64 = 3958.8;

    let lat1 = from_latitude.to_radians();
    let lat2 = to_latitude.to_radians();
    let delta_lat = (to_latitude - from_latitude).to_radians();
    let delta_lon = (to_longitude - from_longitude).to_radians();

    let a =
        (delta_lat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (delta_lon / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_MILES * a.sqrt().clamp(0.0, 1.0).asin()
}

// ==================== Wire types ====================

#[derive(Deserialize)]
struct ApiForecast {
    latitude: f64,
    longitude: f64,
    elevation: f64,
    timezone_abbreviation: String,
    current: ApiCurrent,
    hourly: ApiHourly,
    daily: ApiDaily,
}

#[derive(Deserialize)]
struct ApiCurrent {
    time: String,
}

/// Open-Meteo returns parallel arrays, with `null` for any hour a model did not
/// produce. Every numeric series is optional per element for that reason.
#[derive(Deserialize)]
struct ApiHourly {
    time: Vec<String>,
    temperature_2m: Vec<Option<f64>>,
    relative_humidity_2m: Vec<Option<f64>>,
    precipitation: Vec<Option<f64>>,
    precipitation_probability: Vec<Option<f64>>,
    cloud_cover: Vec<Option<f64>>,
    wind_speed_10m: Vec<Option<f64>>,
    direct_radiation: Vec<Option<f64>>,
    diffuse_radiation: Vec<Option<f64>>,
    direct_normal_irradiance: Vec<Option<f64>>,
}

#[derive(Deserialize)]
struct ApiDaily {
    time: Vec<String>,
    temperature_2m_max: Vec<Option<f64>>,
    temperature_2m_min: Vec<Option<f64>>,
    sunrise: Vec<Option<String>>,
    sunset: Vec<Option<String>>,
}

#[derive(Deserialize)]
struct ApiGeocoding {
    results: Option<Vec<ApiPlace>>,
}

#[derive(Deserialize)]
struct ApiPlace {
    name: String,
    latitude: f64,
    longitude: f64,
    admin1: Option<String>,
    country: Option<String>,
}

impl ApiPlace {
    fn into_place(self) -> Place {
        let detail = [self.admin1, self.country]
            .into_iter()
            .flatten()
            .collect::<Vec<String>>()
            .join(", ");
        Place {
            name: self.name,
            detail,
            latitude: self.latitude,
            longitude: self.longitude,
        }
    }
}

/// Reads element `index` of an optional series, treating a missing element and
/// an explicit `null` the same way.
fn value_at(series: &[Option<f64>], index: usize) -> Option<f64> {
    series.get(index).copied().flatten()
}

/// Same, but for series where a gap is harmless. Radiation is zero at night and
/// precipitation probability is zero when the model has nothing to say.
fn value_or_zero(series: &[Option<f64>], index: usize) -> f64 {
    value_at(series, index).unwrap_or(0.0)
}

impl ApiForecast {
    fn into_forecast(self) -> Result<Forecast, Error> {
        let hourly = self.hourly;
        let hours: Vec<Hour> = (0..hourly.time.len())
            .filter_map(|i| {
                // An hour with no temperature, humidity or wind cannot be run
                // through the comfort model at all, so drop it rather than
                // invent a value. Everything else defaults to zero.
                Some(Hour {
                    time: hourly.time.get(i)?.clone(),
                    air: Temperature::from_celsius(value_at(&hourly.temperature_2m, i)?),
                    relative_humidity: value_at(&hourly.relative_humidity_2m, i)?,
                    wind: Speed::from_meters_per_second(value_at(&hourly.wind_speed_10m, i)?),
                    precipitation_mm: value_or_zero(&hourly.precipitation, i),
                    precipitation_probability: value_or_zero(&hourly.precipitation_probability, i),
                    cloud_cover: value_or_zero(&hourly.cloud_cover, i),
                    direct_normal: value_or_zero(&hourly.direct_normal_irradiance, i),
                    direct_horizontal: value_or_zero(&hourly.direct_radiation, i),
                    diffuse: value_or_zero(&hourly.diffuse_radiation, i),
                })
            })
            .collect();

        if hours.is_empty() {
            return Err(Error::Incomplete("hourly data"));
        }

        let daily = self.daily;
        let days: Vec<Day> = (0..daily.time.len())
            .filter_map(|i| {
                Some(Day {
                    date: daily.time.get(i)?.clone(),
                    high: Temperature::from_celsius(value_at(&daily.temperature_2m_max, i)?),
                    low: Temperature::from_celsius(value_at(&daily.temperature_2m_min, i)?),
                    sunrise: daily.sunrise.get(i)?.clone()?,
                    sunset: daily.sunset.get(i)?.clone()?,
                })
            })
            .collect();

        if days.is_empty() {
            return Err(Error::Incomplete("daily data"));
        }

        Ok(Forecast {
            grid_latitude: self.latitude,
            grid_longitude: self.longitude,
            grid_elevation: self.elevation,
            timezone_abbreviation: self.timezone_abbreviation,
            current_time: self.current.time,
            hours,
            days,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Trimmed from a real api.open-meteo.com response for San Francisco.
    const SAMPLE: &str = r#"{
      "latitude": 37.756073, "longitude": -122.44574, "elevation": 65.0,
      "utc_offset_seconds": -25200, "timezone": "America/Los_Angeles",
      "timezone_abbreviation": "GMT-7",
      "current": {"time": "2026-08-02T13:15", "temperature_2m": 21.5},
      "hourly": {
        "time": ["2026-08-01T12:00", "2026-08-01T13:00", "2026-08-02T12:00"],
        "temperature_2m": [21.1, 21.9, 22.7],
        "relative_humidity_2m": [71, 71, 63],
        "precipitation": [0.0, 0.0, 0.1],
        "precipitation_probability": [0, 0, 12],
        "cloud_cover": [4, 0, 11],
        "wind_speed_10m": [3.04, 5.22, 4.1],
        "direct_radiation": [722.0, 863.0, 700.5],
        "diffuse_radiation": [160.5, 112.0, 150.0],
        "direct_normal_irradiance": [841.9, 936.6, 830.0]
      },
      "daily": {
        "time": ["2026-08-01", "2026-08-02"],
        "temperature_2m_max": [22.0, 23.0],
        "temperature_2m_min": [12.6, 12.4],
        "sunrise": ["2026-08-01T06:13", "2026-08-02T06:14"],
        "sunset": ["2026-08-01T20:18", "2026-08-02T20:17"]
      }
    }"#;

    fn sample() -> Forecast {
        serde_json::from_str::<ApiForecast>(SAMPLE)
            .unwrap()
            .into_forecast()
            .unwrap()
    }

    #[test]
    fn parses_a_real_response() {
        let forecast = sample();
        assert_eq!(forecast.current_time, "2026-08-02T13:15");
        assert_eq!(forecast.grid_elevation, 65.0);
        assert_eq!(forecast.timezone_abbreviation, "GMT-7");
        assert_eq!(forecast.hours.len(), 3);
        assert_eq!(forecast.days.len(), 2);
    }

    #[test]
    fn keeps_the_grid_point_rather_than_the_requested_point() {
        // The UI depends on this being the model's coordinates, not ours.
        let forecast = sample();
        assert_eq!(forecast.grid_latitude, 37.756073);
        assert_eq!(forecast.grid_longitude, -122.44574);
    }

    #[test]
    fn zips_the_parallel_arrays_in_order() {
        let forecast = sample();
        let hour = &forecast.hours[1];
        assert_eq!(hour.time, "2026-08-01T13:00");
        assert_eq!(hour.air.celsius(), 21.9);
        assert_eq!(hour.relative_humidity, 71.0);
        assert_eq!(hour.wind.meters_per_second(), 5.22);
        assert_eq!(hour.direct_normal, 936.6);
        assert_eq!(hour.direct_horizontal, 863.0);
        assert_eq!(hour.diffuse, 112.0);
    }

    #[test]
    fn parses_the_daily_block() {
        let day = &sample().days[1];
        assert_eq!(day.date, "2026-08-02");
        assert_eq!(day.high.celsius(), 23.0);
        assert_eq!(day.low.celsius(), 12.4);
        assert_eq!(day.sunset, "2026-08-02T20:17");
    }

    #[test]
    fn drops_hours_missing_a_required_field_but_keeps_the_rest() {
        let json = SAMPLE.replace("[21.1, 21.9, 22.7]", "[21.1, null, 22.7]");
        let forecast = serde_json::from_str::<ApiForecast>(&json)
            .unwrap()
            .into_forecast()
            .unwrap();
        assert_eq!(forecast.hours.len(), 2);
        assert_eq!(forecast.hours[1].time, "2026-08-02T12:00");
    }

    #[test]
    fn treats_a_missing_optional_series_value_as_zero() {
        let json = SAMPLE.replace("[722.0, 863.0, 700.5]", "[722.0, null, 700.5]");
        let forecast = serde_json::from_str::<ApiForecast>(&json)
            .unwrap()
            .into_forecast()
            .unwrap();
        assert_eq!(forecast.hours[1].direct_horizontal, 0.0);
        assert_eq!(forecast.hours[1].air.celsius(), 21.9);
    }

    #[test]
    fn rejects_a_response_with_no_usable_hours() {
        let json = SAMPLE.replace("[21.1, 21.9, 22.7]", "[null, null, null]");
        let result = serde_json::from_str::<ApiForecast>(&json)
            .unwrap()
            .into_forecast();
        assert!(matches!(result, Err(Error::Incomplete("hourly data"))));
    }

    #[test]
    fn rejects_a_response_with_no_usable_days() {
        let json = SAMPLE.replace(
            r#""sunset": ["2026-08-01T20:18", "2026-08-02T20:17"]"#,
            r#""sunset": [null, null]"#,
        );
        let result = serde_json::from_str::<ApiForecast>(&json)
            .unwrap()
            .into_forecast();
        assert!(matches!(result, Err(Error::Incomplete("daily data"))));
    }

    #[test]
    fn assembles_geocoding_detail_from_whatever_is_present() {
        let full: ApiPlace = serde_json::from_str(
            r#"{"name":"Portland","latitude":45.5,"longitude":-122.7,"admin1":"Oregon","country":"United States"}"#,
        )
        .unwrap();
        assert_eq!(full.into_place().detail, "Oregon, United States");

        let sparse: ApiPlace =
            serde_json::from_str(r#"{"name":"Nowhere","latitude":0.0,"longitude":0.0}"#).unwrap();
        assert_eq!(sparse.into_place().detail, "");
    }

    #[test]
    fn cache_keys_collapse_insignificant_precision() {
        assert_eq!(
            cache_key(37.759_600_1, -122.426_9),
            cache_key(37.759_6, -122.426_899_9)
        );
        assert_ne!(cache_key(37.7596, -122.4269), cache_key(37.7601, -122.4661));
    }

    #[test]
    fn distance_matches_known_separations() {
        // Inner Sunset to the Financial District is a little over 2 miles.
        let miles = distance_miles(37.7601, -122.4661, 37.7946, -122.3999);
        assert!((3.5..4.5).contains(&miles), "{miles} miles");

        assert_eq!(distance_miles(37.0, -122.0, 37.0, -122.0), 0.0);

        // SF to NYC, a well-known 2570 miles.
        let coast_to_coast = distance_miles(37.7749, -122.4194, 40.7128, -74.006);
        assert!(
            (2550.0..2600.0).contains(&coast_to_coast),
            "{coast_to_coast}"
        );
    }

    #[test]
    fn errors_read_as_sentences() {
        assert_eq!(
            Error::Incomplete("hourly data").to_string(),
            "Open-Meteo returned no hourly data."
        );
        assert_eq!(
            Error::NoSuchPlace("qqqq".to_owned()).to_string(),
            "No place matched \u{201c}qqqq\u{201d}."
        );
    }
}
