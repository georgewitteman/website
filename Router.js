/**
 * @template {string} [T=string]
 * @typedef {(req: import("./Request.js").MyRequest<T>) => Promise<import("./Response.js").MyResponse>} RequestHandler
 */

import { MyResponse } from "./Response.js";

/**
 * @param {string} routePath
 * @param {string} realPath
 */
export function pathMatches(routePath, realPath) {
  const routeSplit = routePath.split("/");
  const realSplit = realPath.split("/");
  if (routeSplit.length !== realSplit.length) {
    return false;
  }
  for (let i = 0; i < routeSplit.length; i++) {
    const routeSegment = routeSplit[i];
    const realSegment = realSplit[i];
    if (routeSegment.startsWith(":")) {
      continue;
    }
    if (routeSegment !== realSegment) {
      return false;
    }
  }
  return true;
}

export class Router {
  /**
   * @type {{ method: string, path: string, handler: RequestHandler }[]}
   */
  #routes = [];

  /**
   * @template {string} T
   * @param {T} path
   * @param {RequestHandler} handler
   */
  get(path, handler) {
    this.#routes.push({ method: "GET", path, handler });
  }

  /**
   * @template {string} T
   * @param {T} path
   * @param {RequestHandler} handler
   */
  post(path, handler) {
    this.#routes.push({ method: "POST", path, handler });
  }

  middleware() {
    /**
     * @param {import("./Request.js").MyRequest} req
     * @param {() => Promise<import("./Response.js").MyResponse>} next
     * @returns {Promise<import("./Response.js").MyResponse>}
     */
    return (req, next) => {
      const route = this.#routes.find(
        (route) =>
          req.method === route.method &&
          pathMatches(route.path, req.rawUrl.pathname)
      );
      if (!route) {
        return next();
      }
      return route.handler(req);
    };
  }
}

export const testRoutes = new Router();

testRoutes.get("/router/test", async (req) => {
  return MyResponse.json(200, {}, { test: req.rawUrl.href });
});

testRoutes.get("/router/test2", async (req) => {
  return MyResponse.json(200, {}, { test2: req.rawUrl.href });
});

testRoutes.get("/router/error", async () => {
  throw new Error("Test error");
});

testRoutes.get("/router/:id", async (req) => {
  return MyResponse.json(200, {}, { testid: req.rawUrl.href });
});

testRoutes.get("/router/:id/foo", async (req) => {
  return MyResponse.json(200, {}, { testidfoo: req.rawUrl.href });
});
