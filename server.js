import { getPool } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { createHttpTerminator } from "./lib/http-terminator.js";
import path from "node:path"
import Fastify from 'fastify'
import fastifyStatic from "@fastify/static"
import fastifyCookie from "@fastify/cookie"
import fastifySession from "@fastify/session";
import { PostgreSQLSessionStore } from "./lib/session-store.js";
import { getUserByEmail } from "./lib/user.js";
import { randomUUID } from "node:crypto";

const PORT = 8080;

logger.info("Environment", { env: process.env });

const fastify = Fastify({
  logger: true
})

fastify.listen({port: PORT, host: "0.0.0.0"})
fastify.register(fastifyCookie)
fastify.register(fastifySession, {secret: "TODOTODOTODOTODOTODOTODOTODOTODOTODOTODOTODOTODOTODOTODOTODO", cookieName: "id", store: new PostgreSQLSessionStore(), idGenerator: () => randomUUID()})
fastify.register(fastifyStatic, {root: path.join(path.dirname(import.meta.url.replace("file:", "")), "static")})
fastify.get("/session", async (req) => {
  console.log(req.session.cookie)
  console.log(req.session.sessionId, req.session.get("user_id"))
  if (!req.session.get("user_id")) {
    const user = await getUserByEmail("george@witteman.me")
    req.session.user_id = user?.id;
    req.session.set("user_id", user?.id)
  }
  // await req.session.save();
  return {sessionId: req.session.sessionId, encryptedSessionId: req.session.encryptedSessionId, session: req.session}
})

const httpTerminator = createHttpTerminator(fastify.server);

let forceClose = false;

/**
 * @param {string} signal
 */
async function shutdownInner(signal) {
  if (forceClose) {
    logger.info("Forcing exit");
    process.exit(1);
  }
  forceClose = true;
  logger.info(`signal ${signal}`);

  // https://nodejs.org/docs/latest-v18.x/api/net.html#serverclosecallback
  try {
    await httpTerminator.terminate();
    logger.info("Successfully terminated the server");
  } catch (e) {
    logger.error("Failed to terminate the server", e);
  }

  try {
    await getPool().end();
    logger.info("Successfully ended the database connection pool");
  } catch (e) {
    logger.error("Failed to end the database connection pool", e);
  }
}

/**
 * @param {string} signal
 */
function shutdownOuter(signal) {
  shutdownInner(signal);
}

process.on("SIGINT", shutdownOuter);
process.on("SIGTERM", shutdownOuter);
