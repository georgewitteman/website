import { z } from "zod";
import { sql, typeSafeQuery } from "./db.js";
import crypto, { randomUUID } from "node:crypto";

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  password_hash: z.instanceof(Buffer),
  password_salt: z.instanceof(Buffer),
});

/**
 * @param {string} userId
 */
export async function getUserById(userId) {
  const [user] = await typeSafeQuery(
    sql`SELECT * FROM app_user WHERE id = ${userId}`,
    z.tuple([UserSchema]).or(z.tuple([])),
  );

  return user
    ? {
        id: user.id,
        email: user.email,
        password: { hash: user.password_hash, salt: user.password_salt },
      }
    : undefined;
}

/**
 * @param {string} email
 */
export async function getUserByEmail(email) {
  const [user] = await typeSafeQuery(
    sql`SELECT * FROM app_user WHERE email = ${email}`,
    z.tuple([UserSchema]).or(z.tuple([])),
  );

  return user
    ? {
        id: user.id,
        email: user.email,
        password: { hash: user.password_hash, salt: user.password_salt },
      }
    : undefined;
}

/**
 * https://datatracker.ietf.org/doc/id/draft-whited-kitten-password-storage-00.html#name-scrypt
 * https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/security/userpasswords.md
 * @param {string} password
 * @param {Buffer} salt
 * @returns {Promise<Buffer>}
 */
async function hashPassword(password, salt) {
  return await new Promise((resolve, reject) => {
    try {
      crypto.scrypt(
        password,
        salt,
        64,
        {
          N: 32768,
          r: 8,
          p: 1,
          maxmem: 64 * 1024 * 1024,
        },
        (err, derivedKey) => {
          if (err) {
            return reject(err);
          }
          resolve(derivedKey);
        },
      );
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * @param {{ password: { hash: Buffer, salt: Buffer }}} user
 * @param {string} password
 */
export async function validateUserPassword(user, password) {
  const inputHash = await hashPassword(password, user.password.salt);

  return crypto.timingSafeEqual(inputHash, user.password.hash);
}

/**
 * @param {Object} user
 * @param {string} user.email
 * @param {string} user.password
 * @returns {Promise<{ created: true; user: { id: string; email: string; password_hash: Buffer; password_salt: Buffer; }; } | { created: false; reason: "user_already_exists" }>}
 */
export async function createUser(user) {
  const salt = crypto.randomBytes(16);
  // https://nodejs.org/api/crypto.html#cryptopbkdf2password-salt-iterations-keylen-digest-callback
  const passwordHash = await hashPassword(user.password, salt);

  try {
    const [newUser] = await typeSafeQuery(
      sql`INSERT INTO app_user (id, email, password_hash, password_salt) VALUES (${randomUUID()}, ${
        user.email
      }, ${passwordHash}, ${salt}) RETURNING *`,
      z.tuple([UserSchema]),
    );
    return { created: true, user: newUser };
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      e.code === "23505"
    ) {
      return { created: false, reason: "user_already_exists" };
    }
    throw e;
  }
}
