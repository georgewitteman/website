import { html } from "./html.js";

/**
 *
 * @param {{ title?: string, head?: import("./html.js").SafeHTML, body: import("./html.js").SafeHTML}} params
 */
export function documentLayout(params) {
  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${params.title ?? "George Witteman"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="author" content="George Witteman" />
        <link rel="stylesheet" href="/styles.css" />
        ${params.head}
      </head>
      <body>
        ${params.body}
      </body>
    </html>`;
}
