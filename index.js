import  path from "node:path";
import fs from "node:fs";
import { MyResponse } from './Response.js';
import { getContentTypeFromExtension, isSupportedExtension } from "./contentType.js";
import { App } from "./App.js";
import { pool, typeSafeQuery } from "./db.js";
import { z } from "./zod.js";
import process from "node:process";

const PORT = 8080;

const STATIC_PATH = path.join(process.cwd(), "./static");

/**
 * https://developer.mozilla.org/en-US/docs/Learn/Server-side/Node_server_without_framework
 * @param {string} pathname
 */
async function serveStaticFile(pathname) {
  const normalizedFullFilePath = path.join(STATIC_PATH, pathname);
  if (!normalizedFullFilePath.startsWith(STATIC_PATH)) {
    // Security: Don't allow path traversal. I don't think this is actually
    // necessary based on my testing.
    return undefined;
  }
  try {
    return { contentsBuffer: await fs.promises.readFile(normalizedFullFilePath), filePath: normalizedFullFilePath };
  } catch (err) {
    // Common system errors
    if (typeof err === "object" && err && "code" in err && typeof err.code === "string" && (err.code === "ENOENT" || err.code === "EISDIR")) {
      return undefined;
    }
    throw err;
  }
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<MyResponse>} next
 * @returns {Promise<MyResponse>}
 */
async function staticHandler(req, next) {
  if (req.method !== "GET") {
    return next();
  }
  const pathname = req.pathname === "/" ? "/index.html" : req.pathname;

  const fileInfo = await serveStaticFile(pathname);
  if (!fileInfo) {
    return next();
  }

  // https://github.com/jshttp/mime-types https://github.com/broofa/mime
  // https://github.com/jshttp/mime-db
  const extension = path.extname(fileInfo.filePath).substring(1).toLowerCase();
  if (!isSupportedExtension(extension)) {
    return next();
  }
  return new MyResponse(200, { "Content-Type": getContentTypeFromExtension(extension) }, fileInfo.contentsBuffer);
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<MyResponse>} next
 * @returns {Promise<MyResponse>}
 */
async function now(req, next) {
  if (req.rawUrl.pathname !== "/now") {
    return next();
  }
  const result = await typeSafeQuery("SELECT NOW(), VERSION()", z.array(z.object({ now: z.date(), version: z.string() })).length(1))
  return new MyResponse(200, {'Content-Type': 'application/json; charset=utf-8'}, JSON.stringify(result[0]));
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @returns {Promise<MyResponse>}
 */
async function notFound(req) {
  return new MyResponse(404, {}, `Not found: ${req.originalUrl.href}\n`);
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {MyResponse} res
 * @param {bigint} startTimeNs
 */
function logResponse(req, res, startTimeNs) {
  const durationNs = process.hrtime.bigint() - startTimeNs;
  const durationMs = durationNs / 1_000_000n;
  console.log(`END: ${req.method} (${req.httpVersion}) ${req.originalUrl} ${req.rawUrl} ${res.statusCode} ${res.statusMessage} ${durationMs}ms`);
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<MyResponse>} next
 */
async function logger(req, next) {
  const startNs = process.hrtime.bigint();
  console.log(`START: ${req.method} (${req.httpVersion}) ${req.originalUrl} ${req.rawUrl} ${JSON.stringify(req.headers)}`);
  try {
    const res = await next();
    logResponse(req, res, startNs);
    return res;
  } catch (err) {
    console.error(err);
    const res = new MyResponse(500, {}, "Internal Server Error\n");
    logResponse(req, res, startNs);
    return res;
  }
}

const app = new App();
app.use(logger);
app.use(staticHandler);
app.use(now);
app.use(notFound);

console.log("Environment:", JSON.stringify(process.env));

const server = app.createServer().listen(PORT, '0.0.0.0', () => {
  console.log("listening on %s", server.address());
});

let forceClose = false;

/**
 * @param {string} signal
 */
function shutdown(signal) {
  if (forceClose) {
    console.log("Forcing exit");
    process.exit(1);
  }
  forceClose = true;
  console.log("signal %s", signal);

  // https://nodejs.org/docs/latest-v18.x/api/net.html#serverclosecallback
  server.close((err) => {
    if (err) {
      console.error(err)
      return;
    }
    console.log("Successfully shut down server");

    pool.end(() => {
      console.log("Pool closed");
    })
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
