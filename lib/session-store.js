import { getSession, createSessionWithId, expireSession } from "./session.js"
import util from "node:util"

/**
 * @typedef {import("@fastify/session").SessionStore} SessionStore
 */

/**
 * https://github.com/voxpelli/node-connect-pg-simple/blob/main/index.js
 * @implements {SessionStore}
 */
export class PostgreSQLSessionStore {
  /**
   *
   * @param {string} sessionId
   * @param {(err?: unknown, result?: import("fastify").Session | null) => void} callback
   */
  get(sessionId, callback) {
    util.callbackify(getSession)(sessionId, callback);
  }

  /**
   *
   * @param {string} sessionId
   * @param {import("fastify").Session} session
   * @param {(err: unknown) => void} callback
   */
  set(sessionId, session, callback) {
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);
    util.callbackify(createSessionWithId)(sessionId, session.user_id, expires, session.cookie, callback);
  }

  /**
   *
   * @param {string} sessionId
   * @param {(err?: unknown) => void} callback
   */
  destroy(sessionId, callback) {
    util.callbackify(expireSession)(sessionId, callback)
  }
}
