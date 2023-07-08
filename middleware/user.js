import { getSession } from "../lib/session.js";
import { getUserById } from "../lib/user.js";

/**
 * @param {string} sessionId
 */
async function safeGetSession(sessionId) {
  try {
    return await getSession(sessionId);
  } catch (e) {
    // https://www.postgresql.org/docs/15/errcodes-appendix.html
    if (typeof e === "object" && e && "code" in e && e.code === "42P01") {
      // Skip this when the table does not exist
      return undefined;
    }
    throw e;
  }
}

/**
 * @param {import("../lib/Request.js").MyRequest} req
 * @param {() => Promise<import("../lib/Response.js").MyResponse>} next
 * @returns {Promise<import("../lib/Response.js").MyResponse>}
 */
export async function runWithUser(req, next) {
  if (req.user) {
    return await next();
  }

  const sessionId = req.cookies.id;
  if (!sessionId) {
    return await next();
  }
  const session = await safeGetSession(sessionId);
  if (!session || !session.isValid()) {
    return await next();
  }

  req.session = session;

  const user = await getUserById(session.userId);
  if (!user) {
    return await next();
  }

  req.user = user;

  return await next();
}
