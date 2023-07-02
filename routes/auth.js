import { MyResponse } from "../lib/Response.js";
import { h, render } from "../lib/html.js";
import { documentLayout } from "../lib/layout.js";
import cookie from "cookie";
import { checkSession, createSession, expireSession } from "../lib/session.js";
import {
  createUser,
  getUserByEmail,
  getUserById,
  validateUserPassword,
} from "../lib/user.js";
import { config } from "../lib/config.js";

export async function getSignup() {
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
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function postSignup(email, password) {
  const result = await createUser({ email, password });
  if (!result.created) {
    return new MyResponse().status(400).body(result.reason);
  }

  return MyResponse.redirectFound("/auth/signin");
}

export async function getSignIn() {
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
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function postSignIn(email, password) {
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

  return MyResponse.redirectFound(`/auth/profile/${user.id}`).header(
    "Set-Cookie",
    cookie.serialize("id", session.id, {
      expires: session.expiresAt,
      httpOnly: true,
      path: "/auth",
      sameSite: "strict",
      secure: config.session.secure,
    }),
  );
}

/**
 * @param {string | null | undefined} sessionId
 * @param {string} userId
 */
export async function getUserProfile(sessionId, userId) {
  if (!(await checkSession(sessionId, userId))) {
    return new MyResponse()
      .status(401)
      .body(`Invalid session: ${sessionId ?? typeof sessionId}`);
  }

  const user = await getUserById(userId);

  if (!user) {
    return new MyResponse().status(404).body("Invalid user");
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
}

/**
 * @param {string | undefined} sessionId
 * @param {string} redirectUrl
 */
export async function getLogOut(sessionId, redirectUrl) {
  if (!sessionId) {
    return MyResponse.redirectFound(redirectUrl);
  }
  await expireSession(sessionId);

  const newExpiration = new Date();
  newExpiration.setHours(newExpiration.getHours() + 1);

  return MyResponse.redirectFound(redirectUrl).header(
    "Set-Cookie",
    cookie.serialize("id", "", {
      expires: newExpiration,
      httpOnly: true,
      path: "/auth",
      sameSite: "strict",
      secure: config.session.secure,
    }),
  );
}
