import * as path from "node:path";
import * as fs from "node:fs";
import { MyRequest } from './Request.js';
import { MyResponse } from './Response.js';
import { getContentTypeFromExtension, isSupportedExtension } from "./contentType.js";
import { App } from "./App.js";

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
 * @param {MyRequest} req
 * @param {MyResponse} res
 * @param {() => Promise<void>} next
 */
async function staticHandler(req, res, next) {
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

  res.writeHead(200, { "Content-Type": getContentTypeFromExtension(extension) });
  res.writeToKernelBuffer(fileInfo.contentsBuffer);
  res.end();
}

/**
 * @param {MyRequest} req
 * @param {MyResponse} res
 */
async function notFound(req, res) {
  res.writeHead(404);
  res.writeToKernelBuffer("Not found\n");
  res.end();
}

/**
 * @param {MyRequest} req
 * @param {MyResponse} res
 * @param {() => Promise<void>} next
 */
async function logger(req, res, next) {
  const startNs = process.hrtime.bigint();
  console.log(`START: ${req.method} (${req.httpVersion}) ${req.originalUrl} ${req.rawUrl} ${JSON.stringify(req.headers)}`);
  try {
    await next();
  } catch (err) {
    const res2 = res._UNSAFE_serverResponse;
    console.log(res2.closed, res2.destroyed, res2.errored, res2.writable, res2.writableEnded, res2.writableFinished);
    console.error(err);
    if (res.headersSent) {
      return;
    }
    res.writeHead(500);
    res.writeToKernelBuffer("Internal Server Error\n");
    res.end();
  } finally {
    const durationNs = process.hrtime.bigint() - startNs;
    const durationMs = durationNs / 1_000_000n;
    console.log(`END: ${req.method} (${req.httpVersion}) ${req.originalUrl} ${req.rawUrl} ${res.statusCode} ${res.statusMessage} ${durationMs}ms`);
  }
}

const app = new App();
app.use(logger);
app.use(staticHandler);
app.use(notFound);

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
    console.log("Successfully shut down server")
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
