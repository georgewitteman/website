import { describe, test } from "node:test";
import { ReadonlyHeaders } from "./Headers.js";
import assert from "node:assert";

describe(ReadonlyHeaders.name, () => {
  test("lowercases all keys", () => {
    const headers = new ReadonlyHeaders([
      ["KEY1", "key1val"],
      ["KEY2", ["key2val1", "key2val2"]],
    ]);
    assert.deepStrictEqual(headers.has("key1"), true);
    assert.deepStrictEqual(headers.has("KEY1"), true);
    assert.deepStrictEqual(headers.has("Key1"), true);
    assert.deepStrictEqual(headers.get("key1"), "key1val");
    assert.deepStrictEqual(headers.get("KEY1"), "key1val");
    assert.deepStrictEqual(headers.get("Key1"), "key1val");

    assert.deepStrictEqual(headers.has("key2"), true);
    assert.deepStrictEqual(headers.has("KEY2"), true);
    assert.deepStrictEqual(headers.has("Key2"), true);
    assert.deepStrictEqual(headers.get("key2"), ["key2val1", "key2val2"]);
    assert.deepStrictEqual(headers.get("KEY2"), ["key2val1", "key2val2"]);
    assert.deepStrictEqual(headers.get("Key2"), ["key2val1", "key2val2"]);
  });

  test("toJSON()", () => {
    const headers = new ReadonlyHeaders([
      ["KEY1", "key1val"],
      ["KEY2", ["key2val1", "key2val2"]],
    ]);
    assert.deepStrictEqual(headers.toJSON(), {
      key1: "key1val",
      key2: ["key2val1", "key2val2"],
    });
  });
});
