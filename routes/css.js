import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { DefaultHead, Header } from "../components.js";
import {
  a,
  body,
  div,
  h3,
  html,
  li,
  p,
  table,
  tbody,
  td,
  th,
  thead,
  tr,
  ul,
} from "../html4.js";

export const router = new Router();

router.get("/css", async () => {
  return new MyResponse().html4(
    html({ lang: "en" }, [
      DefaultHead({ title: "CSS" }),
      body({}, [
        Header(),
        h3({ className: "mw-page mx-auto" }, ["Inspiration"]),
        ul({ className: "mw-page mx-auto" }, [
          li({}, [
            a({ href: "https://github.com/tachyons-css/tachyons" }, [
              "Tachyons",
            ]),
          ]),
          li({}, [a({ href: "https://github.com/jenil/chota" }, ["Chota"])]),
          li({}, [a({ href: "https://khang-nd.github.io/7.css" }, ["7.css"])]),
          li({}, [
            a({ href: "https://github.com/troxler/awesome-css-frameworks" }, [
              "troxler/awesome-css-frameworks",
            ]),
          ]),
        ]),
        div({ className: "mw-page mx-auto" }, [
          "Hi! this is some regular, unstyled text.",
          p({ className: "monospace" }, ["This is some monospace text"]),
          table({ className: "table" }, [
            thead({}, [tr({}, [th(["Column 1"]), th(["Column 2"])])]),
            tbody({}, [
              tr({}, [td({}, ["Row 1 Col 1"]), td({}, ["Row 1 Col 2"])]),
              tr({}, [td({}, ["Row 2 Col 1"]), td({}, ["Row 2 Col 2"])]),
              tr({}, [td({}, ["Row 3 Col 1"]), td({}, ["Row 3 Col 2"])]),
            ]),
          ]),
        ]),
      ]),
    ]),
  );
});
