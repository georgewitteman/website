import { MyResponse } from "../lib/Response.js";
import { h, render } from "../lib/html.js";
import { documentLayout } from "../lib/layout.js";
import cookie from "cookie";
import { createSession, expireSession } from "../lib/session.js";
import {
  createUser,
  getUserByEmail,
  validateUserPassword,
} from "../lib/user.js";
import { config } from "../lib/config.js";
import { createRoute } from "../lib/route.js";
import { z } from "zod";
import { getCurrentUser } from "../middleware/user.js";

/**
 * @type {import("../lib/route.js").Route[]}
 */
export const routes = [];

routes.push(
  createRoute("GET", "/auth/signup", async () => {
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
  }),
);

routes.push(
  createRoute("POST", "/auth/signup", async (req) => {
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
  }),
);

routes.push(
  createRoute("GET", "/auth/signin", async () => {
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
  }),
);

routes.push(
  createRoute("POST", "/auth/signin", async (req) => {
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
  }),
);

routes.push(
  createRoute("GET", "/auth/profile", async () => {
    const user = getCurrentUser();
    if (!user) {
      return new MyResponse().status(401).body("Not signed in");
    }

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
              h("dd", {}, [user.password.salt.toString("hex")]),
              h("dt", {}, ["password_hash"]),
              h("dd", {}, [user.password.hash.toString("hex")]),
            ]),
          ],
        }),
      ),
    );
  }),
);

routes.push(
  createRoute("GET", "/auth/logout", async (req) => {
    const redirectUrl = "/auth/signin";
    const sessionId = req.cookies.id;
    if (!sessionId) {
      return MyResponse.redirectFound(redirectUrl);
    }
    await expireSession(sessionId);

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
  }),
);
