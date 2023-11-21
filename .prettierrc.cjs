/**
 * https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */

const config = {
  trailingComma: "all",
  htmlWhitespaceSensitivity: "strict",
  plugins: ["prettier-plugin-tailwindcss"],
};

module.exports = config;
