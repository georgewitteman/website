const AMAZON_URL = "https://amzn.com/dp/";
const AMAZON_LONG_URL = "https://www.amazon.com/dp/";
const ASIN_REGEX = /\/([A-Z0-9]{10})/;

/**
 * @param {string} longUrl
 * @returns
 */
function getAsin(longUrl) {
  let asin = longUrl.match(ASIN_REGEX);
  if (!asin || asin.length < 1) {
    return null;
  }
  return asin[1];
}

const formElement = document.getElementById("form");
const longUrlElement = document.getElementById("long_url");
const pasteUrlElement = document.getElementById("paste_url");
const pasteCopyUrlElement = document.getElementById("paste_copy_url");
const shortUrlElement = document.getElementById("short_url");

const copyShortUrl = document.getElementById("copy_short_url");

copyShortUrl.classList.add("hidden");

pasteUrlElement.addEventListener("click", () => {
  navigator.clipboard.readText().then((longUrl) => {
    longUrlElement.value = longUrl;
    longUrlElement.dispatchEvent(
      new Event("input", {
        bubbles: true,
        cancelable: true,
      }),
    );
    longUrlElement.focus();
    if (longUrlElement instanceof HTMLInputElement) {
      longUrlElement.select();
    }
  });
});

pasteCopyUrlElement.addEventListener("click", () => {
  navigator.clipboard.readText().then((longUrl) => {
    longUrlElement.value = longUrl;
    longUrlElement.dispatchEvent(
      new Event("input", {
        bubbles: true,
        cancelable: true,
      }),
    );
    formElement.dispatchEvent(
      new Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
  });
});

/**
 * @param {URL} url
 */
function cleanGoogleSearchUrl(url) {
  if (url.hostname !== "www.google.com" || url.pathname !== "/search") {
    return undefined;
  }
  const query = url.searchParams.get("q");
  if (!query) {
    return undefined;
  }

  const searchParams = new URLSearchParams([["q", query]]);
  return new URL(`https://google.com/search?${searchParams.toString()}`);
}

// https://github.com/jparise/chrome-utm-stripper
// https://github.com/AdguardTeam/AdguardFilters/tree/master/TrackParamFilter/sections
// https://github.com/brave/brave-core/blob/master/components/query_filter/utils.cc
// https://github.com/mpchadwick/tracking-query-params-registry/blob/master/_data/params.csv
const UNNECESSARY_QUERY_PARAMS = [
  /^ScCid$/,
  /^_branch_match_id$/,
  /^_bta_c$/,
  /^_bta_tid$/,
  /^_ga$/,
  /^_gl$/,
  /^_ke$/,
  /^_kx$/,
  /^ad_id$/,
  /^campaign_id$/,
  /^campid$/,
  /^customid$/,
  /^dclid$/,
  /^dm_i$/,
  /^ef_id$/,
  /^epik$/,
  /^fbclid$/,
  /^gad_source$/,
  /^gbraid$/,
  /^gcl/, // Matches gclid and gclsrc
  /^gdffi$/,
  /^gdfms$/,
  /^gdftrk$/,
  /^hsa_/,
  /^igsh$/, // Instagram
  /^igshid$/, // Instagram
  /^irclickid$/,
  /^matomo_/,
  /^mc_cid$/,
  /^mc_eid$/,
  /^mkcid$/,
  /^mkevt$/,
  /^mkrid$/,
  /^mkwid$/,
  /^msclkid$/,
  /^mtm_/,
  /^ndclid$/,
  /^pcrid$/,
  /^piwik_/,
  /^pk_campaign$/,
  /^pk_keyword$/,
  /^pk_kwd$/,
  /^redirect_log_mongo_id$/,
  /^redirect_mongo_id$/,
  /^rtid$/,
  /^s_kwcid$/,
  /^sb_referer_host$/,
  /^si$/,
  /^sms_click$/,
  /^sms_source$/,
  /^sms_uph$/,
  /^srsltid$/,
  /^toolid$/,
  /^trk_/,
  /^ttclid$/,
  /^tw_/,
  /^twclid$/,
  /^utm_/,
  /^vmcid$/,
  /^wbraid$/,
  /^yclid$/,
];

/**
 * @param {URL} url
 */
function cleanUrl(url) {
  const asin = getAsin(url.href);
  if (asin) {
    return `${AMAZON_LONG_URL}${asin}`;
  }
  const googleUrl = cleanGoogleSearchUrl(url);
  if (googleUrl) {
    return googleUrl;
  }
  // We can't iterate directly over url.searchParams.keys() while deleting because modifying the
  // URLSearchParams object during iteration would invalidate the iterator. To avoid this, we
  // create a static copy of the keys first.
  for (const key of [...url.searchParams.keys()]) {
    if (UNNECESSARY_QUERY_PARAMS.some((regexp) => regexp.test(key))) {
      url.searchParams.delete(key);
    }
  }

  // Removing the trailing slash is usually safe, but some servers, APIs, or routers may treat
  // `/path/` and `/path` differently.
  if (url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  // url.href will include the / if it's the root path, but we want to remove it
  if (url.pathname === "/") {
    return `${url.origin}${url.search}${url.hash}`;
  }

  return url.href;
}

/**
 * @param {string} input
 */
function safeUrlParse(input) {
  try {
    return new URL(input);
  } catch {
    return undefined;
  }
}

function onInput() {
  if (!(longUrlElement instanceof HTMLInputElement)) {
    throw new Error("Invalid type");
  }
  const url = safeUrlParse(longUrlElement.value);
  if (!url) {
    shortUrlElement.innerText = "";
    copyShortUrl.classList.add("hidden");
    return;
  }

  const shortUrl = cleanUrl(url);

  // Validate shortUrl scheme before embedding
  if (!/^https?:\/\//.test(shortUrl)) {
    // Invalid or dangerous scheme - don't show a link.
    shortUrlElement.innerText = "";
    copyShortUrl.classList.add("hidden");
    return;
  }

  const shortLinkElement = document.createElement("a");
  shortLinkElement.setAttribute("href", shortUrl);
  shortLinkElement.setAttribute("target", "_blank");
  shortLinkElement.innerText = shortUrl;

  shortUrlElement.replaceChildren(shortLinkElement);

  copyShortUrl.classList.remove("hidden");
}

formElement.addEventListener("input", onInput);
// In case somehow there ends up being content on the initial load
onInput();

formElement.addEventListener("submit", function (e) {
  const content = shortUrlElement.textContent;
  if (typeof content === "string") {
    navigator.clipboard.writeText(content);
  }
  e.preventDefault();
});

copyShortUrl.addEventListener("click", (e) => {
  if (!(shortUrlElement instanceof HTMLOutputElement)) {
    throw new Error("Invalid type");
  }
  navigator.clipboard.writeText(shortUrlElement.value);
  e.preventDefault();
});
