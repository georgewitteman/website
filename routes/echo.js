import { MyResponse } from "../lib/Response.js";
import { Router } from "../lib/Router.js";

export const router = new Router();

/**
 * @param {import("http").IncomingHttpHeaders} headers
 * @returns {{[k: string]: string | string[] | null }}
 */
function cleanHeaders(headers) {
  /** @type {{[k: string]: string | string[] | null }} */
  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      result[key] = null;
      continue;
    }
    result[key] = value;
  }
  return result;
}

router.get("/echo", async (req) => {
  return new MyResponse().json({
    method: req.method,
    headers: cleanHeaders(req.headers),
  });
});
