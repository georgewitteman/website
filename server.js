import { getPool } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { requestListener } from "./lib/app.js";
import { createServer } from "node:http";

const PORT = 8080;

logger.info("Environment", { env: process.env });

const server = createServer(requestListener).listen(PORT, "0.0.0.0", () => {
  logger.info("listening on", server.address());
});

let forceClose = false;

/**
 * @param {string} signal
 */
function shutdown(signal) {
  if (forceClose) {
    logger.info("Forcing exit");
    process.exit(1);
  }
  forceClose = true;
  logger.info(`signal ${signal}`);

  // https://nodejs.org/docs/latest-v18.x/api/net.html#serverclosecallback
  server.close((err) => {
    if (err) {
      logger.error(err);
      return;
    }
    logger.info("Successfully shut down server");

    getPool().end(() => {
      logger.info("Pool closed");
    });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
