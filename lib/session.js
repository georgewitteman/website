import { z } from "zod";
import { sql, typeSafeQuery } from "./db.js";
import { randomUUID } from "node:crypto";

export const SessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  expires_at: z.date(),
});

export class Session {
  /**
   *
   * @param {{ id: string, userId: string, expiresAt: Date }} session
   */
  constructor(session) {
    this.id = session.id;
    this.userId = session.userId;
    this.expiresAt = session.expiresAt;
  }

  /**
   * @param {z.infer<typeof SessionSchema>} session
   */
  static fromDatabase(session) {
    return new Session({
      id: session.id,
      userId: session.user_id,
      expiresAt: session.expires_at,
    });
  }

  isValid() {
    return new Date() < this.expiresAt;
  }
}

/**
 * @param {string} userId
 */
export async function createSession(userId) {
  const expires = new Date();
  expires.setHours(expires.getHours() + 1);
  const [session] = await typeSafeQuery(
    sql`INSERT INTO session (id, user_id, expires_at) VALUES (${randomUUID()}, ${userId}, ${expires}) RETURNING *`,
    z.tuple([SessionSchema]),
  );
  return Session.fromDatabase(session);
}

/**
 * @param {string} sessionId
 */
export async function getSession(sessionId) {
  const [session] = await typeSafeQuery(
    sql`SELECT * FROM session WHERE id = ${sessionId}`,
    z.tuple([SessionSchema]).or(z.tuple([])),
  );
  return session ? Session.fromDatabase(session) : undefined;
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
    session.userId === userId &&
    new Date() < session.expiresAt
  );
}
