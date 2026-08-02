//! Saved locations, committed to the repo.
//!
//! There is no database on this box and no user accounts, so the shortcuts live
//! here. Anything not on this list is reached by search, and the browser
//! remembers the last one picked in `localStorage`.

/// A pinned place. Coordinates are a specific corner of the neighbourhood, not
/// a city centroid — in San Francisco those are different weather.
pub struct Location {
    /// URL-safe identifier used as `?loc=`.
    pub slug: &'static str,
    /// Short label for the shortcut row.
    pub name: &'static str,
    /// What the coordinates actually point at.
    pub detail: &'static str,
    pub latitude: f64,
    pub longitude: f64,
}

/// The shortcut row, in display order. The first entry is home.
pub static PINNED: [Location; 3] = [
    Location {
        slug: "inner-sunset",
        name: "Inner Sunset",
        detail: "Inner Sunset, San Francisco",
        latitude: 37.7601,
        longitude: -122.4661,
    },
    Location {
        slug: "fidi",
        name: "Financial District",
        detail: "Financial District, San Francisco",
        latitude: 37.7946,
        longitude: -122.3999,
    },
    Location {
        slug: "nyc",
        name: "New York City",
        detail: "Midtown Manhattan, New York",
        latitude: 40.7549,
        longitude: -73.984,
    },
];

/// The location shown when nothing else is asked for.
pub fn home() -> &'static Location {
    &PINNED[0]
}

/// Looks up a pinned location by its `?loc=` slug.
pub fn find(slug: &str) -> Option<&'static Location> {
    PINNED.iter().find(|location| location.slug == slug)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn home_is_the_inner_sunset() {
        assert_eq!(home().slug, "inner-sunset");
        assert_eq!(home().name, "Inner Sunset");
    }

    #[test]
    fn every_pin_is_findable_by_slug() {
        for location in &PINNED {
            assert_eq!(find(location.slug).map(|f| f.slug), Some(location.slug));
        }
        assert!(find("nowhere").is_none());
    }

    #[test]
    fn slugs_are_unique_and_url_safe() {
        let mut slugs: Vec<&str> = PINNED.iter().map(|location| location.slug).collect();
        slugs.sort_unstable();
        let count = slugs.len();
        slugs.dedup();
        assert_eq!(slugs.len(), count, "duplicate slug");

        for location in &PINNED {
            assert!(
                location
                    .slug
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'),
                "{} is not url-safe",
                location.slug
            );
        }
    }

    #[test]
    fn coordinates_are_plausible() {
        for location in &PINNED {
            assert!(
                (-90.0..=90.0).contains(&location.latitude),
                "{}",
                location.slug
            );
            assert!(
                (-180.0..=180.0).contains(&location.longitude),
                "{}",
                location.slug
            );
        }
    }

    #[test]
    fn the_two_sf_neighbourhoods_are_far_enough_apart_to_differ() {
        // Inner Sunset and the Financial District resolve to different model
        // grid cells; if these ever collapse onto one point the page would be
        // claiming a distinction the data cannot make.
        let sunset = find("inner-sunset").unwrap();
        let fidi = find("fidi").unwrap();
        let degrees = ((sunset.latitude - fidi.latitude).powi(2)
            + (sunset.longitude - fidi.longitude).powi(2))
        .sqrt();
        assert!(degrees > 0.03, "pins are only {degrees}° apart");
    }
}
