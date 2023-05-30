import { MyResponse } from "../Response.js";
import { Router } from "../Router.js";
import { html } from "../html.js";
import { documentLayout } from "../layout.js";

export const router = new Router();

router.get("/", async () => {
  return MyResponse.html(
    200,
    {},
    documentLayout({
      body: html`<main>
        <ul>
          <li>
            <a href="/microwave_time_calculator.html"
              >Microwave Time Calculator</a
            >
          </li>
          <li><a href="/stuff.html">Stuff I Use</a></li>
          <li>
            <a href="/google-short-link.html">Shorten Google Search Links</a>
          </li>
          <li>
            <a href="/amazon-short-link.html">Generate Amazon Short Link</a>
          </li>
          <li>
            <a href="/google-account-links.html"
              >Generate Google App Links for Specific Accounts</a
            >
          </li>
          <li><a href="/username.html">Random User Name Generator</a></li>
          <li>
            <a href="/now">PostgreSQL <code>now()</code></a>
          </li>
          <li>
            Contact me:
            <a href="mailto:george@witteman.me">george@witteman.me</a>
          </li>
          <li>
            <a href="https://www.linkedin.com/in/georgewitteman/">LinkedIn</a>
          </li>
          <li><a href="http://github.com/georgewitteman">GitHub</a></li>
        </ul>
      </main>`,
    })
  );
});
