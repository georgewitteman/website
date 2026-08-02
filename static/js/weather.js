/**
 * Remembers which location the weather page should open on.
 *
 * The page itself is fully server-rendered; this only handles the one piece of
 * state that belongs to the browser rather than the repo. There is no database
 * behind this site, so the committed home location in `src/locations.rs` is the
 * default and `localStorage` holds any personal override.
 *
 * Loaded synchronously in `<head>` on purpose: a bare `/weather` visit with a
 * saved override redirects before the body paints, so there is no flash of the
 * wrong city.
 */

const STORAGE_KEY = "weather:default";

/**
 * localStorage throws in Safari private browsing rather than returning null,
 * and a weather page is not worth an exception.
 * @returns {string | null}
 */
function savedDefault() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string | null} value
 */
function saveDefault(value) {
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Only query strings this page itself generates are ever followed, so a value
 * planted in storage cannot redirect anywhere but back into /weather.
 * @param {string} param
 */
function isSafeParam(param) {
  return /^(loc=[a-z0-9-]+|lat=-?\d+(\.\d+)?&lon=-?\d+(\.\d+)?&name=[^&#/\\]*)$/.test(
    param,
  );
}

// Redirect before anything renders. `replace` keeps the bare URL out of the
// back-button history, so Back still leaves the site.
if (window.location.pathname === "/weather" && window.location.search === "") {
  const saved = savedDefault();
  if (saved && isSafeParam(saved)) {
    window.location.replace(`/weather?${saved}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("weather-set-default");
  const note = document.getElementById("weather-default-note");
  if (
    !(button instanceof HTMLButtonElement) ||
    !(note instanceof HTMLElement)
  ) {
    return;
  }

  const param = button.dataset.param ?? "";
  if (!isSafeParam(param)) {
    return;
  }

  /**
   * @param {string} message
   */
  function showNote(message) {
    note.textContent = message;
    note.hidden = message === "";
  }

  function render() {
    const saved = savedDefault();
    if (saved === param) {
      button.textContent = "Clear default";
      showNote("This page opens here.");
    } else {
      button.textContent = "Open here by default";
      showNote(saved ? "Another location is your default." : "");
    }
  }

  // Hidden until now so the control never appears without its behaviour.
  button.hidden = false;
  render();

  button.addEventListener("click", () => {
    const clearing = savedDefault() === param;
    if (saveDefault(clearing ? null : param)) {
      render();
    } else {
      showNote("This browser is not saving settings.");
    }
  });
});
