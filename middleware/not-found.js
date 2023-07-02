import { MyResponse } from "../lib/Response.js";

/**
 * @param {import("../lib/Request.js").MyRequest} req
 * @returns {Promise<MyResponse>}
 */
export async function notFound(req) {
  return new MyResponse(404).body(
    `Not found: ${req.method} ${req.originalUrl.href}\n`,
  );
}
