import { MyResponse } from "../lib/response.js";
import { h, render } from "../lib/html.js";
import { documentLayout } from "../views/layout.js";
import cookie from "cookie";
import { createSession, expireSession } from "../lib/session.js";
import {
  createUser,
  getUserByEmail,
  validateUserPassword,
} from "../lib/user.js";
import { config } from "../lib/config.js";
import { z } from "zod";
import { Router } from "../lib/router.js";

export const router = new Router();

router.get("/auth/signup", async () => {
  return new MyResponse().html(
    render(
      await documentLayout({
        user: undefined,
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
  const { email, password } = z
    .object({
      email: z.string().email(),
      password: z.string(),
    })
    .parse(await req.body());
  const result = await createUser({ email, password });
  if (!result.created) {
    return new MyResponse().status(400).body(result.reason);
  }

  return MyResponse.redirectFound("/auth/signin");
});

router.get("/auth/signin", async () => {
  return new MyResponse().html(
    render(
      await documentLayout({
        user: undefined,
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
  const { email, password } = z
    .object({
      email: z.string().email(),
      password: z.string(),
    })
    .parse(await req.body());
  const user = await getUserByEmail(email);

  if (!user) {
    return new MyResponse()
      .status(404)
      .body("Unable to find a user for this email");
  }

  const isValid = await validateUserPassword(user, password);
  if (!isValid) {
    return new MyResponse().status(401).body("Invalid password");
  }

  const session = await createSession(user.id);

  return MyResponse.redirectFound(`/auth/profile`).header(
    "Set-Cookie",
    cookie.serialize("id", session.id, {
      expires: session.expiresAt,
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: config.session.secure,
    }),
  );
});

router.get("/auth/profile", async (req) => {
  const user = req.user;
  if (!user) {
    return new MyResponse().status(401).body("Not signed in");
  }

  return new MyResponse().html(
    render(
      await documentLayout({
        user,
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

router.get("/auth/logout", async (req) => {
  const redirectUrl = "/auth/signin";
  if (!req.session) {
    return MyResponse.redirectFound(redirectUrl);
  }
  await expireSession(req.session.id);

  req.session = undefined;

  const newExpiration = new Date();
  newExpiration.setHours(newExpiration.getHours() - 1);

  return MyResponse.redirectFound(redirectUrl).header(
    "Set-Cookie",
    cookie.serialize("id", "", {
      expires: newExpiration,
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: config.session.secure,
    }),
  );
});
