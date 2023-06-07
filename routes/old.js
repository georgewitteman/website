import { randomBytes } from "node:crypto";
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
      body: html`
        <main>
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
              <a href="/migrations">PostgreSQL Migrations</a>
            </li>
            <li>
              <a href="/database/table">PostgreSQL Tables</a>
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
        </main>
      `,
    }),
  );
});

router.get("/duration-picker-test", async () => {
  const nonce = randomBytes(16).toString("base64");
  const res = MyResponse.html(
    200,
    {},
    documentLayout({
      title: "Duration Picker Test",
      head: html`<script
        nonce="${nonce}"
        type="module"
        src="/js/duration-picker.js"
      ></script>`,
      body: html`
        <header>
          <nav><a href="/">&lsaquo; Home</a><br /></nav>
        </header>
        <main>
          <duration-picker data-seconds="115"></duration-picker>
          <duration-picker data-seconds="0"></duration-picker>
          <duration-picker data-seconds="-115"></duration-picker>
          <duration-picker data-min="115"></duration-picker>
          <duration-picker data-min="0"></duration-picker>
          <duration-picker data-min="-59"></duration-picker>
          <duration-picker data-min="-60"></duration-picker>
          <duration-picker data-min="-115"></duration-picker>
        </main>
      `,
    }),
  );
  res.contentSecurityPolicy.nonce = nonce;
  return res;
});

router.get("/amazon-short-link.html", async () => {
  const nonce = randomBytes(16).toString("base64");
  const res = MyResponse.html(
    200,
    {},
    documentLayout({
      title: "Amazon Short Link Generator",
      body: html`
        <header>
          <nav><a href="/">&lsaquo; Home</a><br /></nav>
        </header>
        <main>
          <form id="form">
            <label>
              Long URL<br />
              <input
                type="text"
                name="long_url"
                id="long_url"
                autofocus
                placeholder="https://www.amazon.com/gp/product/B07PWC32ZD/ref=ox_sc_act_title_14?smid=A294P4X9EWVXLJ&psc=1"
              />
              <button id="paste_url" type="button">Paste</button>
              <button id="paste_copy_url" type="button">Paste & Copy</button>
            </label>
            <p>
              Short URL<br />
              <output for="form" for="long_url" id="short_url"></output>
              <button id="copy_short_url" type="button">Copy</button>
            </p>
            <p>
              Shortish URL<br />
              <output for="form" for="long_url" id="shortish_url"></output>
              <button id="copy_shortish_url" type="button">Copy</button>
            </p>
          </form>
          <script
            nonce="${nonce}"
            type="module"
            src="/js/amazon-short-link.js"
          ></script>
        </main>
      `,
    }),
  );
  res.contentSecurityPolicy.nonce = nonce;
  return res;
});

router.get("/microwave_time_calculator.html", async () => {
  const nonce = randomBytes(16).toString("base64");
  const res = MyResponse.html(
    200,
    {},
    documentLayout({
      title: "Microwave Time Calculator",
      head: html`
        <style nonce="${nonce}">
          body {
            touch-action: manipulation;
          }

          #result_time,
          #result_power {
            font-weight: bold;
          }
        </style>
      `,
      body: html`
        <header>
          <nav><a href="/">&lsaquo; Home</a><br /></nav>
        </header>

        <main>
          <p>
            I microwave a lot of food, so this is handy to calculate the best
            settings. It first tries to match the intended wattage based on the
            power setting on the box. Using that wattage, it then calculates the
            time that will cook the food most similarly to the box settings.
          </p>

          <p>
            The URL is also updated, so you can create a bookmark with your
            microwave settings for easy use.
          </p>

          <form id="form">
            <label>
              Box Wattage<br />
              <input
                type="number"
                name="box_wattage"
                id="box_wattage"
                value="1100"
                step="50"
                min="1"
                max="10000"
              />
            </label>
            <button type="button" id="plus_box_wattage">+25</button>
            <button type="button" id="minus_box_wattage">-25</button>
            <br />
            <label>
              Box Time<br />
              <input
                type="number"
                name="box_minutes"
                id="box_minutes"
                value="1"
                min="0"
                max="60"
              />
              mins
            </label>
            <label>
              <input
                type="number"
                name="box_seconds"
                id="box_seconds"
                value="0"
                step="15"
                min="0"
                max="60"
              />
              secs
            </label>
            <button type="button" id="plus_15_s">+15</button>
            <button type="button" id="minus_15_s">-15</button>
            <button type="button" id="plus_1_s">+</button>
            <button type="button" id="minus_1_s">-</button>
            <br />
            <label>
              Box Power (1-10)<br />
              <input
                type="number"
                name="box_power"
                id="box_power"
                value="10"
                min="1"
                max="10"
              />
            </label>
            <button type="button" id="plus_1_power">+</button>
            <button type="button" id="minus_1_power">-</button>
            <br />
            <label>
              Your Wattage<br />
              <input
                type="number"
                name="your_wattage"
                id="your_wattage"
                value="975"
                step="50"
                min="1"
                max="10000"
              />
            </label>
            <button type="button" id="plus_your_wattage">+25</button>
            <button type="button" id="minus_your_wattage">-25</button>
            <p>
              Your Time:
              <output
                for="form"
                for="box_wattage box_minutes box_seconds box_power your_wattage"
                id="result_time"
              ></output>

              (Power:
              <output
                for="form"
                for="box_wattage box_minutes your_wattage"
                id="result_power"
              ></output
              >)
            </p>

            <a href="/microwave_time_calculator.html">Reset</a>
          </form>
        </main>
        <script
          nonce="${nonce}"
          type="module"
          src="/js/microwave-time-calculator.js"
        ></script>
      `,
    }),
  );
  res.contentSecurityPolicy.nonce = nonce;
  return res;
});

router.get("/google-short-link.html", async () => {
  const nonce = randomBytes(16).toString("base64");
  const res = MyResponse.html(
    200,
    {},
    documentLayout({
      title: "Google Short Links",
      body: html`
        <header>
          <nav><a href="/">&lsaquo; Home</a><br /></nav>
        </header>

        <main>
          <form id="form">
            <label>
              Long URL<br />
              <input
                type="text"
                name="long_url"
                id="long_url"
                autofocus
                placeholder="https://www.google.com/search?client=safari&rls=en&q=weather+94105&ie=UTF-8&oe=UTF-8"
              />
              <button id="paste_url" type="button">Paste</button>
              <button id="paste_copy_url" type="button">Paste & Copy</button>
            </label>
            <p>
              Short URL<br />
              <output for="form" for="long_url" id="short_url"></output>
              <button id="copy_short_url" type="button">Copy</button>
            </p>
          </form>
        </main>
        <script
          nonce="${nonce}"
          type="module"
          src="/js/google-short-link.js"
        ></script>
      `,
    }),
  );
  res.contentSecurityPolicy.nonce = nonce;
  return res;
});

router.get("/google-account-links.html", async () => {
  const nonce = randomBytes(16).toString("base64");
  const res = MyResponse.html(
    200,
    {},
    documentLayout({
      title: "Microwave Time Calculator",
      body: html`
        <header>
          <nav><a href="/">&lsaquo; Home</a><br /></nav>
        </header>

        <main>
          <form id="form">
            <label>
              Google Email Address<br />
              <input
                type="email"
                name="email"
                id="email"
                autofocus
                placeholder="first.last@gmail.com"
              />
            </label>
            <p><output form="form" for="email" id="gmail"></output></p>
            <p><output form="form" for="email" id="google_drive"></output></p>
            <p><output form="form" for="email" id="gmail2"></output></p>
            <p><output form="form" for="email" id="google_drive2"></output></p>
            <p>
              <output form="form" for="email" id="google_calendar"></output>
            </p>
          </form>
        </main>
        <script
          nonce="${nonce}"
          type="module"
          src="/js/google-account-links.js"
        ></script>
      `,
    }),
  );
  res.contentSecurityPolicy.nonce = nonce;
  return res;
});

router.get("/username.html", async () => {
  const nonce = randomBytes(16).toString("base64");
  const res = MyResponse.html(
    200,
    {},
    documentLayout({
      title: "Random Username Generator",
      body: html`
        <header>
          <nav><a href="/">&lsaquo; Home</a><br /></nav>
        </header>

        <main>
          <form id="form">
            <label>
              Length<br />
              <input
                type="number"
                name="length"
                id="length"
                autofocus
                value="8"
              />
              <button id="generate" type="submit">Generate</button>
            </label>
            <p>
              Username<br />
              <output
                for="form"
                for="number"
                id="username"
                class="monospace"
              ></output>
              <button id="copy_username" type="button">Copy</button>
            </p>
          </form>
        </main>
        <script nonce="${nonce}" type="module" src="/js/username.js"></script>
      `,
    }),
  );
  res.contentSecurityPolicy.nonce = nonce;
  return res;
});
