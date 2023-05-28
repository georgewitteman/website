/**
 * @template {string} [T=string]
 * @typedef {(req: import("./Request.js").MyRequest<T>) => Promise<import("./Response.js").MyResponse>} RequestHandler
 */

import { MyResponse } from "./Response.js";

class Router {
  /**
   * @type {{ method: string, path: string, handler: RequestHandler }[]}
   */
  #routes = [];

  /**
   *
   * @param {string} path
   * @param {RequestHandler} handler
   */
  get(path, handler) {
    this.#routes.push({ method: "GET", path, handler });
  }

  middleware() {
    /**
     * @param {import("./Request.js").MyRequest} req
     * @param {() => Promise<import("./Response.js").MyResponse>} next
     * @returns {Promise<import("./Response.js").MyResponse>}
     */
    return (req, next) => {
      const route = this.#routes.find(
        (val) => req.method === val.method && val.path === req.rawUrl.pathname
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
  return MyResponse.json(200, {}, { test: req.rawUrl.href });
});
