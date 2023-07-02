import { z } from "zod";
import { notFound } from "../middleware/not-found.js";
import { requestIdMiddleware } from "../middleware/request-id-middleware.js";
import { requestLogger } from "../middleware/request-logger.js";
import { staticHandler } from "../middleware/static.js";
import {
  getMigrations,
  getOneMigration,
  postOneMigration,
} from "../routes/migrations.js";
import { MyRequest } from "./Request.js";
import { logger } from "./logger.js";
import { match } from "path-to-regexp";
import {
  getSignIn,
  getSignup,
  getUserProfile,
  postSignIn,
  postSignup,
} from "../routes/auth.js";

/**
 * http://forbeslindesay.github.io/express-route-tester/
 * @type {{ [k: string]: { [k: string]: (req: MyRequest, params: object) => Promise<import("./Response.js").MyResponse> } }}
 */
const ROUTES = {
  "/migrations": {
    GET: async () => {
      return await getMigrations();
    },
  },
  "/migration/:name": {
    GET: async (_, params) => {
      return await getOneMigration(
        z.object({ name: z.string() }).parse(params).name,
      );
    },
    POST: async (_, params) => {
      return await postOneMigration(
        z.object({ name: z.string() }).parse(params).name,
      );
    },
  },
  "/auth/signup": {
    GET: async () => {
      return await getSignup();
    },
    POST: async (req) => {
      const body = z
        .object({
          email: z.string().email(),
          password: z.string(),
        })
        .parse(await req.body());

      return await postSignup(body.email, body.password);
    },
  },
  "/auth/signin": {
    GET: async () => {
      return await getSignIn();
    },
    POST: async (req) => {
      const body = z
        .object({
          email: z.string().email(),
          password: z.string(),
        })
        .parse(await req.body());

      return await postSignIn(body.email, body.password);
    },
  },
  "/auth/profile/:id": {
    GET: async (req, params) => {
      const sessionId = req.cookies.id;
      const { id: userId } = z.object({ id: z.string() }).parse(params);

      return await getUserProfile(sessionId, userId);
    },
  },
};

/**
 * @param {MyRequest} req
 */
async function routeHandler(req) {
  for (const [path, route] of Object.entries(ROUTES)) {
    const maybeMatch = match(path)(req.pathname);
    if (!maybeMatch) {
      continue;
    }

    for (const [method, handler] of Object.entries(route)) {
      if (method !== req.method) {
        continue;
      }

      return await handler(req, maybeMatch.params);
    }
  }
  return await notFound(req);
}

/**
 * @param {MyRequest} req
 * @returns {Promise<import("./Response.js").MyResponse>}
 */
async function requestListenerAsync(req) {
  return await requestIdMiddleware(req, async () => {
    return await requestLogger(req, async () => {
      return await staticHandler(req, async () => {
        return await routeHandler(req);
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
