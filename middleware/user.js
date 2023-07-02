import { AsyncLocalStorage } from "node:async_hooks";
import { getSession } from "../lib/session.js";
import { getUserById } from "../lib/user.js";

/** @type {AsyncLocalStorage<{ id: string; email: string; password: { hash: Buffer; salt: Buffer } }>} */
const asyncLocalStorage = new AsyncLocalStorage();

export function getCurrentUser() {
  return asyncLocalStorage.getStore();
}

/**
 * @param {import("../lib/Request.js").MyRequest} req
 * @param {() => Promise<import("../lib/Response.js").MyResponse>} next
 * @returns {Promise<import("../lib/Response.js").MyResponse>}
 */
export async function runWithUser(req, next) {
  const sessionId = req.cookies.id;
  if (!sessionId) {
    return await next();
  }
  const session = await getSession(sessionId);
  if (!session || !session.isValid()) {
    return await next();
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return await next();
  }

  return asyncLocalStorage.run(user, async () => {
    return await next();
  });
}
