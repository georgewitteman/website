import { describe, test } from "node:test";
import { pathMatches } from "./Router.js";
import assert from "node:assert";

describe(pathMatches.name, () => {
  test("matching routes", () => {
    assert.strictEqual(pathMatches("/a/b/:field", "/a/b/field")[0], true);
    assert.strictEqual(pathMatches("/a/b/:field/c", "/a/b/field/c")[0], true);
    assert.strictEqual(pathMatches("/:field", "/field")[0], true);
    assert.strictEqual(pathMatches("/:field/a", "/field/a")[0], true);
    assert.strictEqual(pathMatches("/:field/a", "//a")[0], true);
  });

  test("non-matching routes", () => {
    assert.strictEqual(pathMatches("/a/b/:field", "/a/b/field/foo")[0], false);
    assert.strictEqual(pathMatches("/a/b/:field/c", "/a/b/field")[0], false);
    assert.strictEqual(pathMatches("/:field", "/field/a")[0], false);
    assert.strictEqual(pathMatches("/:field/a", "/field/a/b")[0], false);
    assert.strictEqual(
      pathMatches("/router/:id/foo", "/router/test2/asdf")[0],
      false,
    );
  });
});
