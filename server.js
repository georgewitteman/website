import { App } from "./lib/App.js";
import { getPool } from "./lib/db.js";
import { router as echoRouter } from "./routes/echo.js";
import { router as databaseRouter } from "./routes/database.js";
import { router as migrationsRouter } from "./routes/migrations.js";
import { router as authRouter } from "./routes/auth.js";
import { logger } from "./lib/logger.js";
import { requestIdMiddleware } from "./middleware/request-id-middleware.js";
import { staticHandler } from "./middleware/static.js";
import { requestLogger } from "./middleware/request-logger.js";
import { notFound } from "./middleware/not-found.js";

const PORT = 8080;

const app = new App();
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(staticHandler);
app.use(echoRouter.middleware());
app.use(migrationsRouter.middleware());
app.use(databaseRouter.middleware());
app.use(authRouter.middleware());
app.use(notFound);

logger.info("Environment", { env: process.env });

const server = app.createServer().listen(PORT, "0.0.0.0", () => {
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
