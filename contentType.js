export const extensionToContentTypeHeader = /** @type {const} */ ({
  js: "application/javascript; charset=utf-8",
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  css: "text/css; charset=utf-8",
  jpg: "image/jpeg",
  ico: "image/x-icon",
  json: "application/json; charset=utf-8",
});

/**
 * @typedef {extensionToContentTypeHeader[keyof typeof extensionToContentTypeHeader]} ContentTypeHeaderValues
 */

/**
 * @param {keyof typeof extensionToContentTypeHeader} extension
 */
export function getContentTypeFromExtension(extension) {
  return extensionToContentTypeHeader[extension];
}

/**
 * @param {string} extension
 * @returns {extension is keyof typeof extensionToContentTypeHeader}
 */
export function isSupportedExtension(extension) {
  return extension in extensionToContentTypeHeader;
}
