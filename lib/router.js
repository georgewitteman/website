/**
 * @typedef {(req: import("./request.js").MyRequest) => Promise<import("./response.js").MyResponse>} Handler
 */

import { match } from "path-to-regexp";

/**
 * TODO:
 *   - Support middleware for routes
 *   - Layer: https://github.com/koajs/router/blob/master/lib/layer.js
 */
export class Router {
  /**
   * @type {{ method: string; path: import("path-to-regexp").Path, handler: Handler }[]}
   */
  routes;

  constructor() {
    this.routes = [];
  }

  /**
   * @param {import("path-to-regexp").Path} path
   * @param {Handler} handler
   */
  get(path, handler) {
    this.routes.push({ method: "GET", path, handler });
  }

  /**
   * @param {import("path-to-regexp").Path} path
   * @param {Handler} handler
   */
  post(path, handler) {
    this.routes.push({ method: "POST", path, handler });
  }

  /**
   * @param {import("./request.js").MyRequest} req
   * @param {() => Promise<import("./response.js").MyResponse>} next
   */
  async handle(req, next) {
    for (const route of this.routes) {
      if (route.method !== req.method) {
        continue;
      }
      const maybeMatch = match(route.path)(req.rawUrl.pathname);
      if (maybeMatch) {
        req.params = { ...maybeMatch.params };
        return await route.handler(req);
      }
    }
    return await next();
  }
}
