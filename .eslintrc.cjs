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
  "root": true,
  "extends": [
    "eslint:recommended"
  ],
  "overrides": [
    {
      "files": ["static/**/*.js"],
      "env": {
        "browser": true,
      }
    },
    {
      "files": ["*.js", "*.cjs", "*.mjs"],
      "env": {
        "node": true,
        "es2021": true
      },
      "extends": ["plugin:@typescript-eslint/recommended"],
      "parser": "@typescript-eslint/parser",
      "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
      },
      "plugins": [
        "@typescript-eslint"
      ],
      "rules": {
      }
    }
  ],

}
