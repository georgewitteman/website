import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { html } from "../html.js";

export const router = new Router();

router.get("/css", async () => {
  return MyResponse.html(
    200,
    {},
    html`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>CSS</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="author" content="George Witteman" />
          <link rel="icon" type="image/x-icon" href="/favicon.ico" />
          <link rel="stylesheet" href="/styles.css" />
        </head>
        <body>
          Inspiration:
          <ul>
            <li><a href="https://github.com/tachyons-css/tachyons/tree/main">Tachyons</a></li>
            <li><a href="https://github.com/jenil/chota">Chota</a></li>
            <li><a href="https://khang-nd.github.io/7.css">7.css</a></li>
            <li><a href="https://github.com/troxler/awesome-css-frameworks">troxler/awesome-css-frameworks</a></li>
          </ul>
          Hi! This is some regular, unstyled text.
          <p class="monospace">This is some monospace text</p>
          <table class="table">
            <thead>
              <tr><th>Column 1</th><th>Column 2</th></tr>
            </thead>
            <tbody>
              <tr><td>Row 1 Col 1</td><td>Row 1 Col 2</td></tr>
              <tr><td>Row 2 Col 1</td><td>Row 2 Col 2</td></tr>
              <tr><td>Row 3 Col 1</td><td>Row 3 Col 2</td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `,
  );
});
