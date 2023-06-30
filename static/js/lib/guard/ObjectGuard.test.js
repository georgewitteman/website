import { test } from "node:test";
import { g } from "./externals.js";
import assert from "node:assert";

test("basic objects", () => {
  const s = g.object({
    req: g.literal("req"),
    opt: g.string().optional(),
    obj: g.object({
      req: g.string(),
      opt: g.string().optional(),
    }),
    optObj: g
      .object({
        req: g.string(),
        opt: g.string().optional(),
      })
      .optional(),
  });

  assert.strictEqual(s.isSatisfiedBy(null), false);

  assert.strictEqual(s.isSatisfiedBy({}), false);

  assert.strictEqual(s.isSatisfiedBy({ req: "req" }), false);

  assert.strictEqual(
    s.isSatisfiedBy({ req: "req", obj: { req: "req" } }),
    true,
  );
  assert.strictEqual(
    s.isSatisfiedBy({
      req: "req",
      opt: "opt",
      obj: { req: "req", opt: "opt" },
      optObj: { req: "req" },
    }),
    true,
  );
  assert.strictEqual(
    s.isSatisfiedBy({
      req: "req",
      opt: "opt",
      obj: { req: "req", opt: "opt" },
      optObj: { req: "req", opt: "opt" },
    }),
    true,
  );
});

test("extended classes", () => {
  class ClassA {
    classAStatic = "classAStatic";
    constructor() {
      this.classA = "classA";
    }
  }

  class ClassB extends ClassA {
    constructor() {
      super();
      this.classB = "classA";
    }
  }

  const o = new ClassB();
  assert.strictEqual(
    g
      .object({
        classA: g.string(),
        classB: g.string(),
      })
      .isSatisfiedBy(o),
    true,
  );

  assert.strictEqual(
    g
      .object({
        classAStatic: g.string(),
        classA: g.string(),
        classB: g.string(),
      })
      .isSatisfiedBy(o),
    true,
  );
});

test("null prototype", () => {
  /** @type {unknown} */
  const o = Object.create(null, {
    // foo is a regular data property
    foo: {
      writable: true,
      configurable: true,
      value: "hello",
    },
  });
  assert.strictEqual(
    g
      .object({
        foo: g.literal("hello"),
      })
      .isSatisfiedBy(o),
    true,
  );
});
