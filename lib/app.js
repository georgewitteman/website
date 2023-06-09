import { requestIdMiddleware } from "../middleware/request-id.js";
import { requestLogger } from "../middleware/request-logger.js";
import { staticHandler } from "../middleware/static.js";
import { runWithUser } from "../middleware/user.js";
import { router as authRouter } from "../routes/auth.js";
import { App } from "./AppClass.js";
import { router as migrationRouter } from "../routes/migrations.js";
import { MyResponse } from "./Response.js";

const app = new App()
  .use(requestIdMiddleware)
  .use(requestLogger)
  .use(staticHandler)
  .use(runWithUser)
  .use(migrationRouter)
  .use(authRouter)
  .use(async (req) => {
    return new MyResponse(404).body(
      `Not found: ${req.method} ${req.rawUrl.pathname}`,
    );
  });

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
export function requestListener(req, res) {
  app.handle(req, res);
}
