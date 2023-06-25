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

describe("isRecordOf", () => {
  test("string values", () => {
    const s = g.record(g.string());

    assert(s.isSatisfiedBy({ a: "a", b: "b" }));
    assert(!s.isSatisfiedBy({ a: 1 }));
    assert(!s.isSatisfiedBy({ a: null }));
  });

  test("object values", () => {
    const s = g.record(g.object({ foo: g.string() }));

    assert(s.isSatisfiedBy({ a: { foo: "" }, b: { foo: "" } }));
    assert(!s.isSatisfiedBy({ a: { foo: "" }, b: { foo: null } }));
  });
});
