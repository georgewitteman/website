import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { sql, typeSafeQuery } from "../db.js";
import { html } from "../html.js";
import { z } from "../zod.js";

export const router = new Router();

router.get("/signup", async () => {
  return new MyResponse().html(
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
      </html>`,
  );
});

router.post("/signup", async (req) => {
  const body = await req.body();
  const parsedBody = z.object({ email: z.string() }).unsafeParse(body);
  const result = await typeSafeQuery(
    sql`INSERT INTO app_user (email) VALUES (${parsedBody.email}) RETURNING *`,
    z.array(z.object({ id: z.number(), email: z.string() })).length(1),
  );
  return MyResponse.redirectFound(`/user/${result[0].id}`);
});

router.get("/user/:userId", async (_, params) => {
  const userIdString = params.userId;
  if (!userIdString) {
    return new MyResponse(404).json({
      code: "NOT_FOUND",
      id: userIdString ?? null,
    });
  }
  const userId = parseInt(userIdString, 10);
  if (!Number.isInteger(userId)) {
    return new MyResponse(404).json({ code: "NOT_FOUND", id: userIdString });
  }
  const result = await typeSafeQuery(
    sql`SELECT id, email FROM app_user WHERE id = ${userId}`,
    z.array(z.object({ id: z.number(), email: z.string() })).max(1),
  );
  if (!result[0]) {
    return new MyResponse(404).json({ code: "NOT_FOUND", id: userId });
  }
  return new MyResponse().json(result[0]);
});
