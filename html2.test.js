import assert from "node:assert";
import { test } from "node:test";
import { render, h } from "./html2.js";

test("handles basic html", () => {
  assert.deepStrictEqual(render(h("p", null, "Hi there!")), "<p>Hi there!</p>");
  assert.deepStrictEqual(
    render(h("div", null, h("p", null, "Hi there!"))),
    "<div><p>Hi there!</p></div>",
  );
  assert.deepStrictEqual(
    render(h("div", { className: "foo" }, h("p", null, "Hi there!"))),
    `<div class="foo"><p>Hi there!</p></div>`,
  );
});

test("disallows invalid property names", () => {
  assert.throws(() => render(h("p", { "\t": "foo" })));
  assert.throws(() => render(h("p", { "\n": "foo" })));
  assert.throws(() => render(h("p", { "\f": "foo" })));
  assert.throws(() => render(h("p", { " ": "foo" })));
  assert.throws(() => render(h("p", { ">": "foo" })));
  assert.throws(() => render(h("p", { "/": "foo" })));
  assert.throws(() => render(h("p", { "=": "foo" })));
  assert.throws(() => render(h("p", { '"': "foo" })));
  assert.throws(() => render(h("p", { "'": "foo" })));
  assert.throws(() => render(h("p", { "=": "foo" })));
  assert.throws(() => render(h("p", { "": "foo" })));

  // @ts-expect-error Type 'string' is not assignable to type 'undefined'.ts(2322)
  assert.throws(() => render(h("p", { class: "foo" })));
});

test("escapes property values", () => {
  assert.deepStrictEqual(
    render(h("p", { foo: "abcdefghijklmnopqrstuvwxyz" })),
    `<p foo="abcdefghijklmnopqrstuvwxyz"></p>`,
  );
  assert.deepStrictEqual(
    render(h("p", { foo: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" })),
    `<p foo="ABCDEFGHIJKLMNOPQRSTUVWXYZ"></p>`,
  );
  assert.deepStrictEqual(
    render(h("p", { foo: "1234567890" })),
    `<p foo="1234567890"></p>`,
  );
  assert.deepStrictEqual(
    render(h("p", { foo: " - _ " })),
    `<p foo=" - _ "></p>`,
  );
  assert.deepStrictEqual(
    render(h("p", { foo: "!@#$%^&*()" })),
    `<p foo="&#33;&#64;&#35;&#36;&#37;&#94;&#38;&#42;&#40;&#41;"></p>`,
  );
  assert.deepStrictEqual(
    render(h("p", { foo: "a!a@a#a$a%a^a&a*a(a)a" })),
    `<p foo="a&#33;a&#64;a&#35;a&#36;a&#37;a&#94;a&#38;a&#42;a&#40;a&#41;a"></p>`,
  );
});

test("components", () => {
  /**
   * @param {{ name: string; }} props
   */
  function Component(props) {
    return h("p", null, `Hi ${props.name}!`);
  }

  function ComponentNoProps() {
    return h("div", null);
  }

  /**
   * @param {{ className: string; }} props
   */
  function App(props) {
    return h(
      "div",
      { className: props.className, "data-testid": "test-app" },
      h(Component, { name: "there" }),
      h(ComponentNoProps, null),
    );
  }

  assert.deepStrictEqual(
    render(h(App, { className: "test-class" })),
    `<div class="test-class" data-testid="test-app"><p>Hi there!</p><div></div></div>`,
  );
});

test("components with children", () => {
  /**
   * @param {{ children: import("./html2.js").VNode[] }} props
   */
  function Component(props) {
    return h("div", null, ...props.children);
  }

  /**
   * @param {{ className: string; }} props
   */
  function App(props) {
    return h(
      "div",
      { className: props.className, "data-testid": "test-app" },
      h(
        Component,
        null,
        h("p", null, "p1"),
        h("p", { className: "monospace" }, "p2a", "p2b"),
      ),
    );
  }

  assert.deepStrictEqual(
    render(h(App, { className: "test-class" })),
    `<div class="test-class" data-testid="test-app"><div><p>p1</p><p class="monospace">p2ap2b</p></div></div>`,
  );
});
