import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/** @type {AsyncLocalStorage<{ requestId: string }>} */
const requestIdAsyncLocalStorage = new AsyncLocalStorage();

export function getRequestId() {
  return requestIdAsyncLocalStorage.getStore()?.requestId;
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<import("./Response.js").MyResponse>} next
 * @returns {Promise<import("./Response.js").MyResponse>}
 */
export async function requestIdMiddleware(req, next) {
  const requestId =
    typeof req.headers["x-amzn-trace-id"] === "string"
      ? req.headers["x-amzn-trace-id"]
      : randomUUID();
  return requestIdAsyncLocalStorage.run({ requestId }, () => {
    return next();
  });
}
