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
//! Spacing is uneven because the clothing is. Each temperature is solved, not
//! chosen: it is the felt temperature at which that point's outfit produces the
//! sensation the point claims, under PMV at a moderate walk. So the rungs come
//! out as far apart as the garments between them are warm — three degrees
//! between a t-shirt and a long-sleeve one, twenty between a winter coat and a
//! heavy one — and the ends stretch wide because clothing has stopped being the
//! variable.
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
//!
//! # Where the temperatures come from
//!
//! Not from taste. Each outfit is priced in ASHRAE 55 garment insulation, and
//! the temperature is then solved so that Fanger's PMV returns the sensation
//! the point claims, for a walker at 2.4 met in a light breeze:
//!
//! ```text
//!   9  shorts and a light t-shirt        +2.2  warm, barely bearable    94F
//!   8  shorts and a t-shirt               0.0  comfortable              78F
//!   7  jeans and a t-shirt                0.0  comfortable              73F
//!   6  jeans and a long-sleeve t-shirt    0.0  comfortable              70F
//!   5  jeans and a light jacket           0.0  comfortable              61F
//!   4  jeans and a warm jacket            0.0  comfortable              53F
//!   3  coat                               0.0  comfortable              46F
//!   2  winter coat                        0.0  comfortable              37F
//!   1  heavy winter coat, hat and gloves -0.5  slightly cool            16F
//! ```
//!
//! Only 9 is deliberately uncomfortable, because that is the one end clothing
//! cannot rescue: below a t-shirt there is nothing left to take off. The cold
//! end can always be dressed for, so it is solved to comfortable and only the
//! last rung is allowed to bite.
//!
//! 8 carries a second constraint that the solve satisfies without being asked:
//! at 78°F shorts come out at 0.00 and jeans at +0.57, comfortable and slightly
//! warm respectively, which is what that point is supposed to mean.
//!
//! Two sensitivities worth knowing. The anchors encode a pace as well as a
//! preference — at a brisk 2.9 met the whole scale reads about half a point
//! warm, at a stroll half a point cool. And PMV is known to overstate warmth
//! above roughly 2 met (Humphreys & Nicol, 2002), which is the direction that
//! matters most at 9.

use crate::units::Temperature;
use std::fmt;

/// `(felt °F, score)`, ascending. Interpolated between, clamped outside.
const ANCHORS: [(f64, f64); 11] = [
    (-34.0, 0.0),
    (16.0, 1.0),
    (37.0, 2.0),
    (46.0, 3.0),
    (53.0, 4.0),
    (61.0, 5.0),
    (70.0, 6.0),
    (73.0, 7.0),
    (78.0, 8.0),
    (94.0, 9.0),
    (105.0, 10.0),
];

/// `(what it feels like, what to wear)` for each whole point.
///
/// The second half is the point of the scale: one number, one outfit, no
/// hedging about what you might get away with. Deciding whether to accommodate
/// more than one of these is what the three numbers at the top of the page are
/// for — a single score should never have to say "or".
///
/// Every sensation word appears exactly once and every outfit differs from its
/// neighbours', so both halves identify the point on their own. Read bottom to
/// top it is a ladder of insulation, roughly even in `clo` per step, which is
/// why the temperatures below are unevenly spaced: adding a jacket buys more
/// degrees than swapping a t-shirt for a long-sleeve shirt.
const LABELS: [(&str, &str, Option<&str>); 11] = [
    ("dangerous cold", "avoid outdoors", None),
    (
        "brutal",
        "heavy winter coat, hat and gloves",
        Some("a heavy winter coat, hat and gloves"),
    ),
    ("freezing", "winter coat", Some("a winter coat")),
    ("cold", "coat", Some("a coat")),
    ("chilly", "jeans and a warm jacket", Some("a warm jacket")),
    (
        "neutral",
        "jeans and a light jacket",
        Some("a light jacket"),
    ),
    (
        "mild",
        "jeans and a long-sleeve t-shirt",
        Some("a long-sleeve t-shirt"),
    ),
    // From here up there is nothing left to carry: swapping jeans for shorts
    // is not something anyone does halfway through a walk.
    ("pleasant", "jeans and a t-shirt", None),
    ("warm", "shorts and a t-shirt", None),
    ("hot", "shorts and a light t-shirt", None),
    ("dangerous heat", "avoid outdoors", None),
];

/// A point on the comfort scale, 0 through 10.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct Score(f64);

impl Score {
    /// Only for arithmetic on an existing score, such as stepping down a rung.
    /// Felt temperatures come in through [`score`].
    pub fn from_value(points: f64) -> Self {
        Score(points.clamp(0.0, 10.0))
    }

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

    /// The item this point adds over the one above it — what you would carry to
    /// be ready for it, rather than wear the whole time.
    ///
    /// `None` from 8 up: at a t-shirt there is nothing left to take off, so a
    /// warmer point cannot be reached by carrying something.
    pub fn layer(self) -> Option<&'static str> {
        LABELS[self.level() as usize].2
    }

    /// Both together, for a caption that has room for them.
    pub fn label(self) -> String {
        format!("{} \u{2014} {}", self.word(), self.advice())
    }

    /// The nearest whole point, which is also the colour band this score sits
    /// in. The page prints the number beside the colour everywhere, so the
    /// colour never carries meaning on its own.
    ///
    /// Derived from the digit actually printed rather than from the underlying
    /// float, so a chip can never read 4.5 while wearing the colour of 4.
    /// Rounding the value separately is not enough: at an exact `.x5` the
    /// formatter and `round` disagree, because the decimal is not representable
    /// and each breaks the tie its own way.
    pub fn level(self) -> u8 {
        let printed: f64 = self.to_string().parse().unwrap_or(self.0);
        printed.round().clamp(0.0, 10.0) as u8
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
            let (word, advice, _) = LABELS[level];
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
        assert_eq!(at(61.0).word(), "neutral");
        assert_eq!(at(61.0).advice(), "jeans and a light jacket");
        assert_eq!(format!("{}", at(61.0)), "5.0");
    }

    #[test]
    fn interpolates_between_anchors() {
        // Halfway from 53°F (4) to 61°F (5).
        assert!((at(57.0).value() - 4.5).abs() < 1e-9);
        // A fifth of the way from 73°F (7) to 78°F (8).
        assert!((at(74.0).value() - 7.2).abs() < 0.001);
    }

    #[test]
    fn clamps_outside_the_scale_instead_of_running_off_it() {
        assert_eq!(at(-70.0).value(), 0.0);
        assert_eq!(at(-34.0).value(), 0.0);
        assert_eq!(at(130.0).value(), 10.0);
        assert_eq!(at(105.0).value(), 10.0);
    }

    #[test]
    fn the_ends_mean_do_not_go_outside() {
        // An Alaskan midwinter afternoon and a clear Singapore summer day.
        assert!(at(-34.0).value() <= 0.2, "{}", at(-34.0));
        assert!(at(108.0).value() >= 9.8, "{}", at(108.0));

        // And an ordinary hot day is emphatically not one of those.
        let shorts_weather = at(94.0);
        assert!(
            (8.5..9.5).contains(&shorts_weather.value()),
            "94°F scored {shorts_weather}, which should be shorts, not danger"
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
        let mild = at(78.0).value() - at(71.0).value();
        let frigid = at(16.0).value() - at(9.0).value();
        let scorching = at(105.0).value() - at(98.0).value();
        assert!(mild > frigid * 2.0, "mild {mild} vs frigid {frigid}");
        assert!(mild > scorching * 2.0, "mild {mild} vs hot {scorching}");
    }

    #[test]
    fn labels_describe_what_to_wear_at_each_point() {
        assert_eq!(at(16.0).word(), "brutal");
        assert_eq!(at(53.0).advice(), "jeans and a warm jacket");
        assert_eq!(at(70.0).advice(), "jeans and a long-sleeve t-shirt");
        assert_eq!(at(94.0).word(), "hot");
        assert_eq!(at(105.0).advice(), "avoid outdoors");
        assert_eq!(at(94.0).label(), "hot \u{2014} shorts and a light t-shirt");
    }

    #[test]
    fn no_two_points_read_the_same() {
        // If a word or a garment line repeats, the extra resolution is fake:
        // the reader cannot tell which point they are looking at from the text.
        let words: std::collections::HashSet<&str> =
            LABELS.iter().map(|(word, _, _)| *word).collect();
        assert_eq!(words.len(), LABELS.len(), "a sensation word repeats");

        // The two ends share "don't go out" by design; everything between is
        // a distinct instruction.
        let middle: std::collections::HashSet<&str> =
            LABELS[1..10].iter().map(|(_, advice, _)| *advice).collect();
        assert_eq!(middle.len(), 9, "a garment line repeats");
    }

    #[test]
    fn labels_snap_to_the_nearest_whole_point() {
        assert_eq!(at(62.0).word(), at(61.0).word());
        // 65.5°F sits midway between 5 and 6 and rounds up.
        assert_eq!(at(66.0).word(), at(70.0).word());
    }

    #[test]
    fn always_renders_with_one_decimal() {
        assert_eq!(format!("{}", at(61.0)), "5.0");
        assert_eq!(format!("{}", at(57.0)), "4.5");
        assert_eq!(format!("{}", at(-34.0)), "0.0");
        assert_eq!(format!("{}", at(120.0)), "10.0");
    }

    #[test]
    fn the_colour_band_always_matches_the_number_printed_on_it() {
        // 4.45 prints as "4.5", so it must wear 5's colour, not 4's.
        for tenth in -400..1400 {
            let scored = Score(f64::from(tenth) / 100.0);
            let printed: f64 = scored.to_string().parse().unwrap();
            assert_eq!(
                u32::from(scored.level()),
                printed.round().clamp(0.0, 10.0) as u32,
                "{scored} sits in band {}",
                scored.level()
            );
        }
    }

    #[test]
    fn the_level_is_the_nearest_whole_point() {
        assert_eq!(at(61.0).level(), 5);
        assert_eq!(at(57.0).level(), 5); // exactly 4.5, rounds away from zero
        assert_eq!(at(-50.0).level(), 0);
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
            assert_eq!((*word, *advice), (LABELS[index].0, LABELS[index].1));
            // The temperature shown beside each point is a felt temperature,
            // and must be one that actually lands on that point.
            assert_eq!(at(f64::from(*degrees)).level(), *level);
        }
    }

    #[test]
    fn a_layer_is_something_you_could_carry() {
        // Below a t-shirt every point is reachable by adding an outer layer.
        for degrees in [16.0, 37.0, 46.0, 53.0, 61.0, 70.0] {
            assert!(at(degrees).layer().is_some(), "{degrees}F has no layer");
        }
        assert_eq!(at(53.0).layer(), Some("a warm jacket"));

        // Above it there is nothing left to take off, so nothing to carry.
        for degrees in [73.0, 78.0, 94.0, 105.0] {
            assert_eq!(at(degrees).layer(), None, "{degrees}F offered a layer");
        }
    }

    #[test]
    fn extremes_pick_the_right_end() {
        let cool = at(53.0);
        let warm = at(78.0);
        assert_eq!(cool.min(warm), cool);
        assert_eq!(cool.max(warm), warm);
    }
}
