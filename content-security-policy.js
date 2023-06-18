/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/default-src
 * @typedef {{"default-src": "'none'"}} DefaultSrcDirective
 */

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src
 * @typedef {{"style-src": "'self'"}} StyleSrcDirective
 */

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src
 * @typedef {{"script-src": "'self'"}} ScriptSrcDirective
 */

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/base-uri
 * @typedef {{"base-uri": "'self'" | "'none'"}} BaseUriDirective
 */

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/img-src
 * @typedef {{"img-src": "'self'" | "'none'"}} ImgSrcDirective
 */

/**
 * https://content-security-policy.com/#directive
 * @typedef {Partial<DefaultSrcDirective & StyleSrcDirective & ScriptSrcDirective & BaseUriDirective & ImgSrcDirective>} Directives
 */

/**
 * - https://content-security-policy.com
 * - https://csp-evaluator.withgoogle.com
 * - https://web.dev/strict-csp/#adopting-a-strict-csp
 */
export class ContentSecurityPolicy {
  constructor() {
    /** @type {Directives} */
    this.directives = {
      "default-src": "'none'",
      "script-src": "'self'",
      "style-src": "'self'",
      "img-src": "'self'",
    };
  }

  toString() {
    return Object.entries(this.directives)
      .map(
        ([key, value]) =>
          `${key} ${Array.isArray(value) ? value.join(" ") : value}`,
      )
      .join("; ");
  }
}
