import { UnionGuard } from "./UnionGuard.js";
import { isNull, isUndefined } from "./guards.js";

/**
 * @template {import("./types.js").Guard<unknown, boolean>} G
 * @template {boolean} O
 */
export class ArrayGuard {
  /** @type {G} */
  #guard;

  /** @type {O} */
  #isOptional;

  /**
   * @param {G} guard
   * @param {{ isOptional: O }} options
   */
  constructor(guard, options) {
    this.#guard = guard;
    this.#isOptional = options.isOptional;
  }

  isOptional() {
    return this.#isOptional;
  }

  /**
   *
   * @param {unknown} v
   * @returns {v is import("./types.js").TypeOf<G>[]}
   */
  isSatisfiedBy(v) {
    if (!Array.isArray(v)) {
      return false;
    }

    return v.every((v) => this.#guard.isSatisfiedBy(v));
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
    return new ArrayGuard(this.#guard, { isOptional: true });
  }

  required() {
    return new ArrayGuard(this.#guard, { isOptional: false });
  }
}

/**
 * @template T
 * @param {import("./types.js").Guard<T, boolean>} guard
 */
export function array(guard) {
  return new ArrayGuard(guard, { isOptional: false });
}
