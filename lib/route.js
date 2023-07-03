import { match } from "path-to-regexp";

/**
 * @param  {(string | number)[]} paths
 */
export function route(...paths) {
  return `/${paths.map(encodeURIComponent).join("/")}`;
}

export class Route {
  /**
   * @param {Object} route
   * @param {string} route.method
   * @param {import("path-to-regexp").Path} route.path
   * @param {(req: import("./Request.js").MyRequest) => Promise<import("./Response.js").MyResponse>} route.handler
   */
  constructor(route) {
    this.method = route.method;
    this.path = route.path;
    this.handler = route.handler;
    this.matcher = match(route.path);
  }

  /**
   * @param {string} method
   * @param {string} path
   */
  match(method, path) {
    if (method !== this.method) {
      return false;
    }

    return this.matcher(path);
  }
}

/**
 * @param {string} method
 * @param {import("path-to-regexp").Path} path
 * @param {(req: import("./Request.js").MyRequest) => Promise<import("./Response.js").MyResponse>} handler
 */
export function createRoute(method, path, handler) {
  return new Route({ method, path, handler });
}
