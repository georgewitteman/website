/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/default-src
 * @typedef {{"default-src": "'none'"}} DefaultSrcDirective
 */

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/require-trusted-types-for
 * @typedef {{"require-trusted-types-for": "'script'"}} RequireTrustedTypesForDirective
 */

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src
 * @typedef {{"style-src": "'self'"}} StyleSrcDirective
 */

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src
 * @typedef {{"script-src": `'nonce-${string}'`}} ScriptSrcDirective
 */

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/base-uri
 * @typedef {{"base-uri": "'self'" | "'none'"}} BaseUriDirective
 */

/**
 * https://content-security-policy.com/#directive
 * @typedef {Partial<DefaultSrcDirective & RequireTrustedTypesForDirective & StyleSrcDirective & ScriptSrcDirective & BaseUriDirective>} Directives
 */

/**
 * - https://content-security-policy.com
 * - https://csp-evaluator.withgoogle.com
 * - https://web.dev/strict-csp/#adopting-a-strict-csp
 */
export class ContentSecurityPolicy {
  /**
   * @type {string | undefined}
   */
  #nonce;

  constructor() {
    /** @type {Directives} */
    this.directives = {
      "default-src": "'none'",
      "style-src": "'self'",
      "require-trusted-types-for": "'script'",
      "base-uri": "'none'",
    };
  }

  /**
   * @param {string} newNonce
   */
  set nonce(newNonce) {
    this.#nonce = newNonce;
    this.directives["script-src"] = `'nonce-${newNonce}'`;
  }

  toString() {
    return Object.entries(this.directives)
      .map(([key, value]) => `${key} ${value}`)
      .join("; ");
  }
}
