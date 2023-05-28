import { describe, test } from "node:test";
import { pathMatches } from "./Router.js";
import assert from "node:assert";

describe(pathMatches.name, () => {
  test("matching routes", () => {
    assert.ok(pathMatches("/a/b/:field", "/a/b/field"));
    assert.ok(pathMatches("/a/b/:field/c", "/a/b/field/c"));
    assert.ok(pathMatches("/:field", "/field"));
    assert.ok(pathMatches("/:field/a", "/field/a"));
    assert.ok(pathMatches("/:field/a", "//a"));
  });

  test("non-matching routes", () => {
    assert.ok(!pathMatches("/a/b/:field", "/a/b/field/foo"));
    assert.ok(!pathMatches("/a/b/:field/c", "/a/b/field"));
    assert.ok(!pathMatches("/:field", "/field/a"));
    assert.ok(!pathMatches("/:field/a", "/field/a/b"));
    assert.ok(!pathMatches("/router/:id/foo", "/router/test2/asdf"));
  });
});
