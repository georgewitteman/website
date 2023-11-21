import { getPool } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { app } from "./lib/app.js";
import { createServer } from "http";
import { createTerminus } from "@godaddy/terminus";
import { config } from "./lib/config.js";

const PORT = 8080;

logger.info("Environment", { env: process.env });

const server = createServer(app);

/** @type {import("@godaddy/terminus").TerminusOptions} */
const options = {
  signals: ["SIGINT", "SIGTERM"],
  onSignal: async () => {
    logger.info("Server is starting cleanup 4");

    if (config.database.exists) {
      try {
        await getPool().end();
        logger.info("Successfully ended the database connection pool");
      } catch (e) {
        logger.error("Failed to end the database connection pool", e);
      }
    } else {
      logger.info("No database configured. Skipping database cleanup");
    }
  },
  onShutdown: async () => {
    logger.info("cleanup finished, server is shutting down");
  },
  logger: logger.error,
};

createTerminus(server, options);

server.listen(PORT, "0.0.0.0", () => {
  logger.info("listening on", server.address());
});
