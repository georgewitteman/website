import { getAsin, AMAZON_LONG_URL } from "./lib/amazon-short-links.js";
const formElement = document.getElementById("form");
const longUrlElement = document.getElementById("long_url");
const pasteUrlElement = document.getElementById("paste_url");
const pasteCopyUrlElement = document.getElementById("paste_copy_url");
const shortUrlElement = document.getElementById("short_url");

const copyShortUrl = document.getElementById("copy_short_url");

copyShortUrl.style.display = "none";

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

const UNNECESSARY_QUERY_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_content",
  "fbclid",
  "campaign_id",
  "ad_id",
]

function cleanUrl(url) {
  const asin = getAsin(url.href);
  if (asin) {
    return `${AMAZON_LONG_URL}${asin}`;
  }
  UNNECESSARY_QUERY_PARAMS.forEach((name) => {
    url.searchParams.delete(name);
  })
  return url.href;
}

function safeUrlParse(input) {
  try {
    return new URL(input)
  } catch {
    return undefined;
  }
}

formElement.addEventListener("input", () => {
  if (!(longUrlElement instanceof HTMLInputElement)) {
    throw new Error("Invalid type");
  }
  const url = safeUrlParse(longUrlElement.value);
  if (!url) {
    shortUrlElement.innerText = "";
    copyShortUrl.style.display = "none";
    return;
  }

  const shortUrl = cleanUrl(url)

  const shortLinkElement = document.createElement("a");
  shortLinkElement.setAttribute("href", shortUrl);
  shortLinkElement.innerText = shortUrl;

  shortUrlElement.replaceChildren(shortLinkElement);

  copyShortUrl.style.display = "initial";
});

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
