import { requestIdMiddleware } from "../middleware/request-id.js";
import { requestLogger } from "../middleware/request-logger.js";
import { staticHandler } from "../middleware/static.js";
import { MyRequest } from "./Request.js";
import { logger } from "./logger.js";
import { MyResponse } from "./Response.js";
import { runWithUser } from "../middleware/user.js";
import { routes as authRoutes } from "../routes/auth.js";
import { routes as migrationRoutes } from "../routes/migrations.js";

const ROUTES = [...authRoutes, ...migrationRoutes];

/**
 * @param {MyRequest} req
 */
async function routeHandler(req) {
  for (const route of ROUTES) {
    const maybeMatch = route.match(req.method, req.pathname);
    if (maybeMatch) {
      req.params = maybeMatch.params;
      return await route.handler(req);
    }
  }
  return new MyResponse(404).body(
    `Not found: ${req.method} ${req.originalUrl.href}\n`,
  );
}

/**
 * @param {MyRequest} req
 * @returns {Promise<import("./Response.js").MyResponse>}
 */
async function requestListenerAsync(req) {
  return await requestIdMiddleware(req, async () => {
    return await requestLogger(req, async () => {
      return await runWithUser(req, async () => {
        return await staticHandler(req, async () => {
          return await routeHandler(req);
        });
      });
    });
  });
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
export function requestListener(req, res) {
  if (typeof req.headers.host !== "string") {
    // RFC 7230: "A server MUST respond with a 400 (Bad Request) status code to
    // any HTTP/1.1 request message that lacks a Host header field and to any
    // request message that contains more than one Host header field or a Host
    // header field with an invalid field-value."
    //
    // https://github.com/nodejs/node/issues/3094#issue-108564685
    res.writeHead(400);
    res.end("Missing Host header");
    return;
  }
  if (!req.method || !["GET", "POST"].includes(req.method)) {
    // When a request method is received that is unrecognized or not implemented
    // by an origin server, the origin server SHOULD respond with the 501 (Not
    // Implemented) status code.  When a request method is received that is
    // known by an origin server but not allowed for the target resource, the
    // origin server SHOULD respond with the 405 (Method Not Allowed) status
    // code.
    res.writeHead(501);
    res.end(`Unsupported method: ${req.method ?? "undefined"}`);
    return;
  }
  const request = new MyRequest(req.method, req);
  requestListenerAsync(request)
    .then((response) => {
      res
        .writeHead(response.statusCode, response.finalHeaders())
        .end(response.finalBody());
    })
    .catch((/** @type {unknown} */ e) => {
      logger.error(`Request error: ${req.url ?? "<nullish>"}`, e);
      res.writeHead(500).end("Internal Server Error");
    });
}
