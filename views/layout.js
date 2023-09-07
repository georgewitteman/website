import { h } from "../lib/html.js";
import { getStaticPathWithHash } from "../middleware/static.js";

/**
 * @param {{ user: {id: string} | undefined}} params
 */
function headerUserLinks({ user }) {
  if (!user) {
    return [
      h("a", { href: "/auth/signin" }, ["Log In"]),
      " | ",
      h("a", { href: "/auth/signup" }, ["Sign Up"]),
    ];
  }

  return [
    h("a", { href: "/auth/profile" }, ["Profile"]),
    " | ",
    h("a", { href: "/auth/logout" }, ["Log Out"]),
  ];
}

/**
 * @param {{ user: {id: string} | undefined}} params
 */
export function header({ user }) {
  return h("header", { class: "mw-page mx-auto" }, [
    h("nav", {}, [
      h("a", { href: "/" }, ["\u2039 Home"]),
      " | ",
      ...headerUserLinks({ user }),
    ]),
  ]);
}

/**
 * @param {{ title?: string, head?: import("../lib/html.js").Node[], main: import("../lib/html.js").Node[], noHeader?: boolean, user: {id:string} | undefined }} params
 */
export async function documentLayout(params) {
  return h("html", { lang: "en" }, [
    h("head", {}, [
      h("meta", { charset: "utf-8" }),
      h("title", {}, [params.title ?? "George Witteman"]),
      h("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      }),
      h("link", {
        rel: "icon",
        type: "image/x-icon",
        href: await getStaticPathWithHash("favicon.ico"),
      }),
      h("link", {
        rel: "stylesheet",
        href: await getStaticPathWithHash("styles.css"),
      }),
      ...(params.head ?? []),
    ]),
    h("body", {}, [
      ...(params.noHeader ? [] : [header(params)]),
      h("main", { class: "mw-page mx-auto" }, params.main ?? []),
    ]),
  ]);
}
