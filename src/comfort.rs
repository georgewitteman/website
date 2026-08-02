//! Felt temperature: what the air actually does to a person standing in it.
//!
//! # Why not the API's "feels like"
//!
//! Consumer `apparent_temperature` fields are a switch between Rothfusz heat
//! index (above ~80°F) and the JAG/TI wind chill (below ~50°F), with raw air
//! temperature in between. In the 50-80°F band this page exists for, they carry
//! no information at all, and none of them know whether the sun is out.
//!
//! # The model
//!
//! Steadman's apparent temperature, radiation form, as published by the
//! Australian Bureau of Meteorology:
//!
//! ```text
//! AT = Ta + 0.348e - 0.70v + 0.70Q/(v + 10) - 4.25
//! ```
//!
//! `Ta` is air temperature (°C), `e` water vapour pressure (hPa), `v` wind
//! speed at 10 m (m/s), and `Q` the net radiation absorbed per unit area of
//! body surface (W/m²). It is continuous over the whole mild range, it takes
//! wind and humidity as first-class inputs, and — unlike every other common
//! index — it has an explicit radiation term, which is what lets one model
//! produce both halves of the sun/shade pair.
//!
//! Steadman, R.G. (1994), *Norms of apparent temperature in Australia*, Aust.
//! Met. Mag. 43, 1-16.
//!
//! # Getting Q
//!
//! Steadman does not say how to obtain `Q`, so it is built here as the standard
//! human radiation budget for a standing person, expressed relative to a
//! radiatively neutral environment (everything at air temperature). That
//! reference point matters: it makes `Q ≈ 0` for an overcast night, so the
//! radiation form degrades gracefully into Steadman's non-radiation form
//! (`Ta + 0.33e - 0.70v - 4.00`) rather than diverging from it.
//!
//! ```text
//! Q = a_sw * (f_p * DNI + f_eff * (F_sky * DHI + F_grd * albedo * G)) + L_net
//! ```
//!
//! * `f_p`, the projected area factor of a standing body, is Fanger's (1970)
//!   azimuth-averaged form `0.308 cos(b(1 - b²/48000))` for solar elevation
//!   `b` in degrees. It is why noon sun adds less than the raw beam suggests:
//!   an upright person presents very little area to an overhead sun.
//! * `f_eff = 0.725` is the fraction of body surface that exchanges radiation
//!   with the environment at all, and `F_sky = F_grd = 0.5` the sky/ground view
//!   factors of an upright cylinder.
//! * `L_net` is the longwave term: a clear sky is far colder than the air and
//!   pulls real heat off a body, an overcast one radiates back at roughly air
//!   temperature. Sky emissivity is Brunt's `0.605 + 0.048√e`, blended toward
//!   the black-body value 1.0 by cloud fraction. This is the part that makes a
//!   clear evening feel colder than a cloudy one at the same temperature.
//!
//! The sun and shade figures differ only in `Q`: shade drops the direct beam
//! and reflects off shaded ground (diffuse only) instead of sunlit ground.
//!
//! # Sun, shade, and the day you actually get
//!
//! Those two are the bounds, not the expectation. The sun figure assumes the
//! beam is on you, which under heavy cloud is a place you may not stand all
//! day — cloud cover is not the same thing as shade, and reporting the sunlit
//! ceiling as "how it feels" overstates an overcast day badly. [`Felt::typical`]
//! is the two blended by how much sky is actually clear: cloud cover is the
//! fraction of sky covered, so `1 - cloud` approximates the chance the sun's
//! disc is on you at any given moment. Under a solid deck it collapses onto the
//! shade figure; under a clear sky it is the sun figure.
//!
//! Inputs and outputs are typed ([`Temperature`], [`Speed`]) so a caller cannot
//! feed Fahrenheit or mph into formulas calibrated for neither. Inside a single
//! formula the values are plain `f64`: the physics mixes units by design, and
//! wrapping every intermediate would obscure it.

use crate::units::{Speed, Temperature};

/// Stefan-Boltzmann constant (W/m²/K⁴).
const STEFAN_BOLTZMANN: f64 = 5.670_374_419e-8;

/// Shortwave absorptivity of a clothed body.
const SHORTWAVE_ABSORPTIVITY: f64 = 0.7;

/// Longwave emissivity of skin and clothing.
const LONGWAVE_EMISSIVITY: f64 = 0.95;

/// Fraction of body surface that exchanges radiation with the environment
/// rather than with itself. 0.725 is the standing value.
const EFFECTIVE_AREA_FRACTION: f64 = 0.725;

/// View factors of an upright body: half sky, half ground.
const SKY_VIEW_FACTOR: f64 = 0.5;
const GROUND_VIEW_FACTOR: f64 = 0.5;

/// Reflectance of ordinary ground cover. Concrete and asphalt bracket this.
const GROUND_ALBEDO: f64 = 0.2;

/// One hour of weather, in the units this model works in.
#[derive(Clone, Copy, Debug)]
pub struct Conditions {
    /// Air temperature at 2 m.
    pub air: Temperature,
    /// Relative humidity at 2 m (%).
    pub relative_humidity: f64,
    /// Wind speed at 10 m. Steadman's `v` is a 10 m wind.
    pub wind: Speed,
    /// Direct normal irradiance: beam strength facing the sun (W/m²).
    pub direct_normal: f64,
    /// Direct irradiance on a horizontal plane (W/m²). Only used to recover the
    /// solar elevation, via `direct_horizontal = DNI · sin(elevation)`.
    pub direct_horizontal: f64,
    /// Diffuse (sky) irradiance on a horizontal plane (W/m²).
    pub diffuse: f64,
    /// Cloud cover (%).
    pub cloud_cover: f64,
}

/// How one hour feels: the two bounds, and the expectation between them.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Felt {
    /// With the beam directly on you. The ceiling, not the forecast.
    pub sun: Temperature,
    /// Out of the beam. The floor for as long as the sun is up.
    pub shade: Temperature,
    /// The two weighted by how much of the sky is clear — what the hour is
    /// actually likely to feel like.
    pub typical: Temperature,
}

/// Water vapour pressure (hPa) via the Magnus form Steadman's users assume.
fn vapour_pressure_hpa(air_c: f64, relative_humidity: f64) -> f64 {
    let saturation = 6.105 * (17.27 * air_c / (237.7 + air_c)).exp();
    (relative_humidity.clamp(0.0, 100.0) / 100.0) * saturation
}

/// Fanger's projected area factor for a standing person, averaged over azimuth.
///
/// Peaks at 0.308 with the sun on the horizon and falls to ~0.08 overhead.
fn projected_area_factor(solar_elevation_deg: f64) -> f64 {
    let elevation = solar_elevation_deg.clamp(0.0, 90.0);
    0.308
        * (elevation * (1.0 - elevation * elevation / 48_000.0))
            .to_radians()
            .cos()
}

/// Recovers solar elevation from the two direct-radiation components.
///
/// Saves asking for a separate solar position: the API already reports the beam
/// both normal to the sun and projected onto the horizontal.
fn solar_elevation_deg(direct_normal: f64, direct_horizontal: f64) -> f64 {
    if direct_normal <= 0.0 {
        return 0.0;
    }
    (direct_horizontal / direct_normal)
        .clamp(0.0, 1.0)
        .asin()
        .to_degrees()
}

/// Net longwave exchange (W/m²), relative to a body in an environment at air
/// temperature. Negative under a clear sky, ~0 under overcast.
fn net_longwave(air_c: f64, vapour_hpa: f64, cloud_cover: f64) -> f64 {
    let clear_sky_emissivity = (0.605 + 0.048 * vapour_hpa.max(0.0).sqrt()).clamp(0.0, 1.0);
    let cloud_fraction = (cloud_cover / 100.0).clamp(0.0, 1.0);
    // Cloud base sits near air temperature, so overcast radiates as a black body.
    let sky_emissivity = clear_sky_emissivity + (1.0 - clear_sky_emissivity) * cloud_fraction;

    let air_k = air_c + 273.15;
    EFFECTIVE_AREA_FRACTION
        * LONGWAVE_EMISSIVITY
        * STEFAN_BOLTZMANN
        * air_k.powi(4)
        * SKY_VIEW_FACTOR
        * (sky_emissivity - 1.0)
}

/// Shortwave absorbed per unit body surface (W/m²).
///
/// `beam` is already projected onto the body; `reflecting` is the irradiance
/// reaching the ground the body sees, which is the global figure in the open
/// and the diffuse figure in a shadow.
fn absorbed_shortwave(beam: f64, diffuse: f64, reflecting: f64) -> f64 {
    SHORTWAVE_ABSORPTIVITY
        * (beam
            + EFFECTIVE_AREA_FRACTION
                * (SKY_VIEW_FACTOR * diffuse + GROUND_VIEW_FACTOR * GROUND_ALBEDO * reflecting))
}

/// Steadman's apparent temperature, radiation form (°C).
fn apparent_temperature_c(air_c: f64, vapour_hpa: f64, wind_ms: f64, net_radiation: f64) -> f64 {
    air_c + 0.348 * vapour_hpa - 0.70 * wind_ms + 0.70 * net_radiation / (wind_ms + 10.0) - 4.25
}

/// Felt temperature in direct sun and in shade for one hour.
pub fn felt(conditions: &Conditions) -> Felt {
    let air_c = conditions.air.celsius();
    let vapour = vapour_pressure_hpa(air_c, conditions.relative_humidity);
    let wind = conditions.wind.meters_per_second().max(0.0);
    let longwave = net_longwave(air_c, vapour, conditions.cloud_cover);

    let elevation = solar_elevation_deg(conditions.direct_normal, conditions.direct_horizontal);
    let beam = projected_area_factor(elevation) * conditions.direct_normal.max(0.0);
    let diffuse = conditions.diffuse.max(0.0);
    let global = conditions.direct_horizontal.max(0.0) + diffuse;

    // In shade the beam is gone and the ground you see is shaded too, so it can
    // only bounce back the diffuse component.
    let sun_radiation = absorbed_shortwave(beam, diffuse, global) + longwave;
    let shade_radiation = absorbed_shortwave(0.0, diffuse, diffuse) + longwave;

    let sun = apparent_temperature_c(air_c, vapour, wind, sun_radiation);
    let shade = apparent_temperature_c(air_c, vapour, wind, shade_radiation);
    let clear_sky = 1.0 - (conditions.cloud_cover / 100.0).clamp(0.0, 1.0);

    Felt {
        sun: Temperature::from_celsius(sun),
        shade: Temperature::from_celsius(shade),
        typical: Temperature::from_celsius(shade + clear_sky * (sun - shade)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A clear San Francisco afternoon: mild air, stiff sea breeze, full sun.
    fn sunny_sf() -> Conditions {
        Conditions {
            air: Temperature::from_celsius(18.0),
            relative_humidity: 70.0,
            wind: Speed::from_meters_per_second(6.0),
            direct_normal: 850.0,
            direct_horizontal: 736.0, // 850 · sin(60°)
            diffuse: 100.0,
            cloud_cover: 0.0,
        }
    }

    /// The same air, under a marine layer.
    fn overcast_sf() -> Conditions {
        Conditions {
            direct_normal: 0.0,
            direct_horizontal: 0.0,
            diffuse: 180.0,
            cloud_cover: 100.0,
            ..sunny_sf()
        }
    }

    fn night() -> Conditions {
        Conditions {
            direct_normal: 0.0,
            direct_horizontal: 0.0,
            diffuse: 0.0,
            ..sunny_sf()
        }
    }

    #[test]
    fn vapour_pressure_matches_magnus_formula() {
        // 20°C saturates near 23.4 hPa, so half that at 50% humidity.
        let saturated = vapour_pressure_hpa(20.0, 100.0);
        assert!((saturated - 23.4).abs() < 0.3, "{saturated}");
        assert!((vapour_pressure_hpa(20.0, 50.0) - saturated / 2.0).abs() < 1e-9);
        assert_eq!(vapour_pressure_hpa(20.0, 0.0), 0.0);
    }

    #[test]
    fn projected_area_peaks_at_the_horizon_and_shrinks_overhead() {
        assert!((projected_area_factor(0.0) - 0.308).abs() < 1e-9);
        assert!(projected_area_factor(90.0) < 0.09);
        // Monotonically decreasing as the sun climbs.
        for elevation in 0..90 {
            let low = projected_area_factor(f64::from(elevation));
            let high = projected_area_factor(f64::from(elevation) + 1.0);
            assert!(high < low, "not decreasing at {elevation}°");
        }
    }

    #[test]
    fn projected_area_is_clamped_outside_the_real_range() {
        assert_eq!(projected_area_factor(-10.0), projected_area_factor(0.0));
        assert_eq!(projected_area_factor(120.0), projected_area_factor(90.0));
    }

    #[test]
    fn solar_elevation_is_recovered_from_the_beam_components() {
        assert!((solar_elevation_deg(1000.0, 500.0) - 30.0).abs() < 1e-9);
        assert!((solar_elevation_deg(1000.0, 1000.0) - 90.0).abs() < 1e-9);
        // Rounding in the source data must not produce a NaN from asin.
        assert!((solar_elevation_deg(800.0, 801.0) - 90.0).abs() < 1e-9);
        assert_eq!(solar_elevation_deg(0.0, 0.0), 0.0);
    }

    #[test]
    fn clear_sky_pulls_heat_off_a_body_and_overcast_does_not() {
        let vapour = vapour_pressure_hpa(18.0, 70.0);
        let clear = net_longwave(18.0, vapour, 0.0);
        let overcast = net_longwave(18.0, vapour, 100.0);
        assert!((-45.0..-15.0).contains(&clear), "{clear}");
        assert!(overcast.abs() < 1e-9, "{overcast}");
        assert!(net_longwave(18.0, vapour, 50.0) > clear);
    }

    #[test]
    fn sun_and_shade_are_identical_after_dark() {
        let felt = felt(&night());
        assert_eq!(felt.sun, felt.shade);
        assert_eq!(felt.typical, felt.shade);
        assert_eq!((felt.sun - felt.shade).fahrenheit(), 0.0);
    }

    #[test]
    fn a_solid_overcast_makes_the_typical_hour_a_shaded_one() {
        // The case that made this necessary: a New York afternoon under 95%
        // cloud was reporting the full-sun ceiling as how the day would feel.
        let socked_in = Conditions {
            cloud_cover: 95.0,
            ..sunny_sf()
        };
        let felt = felt(&socked_in);
        assert!(
            (felt.typical - felt.shade).fahrenheit().abs() < 1.0,
            "typical {:?} should sit on the shade figure {:?}",
            felt.typical,
            felt.shade
        );
        assert!(felt.sun > felt.typical);
    }

    #[test]
    fn a_clear_sky_makes_the_typical_hour_a_sunlit_one() {
        let felt = felt(&sunny_sf()); // 0% cloud
        assert_eq!(felt.typical, felt.sun);
    }

    #[test]
    fn typical_always_sits_between_the_two_bounds() {
        for cloud in 0..=100 {
            let felt = felt(&Conditions {
                cloud_cover: f64::from(cloud),
                ..sunny_sf()
            });
            assert!(
                felt.typical >= felt.shade && felt.typical <= felt.sun,
                "{cloud}% cloud put typical outside the pair"
            );
        }
    }

    #[test]
    fn radiation_form_agrees_with_steadmans_shade_formula_at_night() {
        // With no shortwave and no clear-sky loss, the radiation form should
        // land within a fraction of a degree of AT = Ta + 0.33e - 0.70v - 4.00.
        let conditions = Conditions {
            cloud_cover: 100.0,
            ..night()
        };
        let vapour = vapour_pressure_hpa(conditions.air.celsius(), conditions.relative_humidity);
        let non_radiative = Temperature::from_celsius(
            conditions.air.celsius() + 0.33 * vapour
                - 0.70 * conditions.wind.meters_per_second()
                - 4.00,
        );
        assert!((felt(&conditions).shade - non_radiative).fahrenheit().abs() < 0.9);
    }

    #[test]
    fn full_sun_opens_a_real_gap_over_shade() {
        let felt = felt(&sunny_sf());
        let gap = (felt.sun - felt.shade).fahrenheit();
        // The whole premise of the page: a mild, windy, sunny day is two days.
        assert!((8.0..16.0).contains(&gap), "sun/shade gap was {gap}°F");
        let air = Temperature::from_celsius(18.0);
        assert!(felt.sun > air);
        assert!(felt.shade < air);
    }

    #[test]
    fn overcast_leaves_almost_no_gap() {
        let felt = felt(&overcast_sf());
        assert!((felt.sun - felt.shade).fahrenheit().abs() < 1.0);
    }

    #[test]
    fn the_model_stays_informative_in_the_mild_band() {
        // Identical air temperature, four different days. A consumer
        // "feels like" would return 64°F for all four.
        let calm_cloudy = Conditions {
            wind: Speed::from_meters_per_second(1.0),
            ..overcast_sf()
        };
        let windy_cloudy = overcast_sf();
        let calm_sunny = Conditions {
            wind: Speed::from_meters_per_second(1.0),
            ..sunny_sf()
        };
        let windy_sunny = sunny_sf();

        let spread = (felt(&calm_sunny).sun - felt(&windy_cloudy).shade).fahrenheit();
        assert!(spread > 15.0, "mild-band spread was only {spread}°F");

        assert!(felt(&calm_cloudy).shade > felt(&windy_cloudy).shade);
        assert!(felt(&calm_sunny).sun > felt(&windy_sunny).sun);
    }

    #[test]
    fn wind_and_humidity_both_move_the_answer() {
        let base = overcast_sf();
        let windier = Conditions {
            wind: Speed::from_meters_per_second(base.wind.meters_per_second() + 5.0),
            ..base
        };
        let drier = Conditions {
            relative_humidity: 20.0,
            ..base
        };
        assert!(felt(&windier).shade < felt(&base).shade);
        assert!(felt(&drier).shade < felt(&base).shade);
    }

    #[test]
    fn noon_sun_is_gentler_on_a_standing_body_than_afternoon_sun() {
        // Same beam strength, different elevation: the projected area factor
        // means an overhead sun lands on less of a standing person.
        let overhead = Conditions {
            direct_horizontal: 850.0, // elevation 90°
            ..sunny_sf()
        };
        let low = Conditions {
            direct_horizontal: 425.0, // elevation 30°
            ..sunny_sf()
        };
        assert!(felt(&low).sun > felt(&overhead).sun);
    }

    #[test]
    fn absurd_inputs_do_not_produce_nan() {
        let broken = Conditions {
            air: Temperature::from_celsius(-60.0),
            relative_humidity: 150.0,
            wind: Speed::from_meters_per_second(-3.0),
            direct_normal: -10.0,
            direct_horizontal: -10.0,
            diffuse: -10.0,
            cloud_cover: 300.0,
        };
        let felt = felt(&broken);
        assert!(felt.sun.celsius().is_finite() && felt.shade.celsius().is_finite());
    }
}
