/**
 * @typedef {{"Content-Type"?: import("../lib/content-type.js").ContentTypeHeaderValues, Location?: string, 'Content-Security-Policy'?: string, ETag?: string, "Cache-Control"?: string, "Last-Modified"?: Date, "Set-Cookie"?: string}} Headers
 */

const STATUS_MESSAGE = /** @type {const} */ ({
  100: "Continue", // RFC 7231 6.2.1
  101: "Switching Protocols", // RFC 7231 6.2.2
  102: "Processing", // RFC 2518 10.1 (obsoleted by RFC 4918)
  103: "Early Hints", // RFC 8297 2
  200: "OK", // RFC 7231 6.3.1
  201: "Created", // RFC 7231 6.3.2
  202: "Accepted", // RFC 7231 6.3.3
  203: "Non-Authoritative Information", // RFC 7231 6.3.4
  204: "No Content", // RFC 7231 6.3.5
  205: "Reset Content", // RFC 7231 6.3.6
  206: "Partial Content", // RFC 7233 4.1
  207: "Multi-Status", // RFC 4918 11.1
  208: "Already Reported", // RFC 5842 7.1
  226: "IM Used", // RFC 3229 10.4.1
  300: "Multiple Choices", // RFC 7231 6.4.1
  301: "Moved Permanently", // RFC 7231 6.4.2
  302: "Found", // RFC 7231 6.4.3
  303: "See Other", // RFC 7231 6.4.4
  304: "Not Modified", // RFC 7232 4.1
  305: "Use Proxy", // RFC 7231 6.4.5
  307: "Temporary Redirect", // RFC 7231 6.4.7
  308: "Permanent Redirect", // RFC 7238 3
  400: "Bad Request", // RFC 7231 6.5.1
  401: "Unauthorized", // RFC 7235 3.1
  402: "Payment Required", // RFC 7231 6.5.2
  403: "Forbidden", // RFC 7231 6.5.3
  404: "Not Found", // RFC 7231 6.5.4
  405: "Method Not Allowed", // RFC 7231 6.5.5
  406: "Not Acceptable", // RFC 7231 6.5.6
  407: "Proxy Authentication Required", // RFC 7235 3.2
  408: "Request Timeout", // RFC 7231 6.5.7
  409: "Conflict", // RFC 7231 6.5.8
  410: "Gone", // RFC 7231 6.5.9
  411: "Length Required", // RFC 7231 6.5.10
  412: "Precondition Failed", // RFC 7232 4.2
  413: "Payload Too Large", // RFC 7231 6.5.11
  414: "URI Too Long", // RFC 7231 6.5.12
  415: "Unsupported Media Type", // RFC 7231 6.5.13
  416: "Range Not Satisfiable", // RFC 7233 4.4
  417: "Expectation Failed", // RFC 7231 6.5.14
  418: "I'm a Teapot", // RFC 7168 2.3.3
  421: "Misdirected Request", // RFC 7540 9.1.2
  422: "Unprocessable Entity", // RFC 4918 11.2
  423: "Locked", // RFC 4918 11.3
  424: "Failed Dependency", // RFC 4918 11.4
  425: "Too Early", // RFC 8470 5.2
  426: "Upgrade Required", // RFC 2817 and RFC 7231 6.5.15
  428: "Precondition Required", // RFC 6585 3
  429: "Too Many Requests", // RFC 6585 4
  431: "Request Header Fields Too Large", // RFC 6585 5
  451: "Unavailable For Legal Reasons", // RFC 7725 3
  500: "Internal Server Error", // RFC 7231 6.6.1
  501: "Not Implemented", // RFC 7231 6.6.2
  502: "Bad Gateway", // RFC 7231 6.6.3
  503: "Service Unavailable", // RFC 7231 6.6.4
  504: "Gateway Timeout", // RFC 7231 6.6.5
  505: "HTTP Version Not Supported", // RFC 7231 6.6.6
  506: "Variant Also Negotiates", // RFC 2295 8.1
  507: "Insufficient Storage", // RFC 4918 11.5
  508: "Loop Detected", // RFC 5842 7.2
  509: "Bandwidth Limit Exceeded",
  510: "Not Extended", // RFC 2774 7
  511: "Network Authentication Required", // RFC 6585 6
});

/**
 * @typedef {keyof typeof STATUS_MESSAGE} StatusCode
 */

export class MyResponse {
  /** @type {StatusCode} */
  statusCode;

  /**
   * @type {Headers}
   */
  #headers;

  /**
   * @type {string | Buffer | undefined}
   */
  #body;

  /**
   * @param {StatusCode} statusCode
   */
  constructor(statusCode = 200) {
    this.statusCode = statusCode;
    this.#headers = {};
    this.#body = undefined;
  }

  /**
   * @template {keyof Headers} K
   * @param {K} key
   * @param {Headers[K]} value
   */
  header(key, value) {
    this.#headers[key] = value;
    return this;
  }

  /**
   * @param {import("./utils.d.ts").Simplify<Partial<Headers>>} headers
   */
  headers(headers) {
    this.#headers = {
      ...this.#headers,
      ...headers,
    };
    return this;
  }

  /**
   * @param {StatusCode} code
   */
  status(code) {
    this.statusCode = code;
    return this;
  }

  /**
   * @param {string | Buffer} body
   */
  body(body) {
    this.#body = body;
    return this;
  }

  finalBody() {
    return this.#body;
  }

  finalHeaders() {
    return {
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Length
      "Content-Length":
        this.#body === undefined ? 0 : Buffer.byteLength(this.#body, "utf-8"),

      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
      ...(this.#headers["Cache-Control"]
        ? { "Cache-Control": this.#headers["Cache-Control"] }
        : {}),
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location
      ...(this.#headers.Location ? { Location: this.#headers.Location } : {}),
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
      ...(this.#headers.ETag ? { ETag: this.#headers.ETag } : {}),
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified
      ...(this.#headers["Last-Modified"]
        ? { "Last-Modified": this.#headers["Last-Modified"].toUTCString() }
        : {}),

      ...(this.#headers["Set-Cookie"]
        ? { "Set-Cookie": this.#headers["Set-Cookie"] }
        : {}),

      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
      ...(this.#headers["Content-Type"]
        ? { "Content-Type": this.#headers["Content-Type"] }
        : {}),
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
      ...(this.#headers["Content-Type"] === "text/html; charset=utf-8"
        ? {
            "Content-Security-Policy":
              "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src https://get.geojs.io",
          }
        : {}),
    };
  }

  /**
   * @param {import("./utils.d.ts").JSONValue} body
   */
  json(body) {
    return this.header("Content-Type", "application/json; charset=utf-8").body(
      JSON.stringify(body),
    );
  }

  /**
   * @param {string} body
   */
  html(body) {
    return this.header("Content-Type", "text/html; charset=utf-8").body(body);
  }

  /**
   * temporary redirect: found
   * @param {string} url
   */
  static redirectFound(url) {
    return new MyResponse().status(302).header("Location", url);
  }

  get statusMessage() {
    return STATUS_MESSAGE[this.statusCode];
  }
}
