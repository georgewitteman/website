import { describe, test } from "node:test";
import { ContentSecurityPolicy } from "./content-security-policy.js";
import assert from "node:assert";

describe(ContentSecurityPolicy.name, () => {
  test("stringifies to the proper default", () => {
    const policy = new ContentSecurityPolicy();
    assert.strictEqual(
      policy.toString(),
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'",
    );
  });
});
