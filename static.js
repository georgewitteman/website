import path from "node:path";
import fs from "node:fs";
import { MyResponse } from "./Response.js";
import {
  getContentTypeFromExtension,
  isSupportedExtension,
} from "./content-type.js";
import { createHash } from "node:crypto";
import assert from "node:assert";
import querystring from "node:querystring";
import { logger } from "./logger.js";

const STATIC_PATH = path.join(process.cwd(), "./static");
const ONE_DAY_IN_SECONDS = "86400";

/**
 * @param {Buffer} buffer
 */
function hashBuffer(buffer) {
  return createHash("sha512").update(buffer).digest("hex");
}

/**
 * @param {string} path
 */
async function safeReadFile(path) {
  try {
    return await fs.promises.readFile(path);
  } catch (err) {
    // Common system errors
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      typeof err.code === "string" &&
      (err.code === "ENOENT" || err.code === "EISDIR")
    ) {
      return undefined;
    }
    throw err;
  }
}

/**
 * @param {string} staticFilename
 */
export async function getStaticPathWithHash(staticFilename) {
  const filePath = path.join(STATIC_PATH, staticFilename);
  // Security: Don't allow path traversal. I don't think this is actually
  // necessary based on my testing.
  assert(filePath.startsWith(STATIC_PATH));

  const buffer = await safeReadFile(filePath);
  assert(buffer);

  const hash = hashBuffer(buffer);
  const query = querystring.stringify({ v: hash });

  return `/${staticFilename}?${query}`;
}

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
    return {
      contentsBuffer: await fs.promises.readFile(normalizedFullFilePath),
      filePath: normalizedFullFilePath,
    };
  } catch (err) {
    // Common system errors
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      typeof err.code === "string" &&
      (err.code === "ENOENT" || err.code === "EISDIR")
    ) {
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
export async function staticHandler(req, next) {
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
  const etag = hashBuffer(fileInfo.contentsBuffer);
  const versionMatchesEtag = req.originalUrl.searchParams.get("v") === etag;

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#immutable
  const cacheControl = versionMatchesEtag
    ? `public, max-age=${ONE_DAY_IN_SECONDS}, immutable`
    : "no-cache";
  if (req.originalUrl.searchParams.has("v") && !versionMatchesEtag) {
    logger.error("Version does not match etag", {
      v: req.originalUrl.searchParams.get("v"),
      etag,
    });
  }

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match
  if (req.headers.get("If-None-Match") === etag) {
    return new MyResponse(304 /* Not Modified */, {
      "Cache-Control": cacheControl,
      ETag: etag,
      "Content-Type": getContentTypeFromExtension(extension),
    });
  }

  return new MyResponse(
    200,
    {
      "Cache-Control": cacheControl,
      ETag: etag,
      "Content-Type": getContentTypeFromExtension(extension),
    },
    fileInfo.contentsBuffer,
  );
}
