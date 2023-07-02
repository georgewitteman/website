import { z } from "zod";
import { MyResponse } from "../lib/Response.js";
import { Router } from "../lib/Router.js";
import { h, render } from "../lib/html.js";
import { documentLayout } from "../lib/layout.js";
import { sql, typeSafeQuery } from "../lib/db.js";
import crypto, { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import cookie from "cookie";

export const router = new Router();

router.get("/auth/signup", async () => {
  return new MyResponse().html(
    render(
      await documentLayout({
        title: "Sign up",
        main: [
          h("h1", {}, ["Sign Up"]),
          h("form", { method: "POST", action: "/auth/signup" }, [
            h("label", {}, [
              "Email",
              h("input", { name: "email", type: "email" }),
            ]),
            h("label", {}, [
              "Password",
              h("input", { name: "password", type: "password" }),
            ]),
            h("button", { type: "submit" }, ["Sign Up"]),
          ]),
        ],
      }),
    ),
  );
});

router.post("/auth/signup", async (req) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string(),
    })
    .parse(await req.body());

  const salt = crypto.randomBytes(16);
  // https://nodejs.org/api/crypto.html#cryptopbkdf2password-salt-iterations-keylen-digest-callback
  const password = await promisify(crypto.pbkdf2)(
    body.password,
    salt,
    100000,
    64,
    "sha512",
  );

  await typeSafeQuery(
    sql`INSERT INTO app_user (email, password_hash, password_salt) VALUES (${body.email}, ${password}, ${salt}) RETURNING *`,
    z.tuple([z.object({ id: z.number() })]),
  );

  return MyResponse.redirectFound("/auth/signin");
});

router.get("/auth/signin", async () => {
  return new MyResponse().html(
    render(
      await documentLayout({
        title: "Sign in",
        main: [
          h("h1", {}, ["Sign in"]),
          h("form", { method: "POST", action: "/auth/signin" }, [
            h("label", {}, [
              "Email",
              h("input", { name: "email", type: "email" }),
            ]),
            h("label", {}, [
              "Password",
              h("input", { name: "password", type: "password" }),
            ]),
            h("button", { type: "submit" }, ["Sign in"]),
          ]),
        ],
      }),
    ),
  );
});

router.post("/auth/signin", async (req) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string(),
    })
    .parse(await req.body());

  const [user] = await typeSafeQuery(
    sql`SELECT * FROM app_user WHERE email = ${body.email}`,
    z.tuple([
      z.object({
        id: z.number(),
        email: z.string(),
        password_hash: z.instanceof(Buffer),
        password_salt: z.instanceof(Buffer),
      }),
    ]),
  );

  // https://nodejs.org/api/crypto.html#cryptopbkdf2password-salt-iterations-keylen-digest-callback
  const inputHash = await promisify(crypto.pbkdf2)(
    body.password,
    user.password_salt,
    100000,
    64,
    "sha512",
  );

  if (!crypto.timingSafeEqual(inputHash, user.password_hash)) {
    throw new Error("Wrong password");
  }

  const expires = new Date();
  expires.setHours(expires.getHours() + 1);
  const [session] = await typeSafeQuery(
    sql`INSERT INTO session (id, user_id, expires_at) VALUES (${randomUUID()}, ${
      user.id
    }, ${expires}) RETURNING *`,
    z.tuple([z.object({ id: z.string() })]),
  );

  return MyResponse.redirectFound(`/auth/profile/${user.id}`).header(
    "Set-Cookie",
    cookie.serialize("id", session.id, {
      expires,
      httpOnly: true,
      path: "/auth",
      sameSite: "strict",
      secure: true,
    }),
  );
});

router.get("/auth/profile/:id", async (req, params) => {
  const sessionId = req.cookies.id;
  const { id } = z.object({ id: z.string() }).parse(params);
  const userId = z.number().safe().parse(parseInt(id, 10));

  if (!sessionId) {
    return MyResponse.redirectFound("/auth/signin");
  }

  const [session] = await typeSafeQuery(
    sql`SELECT * FROM session WHERE id = ${sessionId}`,
    z
      .tuple([
        z.object({ id: z.string(), user_id: z.number(), expires_at: z.date() }),
      ])
      .or(z.tuple([])),
  );

  if (
    !session ||
    session.user_id !== userId ||
    new Date() > session.expires_at
  ) {
    return MyResponse.redirectFound("/auth/signin");
  }

  const [user] = await typeSafeQuery(
    sql`SELECT * FROM app_user WHERE id = ${userId}`,
    z.tuple([
      z.object({
        id: z.number(),
        email: z.string(),
        password_hash: z.instanceof(Buffer),
        password_salt: z.instanceof(Buffer),
      }),
    ]),
  );

  return new MyResponse().html(
    render(
      await documentLayout({
        title: `Profile: ${user.email}`,
        main: [
          h("h1", {}, [user.email]),
          h("dl", {}, [
            h("dt", {}, ["id"]),
            h("dd", {}, [user.id.toString()]),
            h("dt", {}, ["email"]),
            h("dd", {}, [user.email]),
            h("dt", {}, ["password_salt"]),
            h("dd", {}, [user.password_salt.toString("hex")]),
            h("dt", {}, ["password_hash"]),
            h("dd", {}, [user.password_hash.toString("hex")]),
          ]),
        ],
      }),
    ),
  );
});
