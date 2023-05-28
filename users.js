import { MyResponse } from "./Response.js";
import { html } from "./html.js";

/**
 * @param {import("./Request.js").MyRequest} req
 * @param {() => Promise<MyResponse>} next
 * @returns {Promise<MyResponse>}
 */
export async function getSignup(req, next) {
  console.log("blah", req.method);
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
          ${req.rawUrl.searchParams.get("success") === "true"
            ? html`<p>Sign up success!</p>`
            : null}
          <form method="post" action="/signup">
            <label>Email <input type="email" /> </label>
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
  console.log("foo");
  if (req.rawUrl.pathname !== "/signup" || req.method !== "POST") {
    return next();
  }
  return new MyResponse(302, { Location: "/signup?success=true" }, "");
}
