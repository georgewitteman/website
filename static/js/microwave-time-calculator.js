/**
 * @param {number} seconds
 */
export function secondsToMinsSecs(seconds) {
  return {
    minutes: Math.floor(seconds / 60),
    seconds: Math.round(seconds % 60),
  };
}

/**
 * @param {number} value
 * @param {number} nanValue
 */
export function valueOrDefault(value, nanValue) {
  return typeof value !== "number" || Number.isNaN(value) ? nanValue : value;
}
