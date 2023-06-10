import {
  html,
  head,
  meta,
  title,
  link,
  header,
  nav,
  a,
  body,
  main,
  ul,
  li,
  safeText,
} from "./html4.js";
import { randomIntFromInterval } from "./random.js";

/**
 * @param {{ title: string; }} props
 */
export function DefaultHead(props) {
  return head({}, [
    meta({ charset: "utf-8" }),
    title({}, [props.title]),
    meta({ name: "viewport", content: "width=device-width,initial-scale=1" }),
    meta({ name: "author", content: "George Witteman" }),
    link({ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }),
    link({ rel: "stylesheet", href: "/styles.css" }),
  ]);
}

export function Header() {
  return header({ className: "mw-60ch mx-auto" }, [
    nav([a({ href: "/" }, [safeText("&lsaquo; Home")])]),
  ]);
}

/**
 * @param {{ title?: string, noHeader?: boolean }} props
 * @param {import("./html4.js").Node[]} children
 */
export function DefaultLayout(props, children) {
  return html({ lang: "en" }, [
    DefaultHead({ title: props.title ?? "George Witteman" }),
    body({}, [
      ...(props.noHeader ? [] : [Header()]),
      main({ className: "mw-60ch mx-auto" }, children),
    ]),
  ]);
}

/**
 *
 * @param {Record<string, never>} props
 * @param {import("./html4.js").Node[]} children
 */
export function UnorderedList(props, children) {
  return ul(
    props,
    children.map((child) => li([child])),
  );
}

export async function TestSlowComponent() {
  const timeout = randomIntFromInterval(0, 1000);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`This text loaded after ${timeout}ms`);
    }, timeout);
  });
}
