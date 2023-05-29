export class ConsoleLogger {
  /**
   * @param {unknown[]} params
   */
  info(...params) {
    console.log(...params);
  }

  /**
   * @param {unknown[]} params
   */
  warn(...params) {
    console.warn(...params);
  }

  /**
   * @param {unknown[]} params
   */
  error(...params) {
    console.error(...params);
  }
}

export const logger = new ConsoleLogger();
