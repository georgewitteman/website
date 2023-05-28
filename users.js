import { MyResponse } from "./Response.js";
import { sql, typeSafeQuery } from "./db.js";
import { html } from "./html.js";
import { z } from "./zod.js";

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<MyResponse>} next
 * @returns {Promise<MyResponse>}
 */
export async function getSignup(req, next) {
  if (req.rawUrl.pathname !== "/signup" || req.method !== "GET") {
    return next();
  }
  return new MyResponse(
    200,
    { "Content-Type": "text/html; charset=utf-8" },
    html`<!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Sign Up</title>
        </head>
        <body>
          <form method="post" action="/signup">
            <label>Email <input type="email" name="email" /> </label>
            <button type="submit">Sign Up</button>
          </form>
        </body>
      </html>`
  );
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<MyResponse>} next
 * @returns {Promise<MyResponse>}
 */
export async function postSignup(req, next) {
  if (req.rawUrl.pathname !== "/signup" || req.method !== "POST") {
    return next();
  }
  const body = await req.body();
  const parsedBody = z.object({ email: z.string() }).unsafeParse(body);
  const result = await typeSafeQuery(
    sql`INSERT INTO app_user (email) VALUES (${parsedBody.email}) RETURNING *`,
    z.array(z.object({ id: z.number(), email: z.string() })).length(1)
  );
  return new MyResponse(302, { Location: `/user/${result[0].id}` }, "");
}

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<MyResponse>} next
 * @returns {Promise<MyResponse>}
 */
export async function getUser(req, next) {
  if (req.method !== "GET") {
    return next();
  }
  if (!req.rawUrl.pathname.startsWith("/user/")) {
    return next();
  }
  const result = await typeSafeQuery(
    sql`SELECT id, email FROM app_user WHERE id = ${
      req.rawUrl.pathname.split("/")[2]
    }`,
    z.array(z.object({ id: z.number(), email: z.string() })).length(1)
  );
  return MyResponse.json(200, {}, result[0]);
}
