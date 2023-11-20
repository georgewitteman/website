import { getPool } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { app } from "./lib/app.js";
import { createServer } from "http";
import { createTerminus } from "@godaddy/terminus";

const PORT = 8080;

logger.info("Environment", { env: process.env });

const server = createServer(app);

/** @type {import("@godaddy/terminus").TerminusOptions} */
const options = {
  onSignal: async () => {
    logger.info("Server is starting cleanup");

    try {
      await getPool().end();
      logger.info("Successfully ended the database connection pool");
    } catch (e) {
      logger.error("Failed to end the database connection pool", e);
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

// const httpTerminator = createHttpTerminator(server);

// let forceClose = false;

// /**
//  * @param {string} signal
//  */
// async function shutdownInner(signal) {
//   if (forceClose) {
//     logger.info("Forcing exit");
//     process.exit(1);
//   }
//   forceClose = true;
//   logger.info(`signal ${signal}`);

//   // https://nodejs.org/docs/latest-v18.x/api/net.html#serverclosecallback
//   try {
//     await httpTerminator.terminate();
//     logger.info("Successfully terminated the server");
//   } catch (e) {
//     logger.error("Failed to terminate the server", e);
//   }

//   try {
//     await getPool().end();
//     logger.info("Successfully ended the database connection pool");
//   } catch (e) {
//     logger.error("Failed to end the database connection pool", e);
//   }
// }

// /**
//  * @param {string} signal
//  */
// function shutdownOuter(signal) {
//   shutdownInner(signal);
// }

// process.on("SIGINT", shutdownOuter);
// process.on("SIGTERM", shutdownOuter);
