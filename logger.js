import { getRequestId } from "./request-id-middleware.js";

export class ConsoleLogger {
  /**
   * @param {unknown[]} params
   */
  info(...params) {
    console.log(getRequestId(), ...params);
  }

  /**
   * @param {unknown[]} params
   */
  warn(...params) {
    console.warn(getRequestId(), ...params);
  }

  /**
   * @param {unknown[]} params
   */
  error(...params) {
    console.error(getRequestId(), ...params);
  }
}

export const logger = new ConsoleLogger();
