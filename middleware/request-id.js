import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/** @type {AsyncLocalStorage<{ requestId: string }>} */
const requestIdAsyncLocalStorage = new AsyncLocalStorage();

export function getRequestId() {
  return requestIdAsyncLocalStorage.getStore()?.requestId;
}

/**
 * @param {import("../lib/request.js").MyRequest} req
 * @param {() => Promise<import("../lib/response.js").MyResponse>} next
 * @returns {Promise<import("../lib/response.js").MyResponse>}
 */
export async function requestIdMiddleware(req, next) {
  const maybeRequestId = req.headers["x-amzn-trace-id"];
  const requestId =
    typeof maybeRequestId === "string" ? maybeRequestId : randomUUID();
  return requestIdAsyncLocalStorage.run({ requestId }, () => {
    return next();
  });
}

/**
 *
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {import("@fastify/middie").NextFunction} next
 * @returns
 */
export function requestIdMiddlewareMiddie(req, res, next) {
  const maybeRequestId = req.headers["x-amzn-trace-id"];
  const requestId =
    typeof maybeRequestId === "string" ? maybeRequestId : randomUUID();
  return requestIdAsyncLocalStorage.run({ requestId }, () => {
    return next();
  });
}
