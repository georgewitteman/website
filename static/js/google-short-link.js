import { assert } from "./assert.js";

const formElement = document.getElementById("form");
const longUrlElement = document.getElementById("long_url");
const pasteUrlElement = document.getElementById("paste_url");
const pasteCopyUrlElement = document.getElementById("paste_copy_url");
const shortUrlElement = document.getElementById("short_url");

const copyShortUrl = document.getElementById("copy_short_url");

assert(formElement instanceof HTMLFormElement);
assert(longUrlElement instanceof HTMLInputElement);
assert(pasteUrlElement instanceof HTMLButtonElement);
assert(pasteCopyUrlElement instanceof HTMLButtonElement);
assert(shortUrlElement instanceof HTMLOutputElement);
assert(copyShortUrl instanceof HTMLButtonElement);

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

/**
 * @param {string} longUrl
 */
function getShortUrl(longUrl) {
  try {
    new URL(longUrl);
  } catch {
    return null;
  }
  const url = new URL(longUrl);
  const query = url.searchParams.get("q");
  if (!query) {
    return null;
  }

  const searchParams = new URLSearchParams([["q", query]]);
  return new URL(`https://google.com/search?${searchParams.toString()}`);
}

formElement.addEventListener("input", () => {
  if (!(longUrlElement instanceof HTMLInputElement)) {
    throw new Error("invaid type");
  }
  const shortUrl = getShortUrl(longUrlElement.value);
  if (!shortUrl) {
    shortUrlElement.innerText = "";
    copyShortUrl.style.display = "none";
    return;
  }
  const link = document.createElement("a");
  link.href = shortUrl.toString();
  link.innerText = shortUrl.toString();
  shortUrlElement.replaceChildren(link);
  copyShortUrl.style.display = "initial";
});

formElement.addEventListener("submit", function (e) {
  if (!(shortUrlElement instanceof HTMLOutputElement)) {
    throw new Error("invaid type");
  }
  navigator.clipboard.writeText(shortUrlElement.value);
  e.preventDefault();
});

copyShortUrl.addEventListener("click", function (e) {
  if (!(shortUrlElement instanceof HTMLOutputElement)) {
    throw new Error("invaid type");
  }
  navigator.clipboard.writeText(shortUrlElement.value);
  e.preventDefault();
});
