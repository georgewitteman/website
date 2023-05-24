/**
 * @typedef Logger
 * @property {(val: string) => void} debug
 * @property {(val: string) => void} info
 * @property {(val: string) => void} ok
 * @property {(val: string) => void} warn
 * @property {(val: string) => void} error
 */

/**
 * @implements Logger
 */
export class ConsoleLogger {
  /**
   * @param {string} val
   */
  debug(val) {
    console.debug(val);
  }

  /**
   * @param {string} val
   */
  info(val) {
    console.info(val);
  }

  /**
   * @param {string} val
   */
  ok(val) {
    console.info(val);
  }

  /**
   * @param {string} val
   */
  warn(val) {
    console.warn(val);
  }

  /**
   * @param {string} val
   */
  error(val) {
    console.error(val);
  }
}
