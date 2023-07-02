/**
 * @param {boolean} value
 * @returns {asserts value}
 */
export function assert(value) {
  if (!value) {
    throw new Error("Assertion error");
  }
}
