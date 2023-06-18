/** @typedef {Record<string, string>} Params */

/**
 * @typedef {(req: import("./Request.js").MyRequest, params: Params) => Promise<import("./Response.js").MyResponse>} RequestHandler
 */

/**
 * @param {string} routePath
 * @param {string} realPath
 * @returns {[boolean, Params]}
 */
export function pathMatches(routePath, realPath) {
  /** @type {Params} */
  const params = {};
  const routeSplit = routePath.split("/");
  const realSplit = realPath.split("/");
  if (routeSplit.length !== realSplit.length) {
    return [false, params];
  }
  for (let i = 0; i < routeSplit.length; i++) {
    const routeSegment = routeSplit[i];
    const realSegment = realSplit[i];
    if (
      typeof routeSegment === "string" &&
      routeSegment.startsWith(":") &&
      typeof realSegment === "string"
    ) {
      params[routeSegment.substring(1)] = realSegment;
      continue;
    }
    if (routeSegment !== realSegment) {
      return [false, params];
    }
  }
  return [true, params];
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
          pathMatches(route.path, req.rawUrl.pathname)[0],
      );
      if (!route) {
        return next();
      }
      const [, params] = pathMatches(route.path, req.rawUrl.pathname);
      return route.handler(req, params);
    };
  }
}
