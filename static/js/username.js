const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
const default_length = 8;
function generate(length) {
  let result = "";
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const formElement = document.getElementById("form");
const lengthInputElement = document.getElementById("length");
const outputElement = document.getElementById("username");
const copyButton = document.getElementById("copy_username");

/**
 * @param {Event} e
 */
const handleFormInput = (e) => {
  e.preventDefault();
  if (!(lengthInputElement instanceof HTMLInputElement)) {
    throw new Error("invalid type");
  }
  let length = parseInt(lengthInputElement.value, 10);
  if (isNaN(length) || length < 1) {
    length = default_length;
  }
  const username = generate(length);
  outputElement.value = username;
};

formElement.addEventListener("submit", handleFormInput);
formElement.addEventListener("input", handleFormInput);
handleFormInput(new Event("submit", {}));

copyButton.addEventListener("click", (e) => {
  e.preventDefault();
  if (!(outputElement instanceof HTMLOutputElement)) {
    throw new Error("invalid type");
  }
  const username = outputElement.value;
  navigator.clipboard.writeText(username);
});
