/**
 * TODO: Enable [flat config][1], waiting on typescript-eslint
 * - https://github.com/typescript-eslint/typescript-eslint/issues/5938
 * - https://github.com/typescript-eslint/typescript-eslint/issues/5908
 * - https://github.com/eslint/eslint/issues/13481
 * - https://github.com/typescript-eslint/typescript-eslint/pull/6836
 *
 * [1]: https://eslint.org/docs/latest/use/configure/configuration-files-new
 */

module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {},
  overrides: [
    {
      files: ["static/**/*"],
      env: {
        browser: true,
      },
    },
    {
      files: ["**/*"],
      excludedFiles: "static/**/*",
      env: {
        node: true,
      },
    },
  ],
};
