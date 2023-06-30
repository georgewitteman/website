/**
 * TODO: Enable [flat config][1], waiting on typescript-eslint
 * - https://github.com/typescript-eslint/typescript-eslint/issues/5938
 * - https://github.com/typescript-eslint/typescript-eslint/issues/5908
 * - https://github.com/eslint/eslint/issues/13481
 * - https://github.com/typescript-eslint/typescript-eslint/pull/6836
 *
 * [1]: https://eslint.org/docs/latest/use/configure/configuration-files-new
 */

/** https://eslint.org/docs/latest/use/configure/configuration-files */
module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-floating-promises": "off",
  },
  overrides: [
    {
      files: ["static/**/*"],
      env: {
        browser: true,
      },
      parserOptions: {
        project: "static/tsconfig.json",
      },
    },
    {
      files: ["**/*"],
      excludedFiles: "static/**/*",
      env: {
        node: true,
      },
    },
    {
      files: ["*.test.js"],
      rules: {
        "@typescript-eslint/no-floating-promises": "off",
      },
    },
  ],
};
