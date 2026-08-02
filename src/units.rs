//! Typed physical quantities.
//!
//! Everything on this page is a bare number until it isn't: the comfort model
//! is calibrated in Celsius and metres per second, the page displays Fahrenheit
//! and miles per hour, and half the arithmetic is on *differences* between
//! temperatures rather than temperatures. That last one is the trap — a
//! temperature converts with an offset and a temperature difference does not,
//! so one `f64` for both lets a 5°C swing render as 41°F.
//!
//! Each quantity here stores a single canonical unit behind a private field,
//! so a unit exists only at the two boundaries: a named constructor going in
//! and a named accessor coming out. Nothing in between carries a unit, which
//! means there is no `Fahrenheit(celsius_value)` mistake available to make, and
//! comparing or averaging never has to ask which scale it is holding.
//!
//! Quantities that never convert and never mix — irradiance in W/m²,
//! percentages, millimetres of rain, the one grid distance in miles — stay as
//! `f64`. A newtype there would be ceremony.

use std::ops::Sub;

/// An air or felt temperature. Stored in Celsius.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct Temperature(f64);

/// A difference between two temperatures. Stored in Celsius degrees.
///
/// Separate from [`Temperature`] because it converts without the 32° offset.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct TemperatureDelta(f64);

/// A wind speed. Stored in metres per second.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct Speed(f64);

impl Temperature {
    pub const fn from_celsius(degrees: f64) -> Self {
        Temperature(degrees)
    }

    pub fn celsius(self) -> f64 {
        self.0
    }

    pub fn fahrenheit(self) -> f64 {
        self.0 * 9.0 / 5.0 + 32.0
    }

    /// Whole degrees Fahrenheit, which is all this page ever displays.
    pub fn round_fahrenheit(self) -> i32 {
        self.fahrenheit().round() as i32
    }

    pub fn min(self, other: Self) -> Self {
        Temperature(self.0.min(other.0))
    }

    pub fn max(self, other: Self) -> Self {
        Temperature(self.0.max(other.0))
    }
}

impl Sub for Temperature {
    type Output = TemperatureDelta;

    fn sub(self, other: Self) -> TemperatureDelta {
        TemperatureDelta(self.0 - other.0)
    }
}

impl TemperatureDelta {
    /// No offset: a five degree change is a nine degree change.
    pub fn fahrenheit(self) -> f64 {
        self.0 * 9.0 / 5.0
    }

    pub fn round_fahrenheit(self) -> i32 {
        self.fahrenheit().round() as i32
    }
}

impl Speed {
    pub const fn from_meters_per_second(speed: f64) -> Self {
        Speed(speed)
    }

    /// The unit Steadman's formula is calibrated in.
    pub fn meters_per_second(self) -> f64 {
        self.0
    }

    pub fn miles_per_hour(self) -> f64 {
        self.0 * 2.236_936
    }

    pub fn round_miles_per_hour(self) -> i32 {
        self.miles_per_hour().round() as i32
    }

    pub fn max(self, other: Self) -> Self {
        Speed(self.0.max(other.0))
    }
}

/// A speed difference is still a speed; there is no offset to get wrong, so
/// this needs no separate delta type the way temperature does.
impl Sub for Speed {
    type Output = Speed;

    fn sub(self, other: Self) -> Speed {
        Speed(self.0 - other.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn temperatures_convert_with_the_offset() {
        assert_eq!(Temperature::from_celsius(0.0).fahrenheit(), 32.0);
        assert_eq!(Temperature::from_celsius(100.0).fahrenheit(), 212.0);
        assert_eq!(Temperature::from_celsius(-40.0).fahrenheit(), -40.0);
        assert_eq!(Temperature::from_celsius(21.0).celsius(), 21.0);
    }

    #[test]
    fn differences_convert_without_the_offset() {
        // The whole reason this is a separate type.
        assert_eq!(TemperatureDelta(5.0).fahrenheit(), 9.0);
        assert_eq!(TemperatureDelta(0.0).fahrenheit(), 0.0);
        assert_eq!(TemperatureDelta(-10.0).fahrenheit(), -18.0);
    }

    #[test]
    fn subtracting_temperatures_produces_a_difference() {
        let warmer = Temperature::from_celsius(20.0);
        let colder = Temperature::from_celsius(15.0);

        // Converting the difference and differencing the conversions agree,
        // which is exactly what a single f64 would let you get wrong.
        assert_eq!((warmer - colder).fahrenheit(), 9.0);
        assert!(((warmer.fahrenheit() - colder.fahrenheit()) - 9.0).abs() < 1e-9);
    }

    #[test]
    fn speed_converts_and_subtracts() {
        let wind = Speed::from_meters_per_second(10.0);
        assert!((wind.miles_per_hour() - 22.369).abs() < 0.01);
        assert_eq!(wind.meters_per_second(), 10.0);

        let difference = Speed::from_meters_per_second(9.0) - Speed::from_meters_per_second(4.0);
        assert_eq!(difference.meters_per_second(), 5.0);
    }

    #[test]
    fn extremes_pick_the_right_end() {
        let cool = Temperature::from_celsius(3.0);
        let warm = Temperature::from_celsius(8.0);
        assert_eq!(cool.min(warm), cool);
        assert_eq!(cool.max(warm), warm);

        let breeze = Speed::from_meters_per_second(4.0);
        let gale = Speed::from_meters_per_second(11.0);
        assert_eq!(breeze.max(gale), gale);
    }

    #[test]
    fn rounding_is_to_whole_display_units() {
        assert_eq!(Temperature::from_celsius(17.6).round_fahrenheit(), 64);
        assert_eq!(TemperatureDelta(-2.4).round_fahrenheit(), -4);
        assert_eq!(
            Speed::from_meters_per_second(6.5).round_miles_per_hour(),
            15
        );
    }

    #[test]
    fn ordering_does_not_depend_on_the_display_unit() {
        assert!(Temperature::from_celsius(10.0) < Temperature::from_celsius(20.0));
        assert!(Speed::from_meters_per_second(3.0) < Speed::from_meters_per_second(30.0));
    }
}
