import { describe, test } from "node:test";
import { g } from "./externals.js";
import assert from "node:assert";

describe("isInstanceOf", () => {
  test("Error", () => {
    const s = g.instanceOf(Error);
    assert.strictEqual(s.isSatisfiedBy(new Error("foo")), true);
    assert.strictEqual(s.isSatisfiedBy(new TypeError("foo")), true);
    assert.strictEqual(s.isSatisfiedBy({ message: "foo" }), false);
    assert.strictEqual(s.isSatisfiedBy({}), false);
    assert.strictEqual(s.isSatisfiedBy(null), false);
    assert.strictEqual(s.isSatisfiedBy(Error), false);

    /** @type {unknown} */
    const o = new Error();

    if (g.instanceOf(TypeError).isSatisfiedBy(o)) {
      console.log(o);
    }
  });

  test("custom class", () => {
    class Foo {}

    const s = g.instanceOf(Foo);

    assert.strictEqual(s.isSatisfiedBy(new Foo()), true);
    assert.strictEqual(s.isSatisfiedBy(new Foo()), true);
    assert.strictEqual(s.isSatisfiedBy({}), false);
    assert.strictEqual(s.isSatisfiedBy(null), false);
    assert.strictEqual(s.isSatisfiedBy(Foo), false);
  });
});
