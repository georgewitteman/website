export const AMAZON_URL = "https://amzn.com/dp/";
export const AMAZON_LONG_URL = "https://www.amazon.com/dp/";
export const ASIN_REGEX = /\/([A-Z0-9]{10})/;

/**
 * @param {string} longUrl
 * @returns
 */
export function getAsin(longUrl) {
  let asin = longUrl.match(ASIN_REGEX);
  if (!asin || asin.length < 1) {
    return null;
  }
  return asin[1];
}
