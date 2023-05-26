import { describe, it } from "node:test";
import assert from 'node:assert';
import { z } from "./zod.js";

describe(z.object({}).constructor.name, () => {
  it("should return the input object if successfully validates", () => {
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
    assert.deepStrictEqual(result.data, obj);
  });
});

describe(z.string().constructor.name, () => {
  it("should work for normal strings", () => {
    const schema = z.string();
    const result = schema.parse("a string")
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.data, "a string");
  });

  it("should return an error for numbers", () => {
    const schema = z.string();
    const result = schema.parse(123)
    assert.strictEqual(result.ok, false);
  });
});
