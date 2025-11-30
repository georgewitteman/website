export function decodeQuotedPrintable(encodedString) {
  const normalized = encodedString.replace(/(\r\n|\n|\r)/g, "\n");
  // replace equals sign at end-of-line with nothing
  const normalizedWithNewlinesFixed = normalized.replace(/=\n/g, "");
  // Replace "=" followed by two hexadecimal characters with the corresponding ASCII character
  return normalizedWithNewlinesFixed.replace(/=([0-9A-F]{2})/g, (match, p1) =>
    String.fromCharCode(parseInt(p1, 16)),
  );
}

const form = document.getElementById("form");
const input = document.getElementById("input");
const outputCodeElement = document.querySelector("#output pre code");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const decoded = decodeQuotedPrintable(input.value);
  outputCodeElement.innerText = decoded;
});
