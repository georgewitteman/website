import assert from "node:assert";
import { UnionGuard } from "./UnionGuard.js";
import { isNull, isUndefined } from "./guards.js";

/**
 * @template {Record<PropertyKey, import("./types.js").Guard<unknown, boolean>>} S
 * @template {boolean} O
 */
export class ObjectGuard {
  /** @type {S} */
  #shape;

  /** @type {O} */
  #isOptional;

  /**
   * @param {S} shape
   * @param {{ isOptional: O }} options
   */
  constructor(shape, options) {
    this.#shape = shape;
    this.#isOptional = options.isOptional;
  }

  isOptional() {
    return this.#isOptional;
  }

  /**
   *
   * @param {unknown} v
   * @returns {v is import("./types.js").UnShape<S>}
   */
  isSatisfiedBy(v) {
    if (v === null || typeof v !== "object") {
      return false;
    }

    return Object.keys(this.#shape).every((key) => {
      const guard = this.#shape[key];
      assert(guard !== undefined);

      if (!(key in v)) {
        return guard.isOptional();
      }

      /** @type {unknown} */
      const value = Object.getOwnPropertyDescriptor(v, key)?.value;
      const satisfied = guard.isSatisfiedBy(value);
      return satisfied;
    });
  }

  null() {
    return new UnionGuard([this.isSatisfiedBy.bind(this), isNull], {
      isOptional: this.#isOptional,
    });
  }

  undefined() {
    return new UnionGuard([this.isSatisfiedBy.bind(this), isUndefined], {
      isOptional: this.#isOptional,
    });
  }

  nullish() {
    return new UnionGuard(
      [this.isSatisfiedBy.bind(this), isUndefined, isNull],
      { isOptional: this.#isOptional },
    );
  }

  optional() {
    return new ObjectGuard(this.#shape, { isOptional: true });
  }

  required() {
    return new ObjectGuard(this.#shape, { isOptional: false });
  }
}

/**
 * @template {Record<string, import("./types.js").Guard<unknown, boolean>>} S
 * @param {S} shape
 */
export function object(shape) {
  return new ObjectGuard(shape, { isOptional: false });
}
