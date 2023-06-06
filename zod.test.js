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

  test("handles optional values", () => {
    const schema = z.object({
      foo: z.string().optional(),
      bar: z.string(),
    });
    const result = schema.parse({ bar: "bar" });
    assert.ok(result.ok);
    /** @type {{ foo: string | undefined, bar: string }} */
    const data = result.data;
    assert.deepStrictEqual(data, { foo: undefined, bar: "bar" });
  });

  test("handles nullish values", () => {
    const schema = z.object({
      foo: z.string().nullish(),
      bar: z.string().nullish(),
    });
    const result = schema.parse({ foo: null });
    assert.ok(result.ok);
    /** @type {{ foo: string | null |undefined, bar: string | null | undefined }} */
    const data = result.data;
    assert.deepStrictEqual(data, { foo: null, bar: undefined });
  });
});

describe("array", () => {
  test("returns the input object if successfully validates", () => {
    const schema = z.array(z.string()).length(1);
    const arr = ["foo"];
    const result = schema.parse(arr);
    assert.strictEqual(result.ok, true);
    /**
     * This will be a TypeScript error if the type inference is wrong
     * @type {[string]}
     */
    const data = result.data;
    assert.deepStrictEqual(data, arr);
  });

  test("supports min: undefined, max: 1 with [string] array", () => {
    const schema = z.array(z.string()).max(1);
    const arr = ["foo"];
    const result = schema.parse(arr);
    assert.strictEqual(result.ok, true);
    /**
     * This will be a TypeScript error if the type inference is wrong
     * @type {[] | [string]}
     */
    const data = result.data;
    assert.deepStrictEqual(data, arr);
  });

  test("supports min: undefined, max: 1 with [] array", () => {
    const schema = z.array(z.string()).max(1);
    /** @type {unknown[]} */
    const arr = [];
    const result = schema.parse(arr);
    assert.strictEqual(result.ok, true);
    /**
     * This will be a TypeScript error if the type inference is wrong
     * @type {[] | [string]}
     */
    const data = result.data;
    assert.deepStrictEqual(data, arr);
  });

  test("supports min: 0, max: 1 with [string] array", () => {
    const schema = z.array(z.string()).min(0).max(1);
    const arr = ["foo"];
    const result = schema.parse(arr);
    assert.strictEqual(result.ok, true);
    /**
     * This will be a TypeScript error if the type inference is wrong
     * @type {[] | [string]}
     */
    const data = result.data;
    assert.deepStrictEqual(data, arr);
  });

  test("supports min: 0, max: 1 with [] array", () => {
    const schema = z.array(z.string()).min(0).max(1);
    /** @type {unknown[]} */
    const arr = [];
    const result = schema.parse(arr);
    assert.strictEqual(result.ok, true);
    /**
     * This will be a TypeScript error if the type inference is wrong
     * @type {[] | [string]}
     */
    const data = result.data;
    assert.deepStrictEqual(data, arr);
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
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    test(`returns an error for: ${val} (${typeof val})`, () => {
      const schema = z.undefined();
      const result = schema.parse(val);
      assert.strictEqual(result.ok, false);
    });
  });
});

describe("ISO 8601 date string", () => {
  [
    ["1970-01-01T00:00:00.000Z", new Date(1970, 0, 1)],
    ["2009-05-19T12:34:56.987Z", new Date(2009, 4, 19, 12, 34, 56, 987)],
  ].forEach(([val, expected]) => {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    test(`${val} accepted as valid`, () => {
      const result = z.iso8601().parse(val);
      assert.deepStrictEqual(result, { ok: true, data: expected });
    });
  });

  [
    null,
    undefined,
    new Date("2009-05-19T12:34:56.987Z"),
    1242736496987,
    "date",
    ["2009-05-19T12:34:56.987Z"],
    "2009",
    "2009-05",
    "2009-05-19",
    "2009-05-19T12:34",
    "2009-05-19T12:34:56",
    "2009-05-19T12:34:56.9",
    "2009-05-19T12:34:56.98",
    "2009-05-19T12:34:56.987",
    "1970-01-01T00:00:00.000+00:00",
    "2009-02-03T12:34:56.789+11:22",
    "0000-00-00T00:00:00.000Z",
    "9999-99-99T99:99:99.999Z",
  ].forEach((val) => {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    test(`${val} rejected as invalid`, () => {
      const result = z.iso8601().parse(val);
      assert.strictEqual(result.ok, false);
    });
  });
});
