import assert from "node:assert";
import { describe, test } from "node:test";
import { SafeHTML, html, unescaped } from "./html.js";

describe("unescaped", () => {
  test(`returns a ${SafeHTML.name} instance`, () => {
    const safeQueryResult = unescaped("<script>alert('hi')</script>");
    assert.deepStrictEqual(
      safeQueryResult,
      new SafeHTML("<script>alert('hi')</script>")
    );
  });

  test("works in html", () => {
    const safeQueryResult = "<script>alert('hi')</script>";
    assert.strictEqual(
      html`this is safe: ${unescaped(safeQueryResult)}`.value,
      "this is safe: <script>alert('hi')</script>"
    );
  });
});

// TODO: Add more tests for this
describe("html", () => {
  test("fills in string values", () => {
    const val1 = "val1";
    const val2 = "val2";
    assert.strictEqual(html`${val1} + ${val2}`.value, "val1 + val2");
  });

  test("handles arrays", () => {
    const val = ["one", "two"];
    assert.strictEqual(html`${val}`.value, "onetwo");
  });

  test("handles null and undefined", () => {
    const val = [null, undefined];
    assert.strictEqual(html`${val}`.value, "");
  });

  test("handles numbers", () => {
    const val = [1, 2, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
    assert.strictEqual(
      html`${val}`.value,
      "12-19007199254740991-9007199254740991"
    );
  });

  test("escapes replacement values", () => {
    const val = "<body>&amp;\"\"''``</body>";
    assert.strictEqual(
      html`${val}`.value,
      "&lt;body&gt;&amp;amp;&quot;&quot;&#039;&#039;&#x60;&#x60;&lt;/body&gt;"
    );
  });

  test("handles no values", () => {
    assert.strictEqual(html`<html></html>`.value, "<html></html>");
  });

  test("handles only values", () => {
    assert.strictEqual(html`${"a"}${"b"}${"c"}`.value, "abc");
  });

  test("handles nested html tagged templates", () => {
    const out1 = html`<h1>out1</h1>`;
    const out2 = html`<div>${out1}</div>`;
    assert.strictEqual(
      // prettier-ignore
      html`<html>${out2}${out1}</html>`.value,
      "<html><div><h1>out1</h1></div><h1>out1</h1></html>"
    );
  });

  test("handles arrays of nested html tagged templates", () => {
    const out = [html`<div>one</div>`, html`<div>two</div>`];
    assert.strictEqual(
      // prettier-ignore
      html`<html>${out}</html>`.value,
      "<html><div>one</div><div>two</div></html>"
    );
  });

  test("handles arrays of nested html tagged templates with unsafe values", () => {
    const unsafe = [`<script>alert("foo")</script>`, html`<p></p>`];
    const out = [html`<div>${unsafe}</div>`, html`<div>${unsafe}</div>`, "foo"];
    assert.strictEqual(
      // prettier-ignore
      html`<html>${out}</html>`.value,
      "<html><div>&lt;script&gt;alert(&quot;foo&quot;)&lt;/script&gt;<p></p></div><div>&lt;script&gt;alert(&quot;foo&quot;)&lt;/script&gt;<p></p></div>foo</html>"
    );
  });
});
