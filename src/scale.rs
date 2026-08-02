//! A personal 0-10 comfort scale.
//!
//! Degrees are a physical measurement, not a decision. 58°F means nothing on
//! its own — it means something once you know it is a light-jacket day. This
//! maps felt temperature onto one calibrated number so the page leads with the
//! answer rather than the measurement.
//!
//! The calibration is deliberately personal, not a published index: 5 is
//! neutral — neither cold nor warm, which for this site's owner is also the
//! weather they like best — and every other point is described relative to
//! that. It is committed to the repo for the same reason the home location is:
//! there is nowhere else to put it.
//!
//! Spacing is uneven on purpose. Six degrees to a point through the mild band,
//! where a couple of degrees genuinely changes what goes on; twenty or more at
//! the ends, where everything is just "very cold" or "very hot" and the extra
//! resolution would be false precision.
//!
//! The ends are anchored on being unable to go out at all, not merely on being
//! uncomfortable: 0 is an Alaskan midwinter afternoon, windy and sunless, and
//! 10 is Singapore in the summer under a clear sky. A day that merely wants
//! shorts is a 9, not a 10.
//!
//! # Prior art
//!
//! The shape is not novel, which is reassuring. The ASHRAE 55 / ISO 7730
//! thermal sensation scale is the same idea: a bounded ordinal scale running
//! cold to hot with comfortable in the middle, at seven points from -3 to +3.
//! This is that scale stretched to eleven and shifted so the neutral point is
//! 5. Fanger's Predicted Mean Vote is the model that puts a population on it,
//! and UTCI and PET both bin their output into named stress or perception
//! bands the same way.
//!
//! Two things here are deliberately different. Those indices predict the
//! average vote of a large group at a stated clothing and activity level; this
//! is calibrated to one person, which is the whole point of a personal site.
//! And their bands are evenly spaced in degrees, where these are not — see the
//! spacing note above.
//!
//! The presentation owes more to the UV Index: a small bounded number with a
//! colour per point and an action attached to each.

use crate::units::Temperature;
use std::fmt;

/// `(felt °F, score)`, ascending. Interpolated between, clamped outside.
const ANCHORS: [(f64, f64); 11] = [
    (-25.0, 0.0),
    (10.0, 1.0),
    (33.0, 2.0),
    (45.0, 3.0),
    (54.0, 4.0),
    (60.0, 5.0),
    (66.0, 6.0),
    (72.0, 7.0),
    (78.0, 8.0),
    (88.0, 9.0),
    (110.0, 10.0),
];

/// `(what it feels like, what to wear)` for each whole point.
///
/// Every sensation word appears exactly once, so the word alone identifies the
/// point, and every garment line differs from its neighbours' — otherwise two
/// adjacent scores give the same instruction and the resolution is fictional.
const LABELS: [(&str, &str); 11] = [
    ("dangerous cold", "don't go out"),
    ("brutal", "heavy coat, hat and gloves"),
    ("freezing", "winter coat over warm layers"),
    ("cold", "proper jacket, long sleeves"),
    ("chilly", "light jacket, staying on"),
    ("neutral", "light jacket"),
    ("mild", "light jacket you'll take off"),
    ("pleasant", "t-shirt and jeans"),
    ("warm", "t-shirt, shorts if you like"),
    ("hot", "shorts and a t-shirt, find shade"),
    ("dangerous heat", "don't go out"),
];

/// A point on the comfort scale, 0 through 10.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct Score(f64);

impl Score {
    pub fn value(self) -> f64 {
        self.0
    }

    /// What the nearest whole point feels like, in one word.
    pub fn word(self) -> &'static str {
        LABELS[self.level() as usize].0
    }

    /// What to wear at the nearest whole point.
    pub fn advice(self) -> &'static str {
        LABELS[self.level() as usize].1
    }

    /// Both together, for a caption that has room for them.
    pub fn label(self) -> String {
        format!("{} \u{2014} {}", self.word(), self.advice())
    }

    /// The nearest whole point, which is also the colour band this score sits
    /// in. The page prints the number beside the colour everywhere, so the
    /// colour never carries meaning on its own.
    pub fn level(self) -> u8 {
        self.0.round().clamp(0.0, 10.0) as u8
    }

    pub fn min(self, other: Self) -> Self {
        Score(self.0.min(other.0))
    }

    pub fn max(self, other: Self) -> Self {
        Score(self.0.max(other.0))
    }
}

/// One decimal, always — `5` and `5.0` should not both appear on the page.
impl fmt::Display for Score {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:.1}", self.0)
    }
}

/// The whole scale, for the key printed on the page. Without it the colours
/// and the numbers are both undecodable.
///
/// Hottest first, the way a thermometer is drawn.
pub fn key() -> Vec<(u8, &'static str, &'static str, i32)> {
    ANCHORS
        .iter()
        .enumerate()
        .rev()
        .map(|(level, (degrees, _))| {
            let (word, advice) = LABELS[level];
            (level as u8, word, advice, *degrees as i32)
        })
        .collect()
}

/// Places a felt temperature on the scale.
pub fn score(felt: Temperature) -> Score {
    let degrees = felt.fahrenheit();

    let (mut low_f, mut low_score) = ANCHORS[0];
    if degrees <= low_f {
        return Score(low_score);
    }

    for (high_f, high_score) in ANCHORS.into_iter().skip(1) {
        if degrees <= high_f {
            let position = (degrees - low_f) / (high_f - low_f);
            return Score(low_score + position * (high_score - low_score));
        }
        (low_f, low_score) = (high_f, high_score);
    }

    Score(10.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(fahrenheit: f64) -> Score {
        score(Temperature::from_celsius((fahrenheit - 32.0) * 5.0 / 9.0))
    }

    #[test]
    fn every_anchor_lands_on_its_whole_number() {
        for (degrees, expected) in ANCHORS {
            let scored = at(degrees).value();
            assert!(
                (scored - expected).abs() < 1e-9,
                "{degrees}°F scored {scored}, expected {expected}"
            );
        }
    }

    #[test]
    fn five_is_the_weather_this_site_is_calibrated_for() {
        assert_eq!(at(60.0).word(), "neutral");
        assert_eq!(at(60.0).advice(), "light jacket");
        assert_eq!(format!("{}", at(60.0)), "5.0");
    }

    #[test]
    fn interpolates_between_anchors() {
        // Halfway from 54°F (4) to 60°F (5).
        assert!((at(57.0).value() - 4.5).abs() < 1e-9);
        // A third of the way from 72°F (7) to 78°F (8).
        assert!((at(74.0).value() - 7.333).abs() < 0.001);
    }

    #[test]
    fn clamps_outside_the_scale_instead_of_running_off_it() {
        assert_eq!(at(-60.0).value(), 0.0);
        assert_eq!(at(-25.0).value(), 0.0);
        assert_eq!(at(130.0).value(), 10.0);
        assert_eq!(at(110.0).value(), 10.0);
    }

    #[test]
    fn the_ends_mean_do_not_go_outside() {
        // An Alaskan midwinter afternoon and a clear Singapore summer day.
        assert!(at(-25.0).value() <= 0.2, "{}", at(-25.0));
        assert!(at(108.0).value() >= 9.8, "{}", at(108.0));

        // And an ordinary hot day is emphatically not one of those.
        let shorts_weather = at(88.0);
        assert!(
            (8.5..9.5).contains(&shorts_weather.value()),
            "88°F scored {shorts_weather}, which should be shorts, not danger"
        );
    }

    #[test]
    fn rises_monotonically_across_the_whole_range() {
        let mut previous = at(-20.0).value();
        for degrees in -20..130 {
            let current = at(f64::from(degrees)).value();
            assert!(current >= previous, "dipped at {degrees}°F");
            previous = current;
        }
    }

    #[test]
    fn the_mild_band_has_the_finest_resolution() {
        // A page for deciding on a layer needs to separate 58° from 64°.
        let mild = at(66.0).value() - at(60.0).value();
        let frigid = at(10.0).value() - at(4.0).value();
        let scorching = at(104.0).value() - at(98.0).value();
        assert!(mild > frigid * 2.0, "mild {mild} vs frigid {frigid}");
        assert!(mild > scorching * 2.0, "mild {mild} vs hot {scorching}");
    }

    #[test]
    fn labels_describe_what_to_wear_at_each_point() {
        assert_eq!(at(10.0).word(), "brutal");
        assert_eq!(at(54.0).advice(), "light jacket, staying on");
        assert_eq!(at(72.0).advice(), "t-shirt and jeans");
        assert_eq!(at(88.0).word(), "hot");
        assert_eq!(at(110.0).advice(), "don't go out");
        assert_eq!(
            at(88.0).label(),
            "hot \u{2014} shorts and a t-shirt, find shade"
        );
    }

    #[test]
    fn no_two_points_read_the_same() {
        // If a word or a garment line repeats, the extra resolution is fake:
        // the reader cannot tell which point they are looking at from the text.
        let words: std::collections::HashSet<&str> = LABELS.iter().map(|(word, _)| *word).collect();
        assert_eq!(words.len(), LABELS.len(), "a sensation word repeats");

        // The two ends share "don't go out" by design; everything between is
        // a distinct instruction.
        let middle: std::collections::HashSet<&str> =
            LABELS[1..10].iter().map(|(_, advice)| *advice).collect();
        assert_eq!(middle.len(), 9, "a garment line repeats");
    }

    #[test]
    fn labels_snap_to_the_nearest_whole_point() {
        assert_eq!(at(61.0).word(), at(60.0).word());
        // 63°F sits midway between 5 and 6 and rounds up.
        assert_eq!(at(64.0).word(), at(66.0).word());
    }

    #[test]
    fn always_renders_with_one_decimal() {
        assert_eq!(format!("{}", at(60.0)), "5.0");
        assert_eq!(format!("{}", at(57.0)), "4.5");
        assert_eq!(format!("{}", at(-25.0)), "0.0");
        assert_eq!(format!("{}", at(120.0)), "10.0");
    }

    #[test]
    fn the_level_is_the_nearest_whole_point() {
        assert_eq!(at(60.0).level(), 5);
        assert_eq!(at(57.0).level(), 5); // 4.5 rounds up
        assert_eq!(at(-40.0).level(), 0);
        assert_eq!(at(130.0).level(), 10);
        for degrees in -20..130 {
            assert!(at(f64::from(degrees)).level() <= 10);
        }
    }

    #[test]
    fn the_key_covers_every_point_in_order() {
        let key = key();
        assert_eq!(key.len(), 11);
        // Hottest first: 10 at the top of the list, 0 at the bottom.
        assert_eq!(key[0].0, 10);
        assert_eq!(key[10].0, 0);
        for (position, (level, word, advice, degrees)) in key.iter().enumerate() {
            let index = 10 - position;
            assert_eq!(usize::from(*level), index);
            assert_eq!((*word, *advice), LABELS[index]);
            // The temperature shown beside each point is a felt temperature,
            // and must be one that actually lands on that point.
            assert_eq!(at(f64::from(*degrees)).level(), *level);
        }
    }

    #[test]
    fn extremes_pick_the_right_end() {
        let cool = at(54.0);
        let warm = at(78.0);
        assert_eq!(cool.min(warm), cool);
        assert_eq!(cool.max(warm), warm);
    }
}
