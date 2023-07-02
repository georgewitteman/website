import { getRequestId } from "../middleware/request-id.js";
import { stringify } from "safe-stable-stringify";

/** @typedef {"debug" | "info" | "warn" | "error"} LogLevel */

/**
 * https://github.com/winstonjs/winston/blob/0ed765097dd1f67c7bcaf7e6383f2a3a98e71d9e/index.d.ts#L73
 * https://github.com/winstonjs/winston/blob/0ed765097dd1f67c7bcaf7e6383f2a3a98e71d9e/index.d.ts#L79
 * @typedef {{level: LogLevel; message: unknown; [key: string]: unknown}} LogRecord
 */

/**
 * @param {unknown} data
 * @returns {string}
 */
function castToString(data) {
  if (typeof data === "string") {
    return data;
  }
  return stringify(data) ?? "";
}

class Transport {
  /**
   * @param {LogRecord} data
   */
  write(data) {
    if (
      "level" in data &&
      typeof data.level === "string" &&
      ["warn", "error"].includes(data.level)
    ) {
      process.stderr.write(stringify(data));
      process.stderr.write("\n");
      return;
    }
    process.stdout.write(stringify(data));
    process.stdout.write("\n");
  }
}

class Logger {
  /** @type {{write: (data: LogRecord) => void}} */
  #transport;

  /**
   *
   * @param {{write: (data: LogRecord) => void}} transport
   */
  constructor(transport) {
    this.#transport = transport;
  }

  /**
   * @param {LogLevel} level
   * @param {unknown} [message]
   * @param {unknown} [meta]
   */
  #log(level, message, meta) {
    // https://github.com/winstonjs/winston/blob/0ed765097dd1f67c7bcaf7e6383f2a3a98e71d9e/lib/winston/logger.js#L207
    if (meta === undefined) {
      if (
        message &&
        typeof message === "object" &&
        "message" in message &&
        message.message
      ) {
        this.#transport.write({ level, ...message, requestId: getRequestId() });
        return;
      }

      this.#transport.write({
        level,
        message,
        requestId: getRequestId(),
      });
      return;
    }

    if (typeof meta === "object" && meta !== null) {
      /** @type {LogRecord} */
      const info = {
        ...meta,
        level,
        message,
        requestId: getRequestId(),
      };

      if ("message" in meta && meta.message) {
        info.message = `${castToString(info.message)} ${castToString(
          meta.message,
        )}`;
      }
      if ("stack" in meta && meta.stack) {
        info.stack = meta.stack;
      }

      this.#transport.write(info);
      return;
    }

    this.#transport.write({
      level,
      message,
      requestId: getRequestId(),
    });
  }

  /**
   * @param {unknown[]} params
   */
  info(...params) {
    this.#log("info", ...params);
  }

  /**
   * @param {unknown[]} params
   */
  warn(...params) {
    this.#log("warn", ...params);
  }

  /**
   * @param {unknown[]} params
   */
  error(...params) {
    this.#log("error", ...params);
  }
}

export const logger = new Logger(new Transport());
