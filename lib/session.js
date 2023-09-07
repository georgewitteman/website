import { z } from "zod";
import { sql, typeSafeQuery } from "./db.js";

export const SessionSchema = z.object({
  id: z.string(),
  user_id: z.string().optional(),
  expires_at: z.date(),
  cookie: z.object({
    originalMaxAge: z.number().nullish(),
    maxAge: z.number().nullish(),
    signed: z.boolean().nullish(),
    expires: z.date().nullish(),
    httpOnly: z.boolean().nullish(),
    path: z.string().nullish(),
    domain: z.string().nullish(),
    secure: z.union([z.boolean(), z.literal("auto")]).nullish(),
    sameSite: z.union([z.boolean(), z.literal("lax"), z.literal("strict"), z.literal("none")]).nullish(),
  })
});

/**
 * @param {string} id
 * @param {string | undefined} userId
 * @param {Date} expires
 * @param {z.infer<typeof SessionSchema>["cookie"]} cookie
 */
export async function createSessionWithId(id, userId, expires, cookie) {
  const [session] = await typeSafeQuery(
    sql`INSERT INTO session (id, user_id, expires_at, cookie) VALUES (${id}, ${userId}, ${expires}, ${cookie}) RETURNING *`,
    z.tuple([SessionSchema]),
  );
  return session
}

/**
 * @param {string} sessionId
 */
export async function getSession(sessionId) {
  try {
    const [session] = await typeSafeQuery(
      sql`SELECT * FROM session WHERE id = ${sessionId} and expires_at >= ${new Date()}`,
      z.tuple([SessionSchema]).or(z.tuple([])),
    );
    return session;
  } catch (e) {
    console.error(e)
    throw e
  }
}

/**
 * @param {string} sessionId
 */
export async function expireSession(sessionId) {
  await typeSafeQuery(
    sql`DELETE FROM session WHERE id = ${sessionId}`,
    z.array(z.unknown()),
  );
}

/**
 * @param {string | null | undefined} sessionId
 * @param {string} userId
 */
export async function checkSession(sessionId, userId) {
  if (!sessionId) {
    return false;
  }

  const session = await getSession(sessionId);

  return (
    typeof session === "object" &&
    session.user_id === userId &&
    new Date() < session.expires_at
  );
}
