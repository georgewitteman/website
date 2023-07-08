import querystring from "node:querystring";
import assert from "node:assert";
import cookie from "cookie";

/**
 * @param {unknown} val
 * @returns {string | null | undefined}
 */
function stringOrUndefinedOrNullOrThrow(val) {
  if (typeof val === "string" || val === undefined || val === null) {
    return val;
  }
  throw new Error("value was not a string");
}

/**
 * @param {string | string[] | null | undefined} header
 */
function headerToDebugString(header) {
  if (typeof header === "string") {
    return header;
  }
  if (Array.isArray(header)) {
    return header.join(", ");
  }
  if (header === null) {
    return "<null>";
  }
  return "<undefined>";
}

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

  /** @readonly @type {import("node:http").IncomingHttpHeaders} */
  headers;

  /** @type {object | undefined} */
  params;

  /** @type {import("zod").infer<typeof import("../lib/user.js").UserSchema> | undefined} */
  user;

  /** @type {import("./session.js").Session | undefined} */
  session;

  /**
   * @param {Method} method
   * @param {import("node:http").IncomingMessage} req
   */
  constructor(method, req) {
    this.#nodeRequest = req;

    this.headers = req.headers;

    const hostHeader = this.headers["host"];
    // https://github.com/nodejs/node/issues/3094#issue-108564685
    if (typeof hostHeader !== "string") {
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
      `${getProtocolFromRequest(req)}://${hostHeader}`,
    );
    this.#originalUrl = new URL(
      req.url,
      `${
        stringOrUndefinedOrNullOrThrow(this.headers["x-forwarded-proto"]) ??
        getProtocolFromRequest(req)
      }://${
        stringOrUndefinedOrNullOrThrow(this.headers["x-forwarded-host"]) ??
        hostHeader
      }`,
    );

    this.#httpVersion = {
      version: req.httpVersion,
      minor: req.httpVersionMinor,
      major: req.httpVersionMajor,
    };
  }

  /**
   * @returns {Promise<import("./utils.js").Simplify<import("node:querystring").ParsedUrlQuery>>}
   */
  async body() {
    if (typeof this.#rawBody !== "string") {
      /** @type {Buffer[]} */
      const chunks = [];

      for await (const chunk of this.#nodeRequest) {
        assert(chunk instanceof Buffer);
        chunks.push(chunk);
      }

      this.#rawBody = Buffer.concat(chunks).toString("utf-8");
    }

    if (this.headers["content-type"] === "application/x-www-form-urlencoded") {
      return querystring.parse(this.#rawBody);
    }

    throw new Error(
      `Unsupported content type: ${headerToDebugString(
        this.headers["content-type"],
      )}`,
    );
  }

  get cookies() {
    if (typeof this.#nodeRequest.headers.cookie !== "string") {
      return {};
    }
    return cookie.parse(this.#nodeRequest.headers.cookie);
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
