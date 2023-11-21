import { describe, test } from "bun:test";
import { sql } from "./db.js";
import assert from "node:assert";

describe("sql template function", () => {
  test("returns the object in the correct format", () => {
    const foo = 1;
    const bar = null;
    const baz = "str";
    assert.deepStrictEqual(
      sql`SELECT * FROM tbl WHERE foo = ${foo} AND bar = ${bar} AND baz = ${baz};`,
      {
        text: "SELECT * FROM tbl WHERE foo = $1 AND bar = $2 AND baz = $3;",
        values: [foo, bar, baz],
      },
    );
  });

  test("handles empty strings", () => {
    assert.deepStrictEqual(sql``, {
      text: "",
      values: [],
    });
  });

  test("handles strings with no values", () => {
    assert.deepStrictEqual(sql`SELECT * FROM tbl;`, {
      text: "SELECT * FROM tbl;",
      values: [],
    });
  });

  test("handles strings with only values", () => {
    assert.deepStrictEqual(sql`${null}${null}${null}`, {
      text: "$1$2$3",
      values: [null, null, null],
    });
  });
});
