import { assert } from "./lib/assert.js";

const ASIN_REGEX = /\W([A-Z0-9]{10})/;
const AMAZON_URL = "https://amzn.com/dp/";
const AMAZON_LONG_URL = "https://www.amazon.com/dp/";

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
const shortishUrlElement = document.getElementById("shortish_url");

const copyShortUrl = document.getElementById("copy_short_url");
const copyShortishUrl = document.getElementById("copy_shortish_url");

assert(formElement instanceof HTMLFormElement);
assert(longUrlElement instanceof HTMLInputElement);
assert(pasteUrlElement instanceof HTMLButtonElement);
assert(pasteCopyUrlElement instanceof HTMLButtonElement);
assert(shortUrlElement instanceof HTMLOutputElement);
assert(shortishUrlElement instanceof HTMLOutputElement);
assert(copyShortUrl instanceof HTMLButtonElement);
assert(copyShortishUrl instanceof HTMLButtonElement);

copyShortUrl.style.display = "none";
copyShortishUrl.style.display = "none";

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

formElement.addEventListener("input", () => {
  if (!(longUrlElement instanceof HTMLInputElement)) {
    throw new Error("Invalid type");
  }
  const asin = getAsin(longUrlElement.value);
  if (!asin) {
    shortUrlElement.innerText = "";
    shortishUrlElement.innerText = "";
    copyShortUrl.style.display = "none";
    copyShortishUrl.style.display = "none";
    return;
  }
  const shortUrl = `${AMAZON_URL}${asin}`;
  const shortishUrl = `${AMAZON_LONG_URL}${asin}`;

  const shortLinkElement = document.createElement("a");
  shortLinkElement.setAttribute("href", shortUrl);
  shortLinkElement.innerText = shortUrl;

  const shortishUrlLink = document.createElement("a");
  shortishUrlLink.setAttribute("href", shortishUrl);
  shortishUrlLink.innerText = shortishUrl;

  shortUrlElement.replaceChildren(shortLinkElement);
  shortishUrlElement.replaceChildren(shortishUrlLink);

  copyShortUrl.style.display = "initial";
  copyShortishUrl.style.display = "initial";
});

formElement.addEventListener("submit", function (e) {
  const content = shortishUrlElement.textContent;
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

copyShortishUrl.addEventListener("click", (e) => {
  if (!(shortishUrlElement instanceof HTMLOutputElement)) {
    throw new Error("Invalid type");
  }
  navigator.clipboard.writeText(shortishUrlElement.value);
  e.preventDefault();
});
