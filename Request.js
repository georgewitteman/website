import querystring from "node:querystring";

/**
 * https://github.com/expressjs/express/blob/f540c3b0195393974d4875a410f4c00a07a2ab60/lib/request.js#L292-L324
 *
 * @param {import("node:http").IncomingMessage} req
 */
function getProtocolFromRequest(req) {
  return "encrypted" in req.socket && req.socket.encrypted ? "https" : "http";
  // var proto = this.connection.encrypted
  //   ? 'https'
  //   : 'http';
  // var trust = this.app.get('trust proxy fn');

  // if (!trust(this.connection.remoteAddress, 0)) {
  //   return proto;
  // }

  // // Note: X-Forwarded-Proto is normally only ever a
  // //       single value, but this is to be safe.
  // var header = this.get('X-Forwarded-Proto') || proto
  // var index = header.indexOf(',')

  // return index !== -1
  //   ? header.substring(0, index).trim()
  //   : header.trim()
}

/**
 * @template {string} [Method=string]
 */
export class MyRequest {
  /** @type {import("node:http").IncomingMessage} */
  #nodeRequest;

  /**
   * The URL based on the original request without looking at any proxy headers.
   * @type {URL}
   */
  #rawUrl;

  /**
   * The URL including proxy headers. Assumes the proxy is trusted.
   * @type {URL}
   */
  #originalUrl;

  /** @type {{ minor: number, major: number, version: string }} */
  #httpVersion;

  /** @readonly @type {Method} */
  #method;

  /** @type {string | undefined} */
  #rawBody;

  /**
   * @param {Method} method
   * @param {import("node:http").IncomingMessage} req
   */
  constructor(method, req) {
    this.#nodeRequest = req;

    const hostHeader = req.headers.host;
    // https://github.com/nodejs/node/issues/3094#issue-108564685
    if (!hostHeader) {
      throw new Error("Missing required Host header");
    }

    this.#method = method;

    if (!req.url) {
      throw new Error("Missing request path");
    }

    // https://datatracker.ietf.org/doc/html/rfc7230#section-5.3
    // https://datatracker.ietf.org/doc/html/rfc7230#section-5.5
    this.#rawUrl = new URL(
      req.url,
      `${getProtocolFromRequest(req)}://${hostHeader}`
    );
    this.#originalUrl = new URL(
      req.url,
      `${req.headers["x-forwarded-proto"] ?? getProtocolFromRequest(req)}://${
        req.headers["x-forwarded-host"] ?? hostHeader
      }`
    );

    this.#httpVersion = {
      version: req.httpVersion,
      minor: req.httpVersionMinor,
      major: req.httpVersionMajor,
    };
  }

  async body() {
    if (typeof this.#rawBody !== "string") {
      /** @type {Buffer[]} */
      const chunks = [];

      for await (const chunk of this.#nodeRequest) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        chunks.push(Buffer.from(chunk));
      }

      this.#rawBody = Buffer.concat(chunks).toString("utf-8");
    }
    return querystring.parse(this.#rawBody);
  }

  get headers() {
    return this.#nodeRequest.headers;
  }

  get method() {
    return this.#method;
  }

  get httpVersion() {
    return this.#httpVersion.version;
  }

  /**
   * The URL based on the original request without looking at any proxy headers.
   */
  get rawUrl() {
    return this.#rawUrl;
  }

  /**
   * The URL including proxy headers. Assumes the proxy is trusted.
   */
  get originalUrl() {
    return this.#originalUrl;
  }

  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/URL/hostname
   */
  get hostname() {
    return this.rawUrl.hostname;
  }

  get pathname() {
    return this.rawUrl.pathname;
  }
}
