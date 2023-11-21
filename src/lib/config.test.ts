import { describe, expect, test } from "bun:test";
import { config } from "./config";

describe("Configuration", () => {
  test("is an object", () => {
    expect(config).toBeTypeOf("object");
  });
});
