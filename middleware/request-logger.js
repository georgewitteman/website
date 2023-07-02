import { logger } from "../lib/logger.js";

/**
 * @param {import("../lib/Request.js").MyRequest} req
 * @param {import("../lib/Response.js").MyResponse | undefined} res
 * @param {bigint} startTimeNs
 */
function logResponse(req, res, startTimeNs) {
  const durationNs = process.hrtime.bigint() - startTimeNs;
  const durationMs = durationNs / 1_000_000n;
  logger.info(
    `${req.method} ${req.originalUrl.href} ${
      res?.statusCode ?? "<no status code>"
    } ${res?.statusMessage ?? "<no status message>"} ${durationMs}ms`,
    {
      method: req.method,
      statusCode: res?.statusCode,
      statusMessage: res?.statusMessage,
      durationMs,
      originalUrl: req.originalUrl,
      rawUrl: req.rawUrl,
      httpVersion: req.httpVersion,
      headers: req.headers,
    },
  );
}

/**
 * @param {import("../lib/Request.js").MyRequest} req
 * @param {() => Promise<import("../lib/Response.js").MyResponse>} next
 */
export async function requestLogger(req, next) {
  const startNs = process.hrtime.bigint();
  try {
    const res = await next();
    logResponse(req, res, startNs);
    return res;
  } catch (err) {
    logger.error(err);
    logResponse(req, undefined, startNs);
    throw err;
  }
}
