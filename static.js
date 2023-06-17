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
function md5Buffer(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}

/**
 * @param {string} staticFilename
 */
export async function getStaticPathWithHash(staticFilename) {
  const fileInfo = await getStaticFile(staticFilename);
  assert(fileInfo);

  const query = querystring.stringify({ v: fileInfo.md5 });
  return `/${staticFilename}?${query}`;
}

/**
 * https://developer.mozilla.org/en-US/docs/Learn/Server-side/Node_server_without_framework
 * @param {string} pathname
 */
async function getStaticFile(pathname) {
  const normalizedFullFilePath = path.join(STATIC_PATH, pathname);
  if (!normalizedFullFilePath.startsWith(STATIC_PATH)) {
    // Security: Don't allow path traversal. I don't think this is actually
    // necessary based on my testing.
    return undefined;
  }
  try {
    const contentsBuffer = await fs.promises.readFile(normalizedFullFilePath);
    return {
      contentsBuffer,
      stat: await fs.promises.stat(normalizedFullFilePath),
      md5: md5Buffer(contentsBuffer),
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

  const fileInfo = await getStaticFile(pathname);
  if (!fileInfo) {
    return next();
  }

  // https://github.com/jshttp/mime-types https://github.com/broofa/mime
  // https://github.com/jshttp/mime-db
  const extension = path.extname(fileInfo.filePath).substring(1).toLowerCase();
  if (!isSupportedExtension(extension)) {
    return next();
  }
  const etag = fileInfo.md5;
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
      "Last-Modified": fileInfo.stat.mtime,
      ETag: etag,
      "Content-Type": getContentTypeFromExtension(extension),
    });
  }

  return new MyResponse(
    200,
    {
      "Cache-Control": cacheControl,
      "Last-Modified": fileInfo.stat.mtime,
      ETag: etag,
      "Content-Type": getContentTypeFromExtension(extension),
    },
    fileInfo.contentsBuffer,
  );
}
