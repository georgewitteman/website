import { h } from "./html.js";
import { getStaticPathWithHash } from "../middleware/static.js";

function headerUserLinks() {
  return [
    h("a", { href: "/auth/signin" }, ["Log In"]),
    " | ",
    h("a", { href: "/auth/signup" }, ["Sign Up"]),
  ];
  // const user = getCurrentUser();
  // if (!user) {
  //   return [
  //     h("a", { href: "/auth/signin" }, ["Log In"]),
  //     " | ",
  //     h("a", { href: "/auth/signup" }, ["Sign Up"]),
  //   ];
  // }

  // return [
  //   h("a", { href: route("auth", "profile", user.id) }, ["Profile"]),
  //   " | ",
  //   h("a", { href: "/auth/logout" }, ["Log Out"]),
  // ];
}

export function header() {
  return h("header", { class: "mw-page mx-auto" }, [
    h("nav", {}, [
      h("a", { href: "/" }, ["\u2039 Home"]),
      " | ",
      ...headerUserLinks(),
    ]),
  ]);
}

/**
 *
 * @param {{ title?: string, head?: import("./html.js").Node[], main: import("./html.js").Node[], noHeader?: boolean }} params
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
      ...(params.noHeader ? [] : [header()]),
      h("main", { class: "mw-page mx-auto" }, params.main ?? []),
    ]),
  ]);
}
