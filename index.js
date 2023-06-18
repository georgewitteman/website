import { MyResponse } from "./Response.js";
import { App } from "./App.js";
import { getPool, sql, typeSafeQuery } from "./db.js";
import { z } from "./zod.js";
import { html } from "./html.js";
import { router as usersRouter } from "./routes/users.js";
import { router as echoRouter } from "./routes/echo.js";
import { router as oldRouter } from "./routes/old.js";
import { router as databaseRouter } from "./routes/database.js";
import { router as migrationsRouter } from "./routes/migrations.js";
import { router as stuffRouter } from "./routes/stuff.js";
import { router as cssRouter } from "./routes/css.js";
import { testRoutes } from "./Router.js";
import { logger } from "./logger.js";
import { documentLayout } from "./layout.js";
import { requestIdMiddleware } from "./request-id-middleware.js";
import { staticHandler } from "./static.js";

const PORT = 8080;

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<MyResponse>} next
 * @returns {Promise<MyResponse>}
 */
async function now(req, next) {
  if (req.rawUrl.pathname !== "/now") {
    return next();
  }
  const result = await typeSafeQuery(
    sql`SELECT NOW(), VERSION()`,
    z.array(z.object({ now: z.date(), version: z.string() })).length(1),
  );
  return new MyResponse().html(
    documentLayout({
      title: result[0].now.toLocaleString(),
      main: html`
        <ul>
          ${Object.entries(result[0]).map(
            ([key, value]) =>
              html`
                <li>
                  <strong><code>${key}</code>:</strong>
                  <code
                    >${value instanceof Date ? value.toString() : value}</code
                  >
                </li>
              `,
          )}
        </ul>
        <pre class="overflow-x-auto"><code>${JSON.stringify(
          result,
          null,
          2,
        )}</code></pre>
        <code>${'<script>alert("unsafe html test")</script>'}</code>
      `,
    }),
  );
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @returns {Promise<MyResponse>}
 */
async function notFound(req) {
  return new MyResponse(404).body(
    `Not found: ${req.method} ${req.originalUrl.href}\n`,
  );
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {MyResponse | undefined} res
 * @param {bigint} startTimeNs
 */
function logResponse(req, res, startTimeNs) {
  const durationNs = process.hrtime.bigint() - startTimeNs;
  const durationMs = durationNs / 1_000_000n;
  logger.info(
    `${req.method} ${req.originalUrl.href} ${
      res?.statusCode ?? "<no status code>"
    } ${res?.statusMessage ?? "<no status message>"} ${durationMs}ms`,
    {
      method: req.method,
      statusCode: res?.statusCode,
      statusMessage: res?.statusMessage,
      durationMs,
      originalUrl: req.originalUrl,
      rawUrl: req.rawUrl,
      httpVersion: req.httpVersion,
      headers: req.headers,
    },
  );
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<MyResponse>} next
 */
async function requestLogger(req, next) {
  const startNs = process.hrtime.bigint();
  try {
    const res = await next();
    logResponse(req, res, startNs);
    return res;
  } catch (err) {
    logger.error(err);
    logResponse(req, undefined, startNs);
    throw err;
  }
}

const app = new App();
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(staticHandler);
app.use(now);
app.use(usersRouter.middleware());
app.use(testRoutes.middleware());
app.use(oldRouter.middleware());
app.use(echoRouter.middleware());
app.use(migrationsRouter.middleware());
app.use(databaseRouter.middleware());
app.use(stuffRouter.middleware());
app.use(cssRouter.middleware());
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
