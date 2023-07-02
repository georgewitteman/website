import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/** @type {AsyncLocalStorage<{ requestId: string }>} */
const requestIdAsyncLocalStorage = new AsyncLocalStorage();

export function getRequestId() {
  return requestIdAsyncLocalStorage.getStore()?.requestId;
}

/**
 * @param {import("../Request.js").MyRequest} req
 * @param {() => Promise<import("../Response.js").MyResponse>} next
 * @returns {Promise<import("../Response.js").MyResponse>}
 */
export async function requestIdMiddleware(req, next) {
  const maybeRequestId = req.headers["x-amzn-trace-id"];
  const requestId =
    typeof maybeRequestId === "string" ? maybeRequestId : randomUUID();
  return requestIdAsyncLocalStorage.run({ requestId }, () => {
    return next();
  });
}
