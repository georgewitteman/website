import { getActiveResourcesInfo } from 'node:process';
import { createServer } from "node:http";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { createReadStream } from 'node:fs';
import { pipeline } from "node:stream/promises";
import { contentType } from "mime-types";
import { Request } from './Request.js';

const PORT = 8080;

const STATIC_PATH = path.join(process.cwd(), "./static");

/**
 * https://developer.mozilla.org/en-US/docs/Learn/Server-side/Node_server_without_framework
 * @param {string} pathname
 */
async function serveStaticFile(pathname) {
  const normalizedFullFilePath = path.join(STATIC_PATH, pathname);
  if (!normalizedFullFilePath.startsWith(STATIC_PATH)) {
    // Security: Don't allow path traversal
    return undefined;
  }
  if (!await fs.access(normalizedFullFilePath).then(() => true, () => false)) {
    return undefined
  }
  const stats = await fs.stat(normalizedFullFilePath)
  if (!stats.isFile()) {
    return undefined;
  }
  return { stream: createReadStream(normalizedFullFilePath), filePath: normalizedFullFilePath };
}

// https://github.com/jshttp/mime-types https://github.com/broofa/mime
// https://github.com/jshttp/mime-db
// const MIME_TYPES = {
//   default: "application/octet-stream",
//   html: "text/html; charset=UTF-8",
//   js: "application/javascript",
//   css: "text/css",
//   png: "image/png",
//   jpg: "image/jpg",
//   gif: "image/gif",
//   ico: "image/x-icon",
//   svg: "image/svg+xml",
//   pdf: "application/pdf",
// };

/**
 * @param {Request} req
 * @param {import("node:http").ServerResponse} res
 * @param {() => Promise<void>} next
 */
async function staticHandler(req, res, next) {
  const pathname = req.pathname === "/" ? "/index.html" : req.pathname;

  const fileInfo = await serveStaticFile(pathname);
  if (!fileInfo) {
    await next();
    return;
  }

  const extension = path.extname(fileInfo.filePath).substring(1).toLowerCase();
  // const contentTypeHeader = MIME_TYPES[extension] ?? MIME_TYPES.default;
  const contentTypeHeader = contentType(extension) || 'application/octet-stream';
  res.writeHead(200, { "Content-Type": contentTypeHeader });
  await pipeline(fileInfo.stream, res);
}

/**
 * @param {Request} req
 * @param {import("node:http").ServerResponse} res
 */
async function notFound(req, res) {
  res.writeHead(404);
  res.end("Not found\n");
}

/**
 * @param {Request} req
 * @param {import("node:http").ServerResponse} res
 * @param {() => Promise<void>} next
 */
async function logger(req, res, next) {
  const nodeRequest = req._UNSAFE_nodeRequest;
  const startNs = process.hrtime.bigint();
  console.log(`START: ${nodeRequest.method} (${nodeRequest.httpVersion}) ${req.originalUrl} ${req.rawUrl} ${JSON.stringify(nodeRequest.headers)}`);
  try {
    await next();
  } catch (err) {
    console.log(res.closed, res.destroyed, res.errored, res.writable, res.writableEnded, res.writableFinished);
    console.error(err);
    if (res.closed) {
      return;
    }
    res.writeHead(500);
    res.end("Internal Server Error\n");
  } finally {
    const durationNs = process.hrtime.bigint() - startNs;
    const durationMs = durationNs / 1_000_000n;
    console.log(`END: ${nodeRequest.method} (${nodeRequest.httpVersion}) ${req.originalUrl} ${req.rawUrl} ${res.statusCode} ${res.statusMessage} ${durationMs}ms`);
  }
}

const middleware = [logger, staticHandler, notFound];

/**
 * @param {Request} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleRequest(req, res) {
  let index = -1;
  /**
   * https://github.com/koajs/compose/blob/master/index.js
   * @param {number} i
   */
  async function dispatch(i) {
    if (i <= index) {
      throw new Error('next() called multiple times');
    }
    index = i;
    if (i >= middleware.length) {
      return
    }
    const fn = middleware[i];
    return fn(req, res, dispatch.bind(null, i + 1));
  }
  return dispatch(0);
}

const server = createServer((nodeRequest, res) => {

  if (typeof nodeRequest.headers.host !== "string") {
    // RFC 7230: "A server MUST respond with a 400 (Bad Request) status code to
    // any HTTP/1.1 request message that lacks a Host header field and to any
    // request message that contains more than one Host header field or a Host
    // header field with an invalid field-value."
    //
    // https://github.com/nodejs/node/issues/3094#issue-108564685
    res.writeHead(400);
    res.end();
    return;
  }
  const req = new Request(nodeRequest);

  handleRequest(req, res).catch(console.error)
});

server.listen(PORT, '0.0.0.0', () => {
  console.log("listening on %s", server.address());
});

let forceClose = false;

/**
 * @param {string} signal
 */
function shutdown(signal) {
  if (forceClose) {
    console.log("Forcing exit");
    console.log(getActiveResourcesInfo()); // experimental
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
