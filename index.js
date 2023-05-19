import { createServer } from "node:http";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { contentType } from "mime-types";
import { Request } from './Request.js';
import { Response } from './Response.js';

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
    return { contentsBuffer: await fs.readFile(normalizedFullFilePath), filePath: normalizedFullFilePath };
  } catch (err) {
    // Common system errors
    if (err.code === "ENOENT" || err.code === "EISDIR") {
      return undefined;
    }
    throw err;
  }
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {() => Promise<void>} next
 */
async function staticHandler(req, res, next) {
  const pathname = req.pathname === "/" ? "/index.html" : req.pathname;

  const fileInfo = await serveStaticFile(pathname);
  if (!fileInfo) {
    await next();
    return;
  }

  // https://github.com/jshttp/mime-types https://github.com/broofa/mime
  // https://github.com/jshttp/mime-db
  const extension = path.extname(fileInfo.filePath).substring(1).toLowerCase();
  const contentTypeHeader = contentType(extension) || 'application/octet-stream';
  res.writeHead(200, { "Content-Type": contentTypeHeader });
  res.writeToKernelBuffer(fileInfo.contentsBuffer);
  res.end();
}

/**
 * @param {Request} req
 * @param {Response} res
 */
async function notFound(req, res) {
  res.writeHead(404);
  res.writeToKernelBuffer("Not found\n");
  res.end();
}

/**
 * @param {Request} req
 * @param {Response} res
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

const middleware = [logger, staticHandler, notFound];

/**
 * @param {Request} req
 * @param {Response} res
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
    await fn(req, res, dispatch.bind(null, i + 1));
  }
  await dispatch(0);
}

const server = createServer((nodeRequest, nodeResponse) => {
  if (typeof nodeRequest.headers.host !== "string") {
    // RFC 7230: "A server MUST respond with a 400 (Bad Request) status code to
    // any HTTP/1.1 request message that lacks a Host header field and to any
    // request message that contains more than one Host header field or a Host
    // header field with an invalid field-value."
    //
    // https://github.com/nodejs/node/issues/3094#issue-108564685
    nodeResponse.writeHead(400);
    nodeResponse.end("Missing Host header");
    return;
  }
  if (nodeRequest.method && !["GET"].includes(nodeRequest.method)) {
    // When a request method is received that is unrecognized or not implemented
    // by an origin server, the origin server SHOULD respond with the 501 (Not
    // Implemented) status code.  When a request method is received that is
    // known by an origin server but not allowed for the target resource, the
    // origin server SHOULD respond with the 405 (Method Not Allowed) status
    // code.
    nodeResponse.writeHead(501);
    nodeResponse.end(`Unsupported method: ${nodeRequest.method}`);
    return;
  }
  const req = new Request(nodeRequest);
  const res = new Response(nodeResponse);
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
