import { html } from "./html.js";

/**
 *
 * @param {{ title?: string, head?: import("./html.js").SafeHTML, main: import("./html.js").SafeHTML, noHeader?: boolean }} params
 */
export function documentLayout(params) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${params.title ?? "George Witteman"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="author" content="George Witteman" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/styles.css" />
        ${params.head}
      </head>
      <body>
        ${params.noHeader ? null : header()}
        <main class="mw-page mx-auto">${params.main}</main>
      </body>
    </html>
  `;
}

export function header() {
  return html`
    <header class="mw-page mx-auto">
      <nav><a href="/">&lsaquo; Home</a></nav>
    </header>
  `;
}
