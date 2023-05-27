import { describe, test } from "node:test";
import assert from "node:assert";
import { z } from "./zod.js";

describe("object", () => {
  test("returns the input object if successfully validates", () => {
    const schema = z.object({
      num: z.number(),
      num2: z.number2(),
      str: z.string(),
      date: z.date(),
      arr: z.array(z.string()),
      obj: z.object({
        str: z.string(),
      }),
    });
    const obj = {
      num: 123,
      num2: 456,
      str: "example string",
      date: new Date(),
      arr: ["arr element 1", "arr element 2"],
      obj: {
        str: "obj.str",
      },
    };
    const result = schema.parse(obj);
    assert.strictEqual(result.ok, true);
    /**
     * This will be a TypeScript error if the type inference is wrong
     * @type {{ num: number; num2: number; str: string; date: Date; arr: string[]; obj: { str: string; }; }}
     */
    const data = result.data;
    assert.deepStrictEqual(data, obj);
  });
});

describe("string", () => {
  test("returns the string", () => {
    const schema = z.string();
    const result = schema.parse("a string");
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.data, "a string");
  });

  test("returns an error for numbers", () => {
    const schema = z.string();
    const result = schema.parse(123);
    assert.strictEqual(result.ok, false);
  });
});

describe("null", () => {
  test("returns null", () => {
    const schema = z.null();
    const result = schema.parse(null);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.data, null);
  });

  [undefined, "", 0, -0, false, true, NaN].forEach((val) => {
    test(`returns an error for: ${val} (${typeof val})`, () => {
      const schema = z.null();
      const result = schema.parse(val);
      assert.strictEqual(result.ok, false);
    });
  });
});

describe("undefined", () => {
  test("returns undefined", () => {
    const schema = z.undefined();
    const result = schema.parse(undefined);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.data, undefined);
  });

  [null, "", 0, -0, false, true, NaN].forEach((val) => {
    test(`returns an error for: ${val} (${typeof val})`, () => {
      const schema = z.undefined();
      const result = schema.parse(val);
      assert.strictEqual(result.ok, false);
    });
  });
});
