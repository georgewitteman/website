import { MyResponse } from "./Response.js";
import { Router } from "./Router.js";
import { sql, typeSafeQuery } from "./db.js";
import { html } from "./html.js";
import { z } from "./zod.js";

export const router = new Router();

router.get("/signup", async () => {
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
});

router.post("/signup", async (req) => {
  const body = await req.body();
  const parsedBody = z.object({ email: z.string() }).unsafeParse(body);
  const result = await typeSafeQuery(
    sql`INSERT INTO app_user (email) VALUES (${parsedBody.email}) RETURNING *`,
    z.array(z.object({ id: z.number(), email: z.string() })).length(1)
  );
  return new MyResponse(302, { Location: `/user/${result[0].id}` }, "");
});

router.get("/user/:userId", async (req) => {
  const result = await typeSafeQuery(
    sql`SELECT id, email FROM app_user WHERE id = ${
      req.rawUrl.pathname.split("/")[2]
    }`,
    z.array(z.object({ id: z.number(), email: z.string() })).max(1)
  );
  if (typeof result[0] === "undefined") {
    throw new Error("Expected at most 1 row");
  }
  return MyResponse.json(200, {}, result[0]);
});
