// Copied from https://github.com/gajus/http-terminator/blob/master/src/factories/createInternalHttpTerminator.ts
import http, { ServerResponse } from "node:http";
import { logger } from "./logger.js";

/**
 * @see https://github.com/sindresorhus/p-timeout/blob/main/index.js
 * @param {Promise<void>} promise
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
async function pTimeout(promise, milliseconds) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      logger.info(
        `http-terminator: pTimeout: timed out after ${milliseconds} milliseconds`,
      );
      reject(new Error(`Promise timed out after ${milliseconds} milliseconds`));
    }, milliseconds);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => {
        clearTimeout(timeout);
      });
  });
}

/**
 * @see https://github.com/sindresorhus/p-wait-for/blob/main/index.js
 * @param {() => boolean} condition
 * @param {{ interval: number; timeout: number }} options
 */
async function waitFor(condition, options) {
  const { interval, timeout } = options;

  let retryTimeout;
  let abort = false;

  /** @type {Promise<void>} */
  const promise = new Promise((resolve, reject) => {
    const check = () => {
      try {
        const value = condition();

        if (value === true) {
          resolve();
        } else if (!abort) {
          retryTimeout = setTimeout(check, interval);
        }
      } catch (error) {
        reject(error);
      }
    };

    check();
  });

  try {
    return await pTimeout(promise, timeout);
  } finally {
    abort = true;
    clearTimeout(retryTimeout);
  }
}

/**
 * @param {import("http").Server} server
 */
export function createHttpTerminator(server) {
  const configuration = {
    gracefulTerminationTimeout: 15_000,
  };

  /**
   * @type {Set<import("stream").Duplex>}
   */
  const sockets = new Set();

  /** @type {Promise<void>} */
  let terminating;

  server.on("connection", (socket) => {
    if (terminating !== undefined) {
      logger.info(
        "http-terminator: new connection initated while in the process of terminating the http server",
      );
      socket.destroy();
    } else {
      sockets.add(socket);

      socket.once("close", () => {
        sockets.delete(socket);
      });
    }
  });

  /**
   * Evaluate whether additional steps are required to destroy the socket.
   *
   * @see https://github.com/nodejs/node/blob/57bd715d527aba8dae56b975056961b0e429e91e/lib/_http_client.js#L363-L413
   * @param {import("stream").Duplex} socket
   */
  const destroySocket = (socket) => {
    logger.info("http-terminator: destroying socket");
    socket.destroy();

    sockets.delete(socket);
  };

  const terminate = async () => {
    if (terminating !== undefined) {
      logger.warn("http-terminator: already terminating HTTP server");
      return terminating;
    }

    /**
     * @type {() => void}
     */
    let resolveTerminating;
    /**
     * @type {(error: unknown) => void}
     */
    let rejectTerminating;

    terminating = new Promise((resolve, reject) => {
      resolveTerminating = resolve;
      rejectTerminating = reject;
    });

    server.on("request", (_incomingMessage, outgoingMessage) => {
      if (!outgoingMessage.headersSent) {
        // Inform connections using keep-alive that the server is shutting down
        logger.info(
          "http-terminator: setting connection: close header on outgoingMessage",
        );
        outgoingMessage.setHeader("connection", "close");
      }
    });

    for (const socket of sockets) {
      // This is the HTTP CONNECT request socket.
      if (!("server" in socket && socket.server instanceof http.Server)) {
        continue;
      }

      const serverResponse =
        "_httpMessage" in socket &&
        socket._httpMessage &&
        socket._httpMessage instanceof ServerResponse
          ? socket._httpMessage
          : undefined;

      if (serverResponse) {
        if (!serverResponse.headersSent) {
          // Inform connections using keep-alive that the server is shutting down
          logger.info(
            "http-terminator: setting connection: close header on serverResponse",
          );
          serverResponse.setHeader("connection", "close");
        }

        continue;
      }

      destroySocket(socket);
    }

    // Wait for all in-flight connections to drain, forcefully terminating any
    // open connections after the given timeout
    try {
      logger.info(`http-terminator: closing ${sockets.size} sockets`);
      await waitFor(() => sockets.size === 0, {
        interval: 10,
        timeout: configuration.gracefulTerminationTimeout,
      });
    } catch {
      // Ignore timeout errors
      logger.info(
        "http-terminator: Timed out waiting for graceful termination",
      );
    } finally {
      for (const socket of sockets) {
        destroySocket(socket);
      }
    }

    logger.info("http-terminator: Closing the server");
    server.close((error) => {
      if (error) {
        rejectTerminating(error);
        return;
      }
      resolveTerminating();
    });

    return terminating;
  };

  return {
    sockets,
    terminate,
  };
}
