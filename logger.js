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

export class CloudWatchLogger {
  /**
   * @param {unknown[]} params
   */
  info(...params) {
    process.stdout.write(JSON.stringify([getRequestId(), ...params]));
    process.stdout.write("\n");
  }

  /**
   * @param {unknown[]} params
   */
  warn(...params) {
    process.stderr.write(JSON.stringify([getRequestId(), ...params]));
    process.stderr.write("\n");
  }

  /**
   * @param {unknown[]} params
   */
  error(...params) {
    process.stderr.write(JSON.stringify([getRequestId(), ...params]));
    process.stderr.write("\n");
  }
}

export const logger =
  process.env.AWS_EXECUTION_ENV === "AWS_ECS_FARGATE"
    ? new CloudWatchLogger()
    : new ConsoleLogger();
