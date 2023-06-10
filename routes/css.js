import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { DefaultHead } from "../components.js";
import {
  a,
  body,
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
  return MyResponse.html4(
    200,
    {},
    html({ lang: "en" }, [
      DefaultHead({ title: "CSS" }),
      body({}, [
        "Inspiration",
        ul({}, [
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
  );
});
