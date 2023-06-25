import { isNull, isUndefined } from "./guards.js";
import { UnionGuard } from "./UnionGuard.js";

/**
 * @template T
 * @template {boolean} O
 */
export class BasicGuard {
  /**
   * @type {(v: unknown) => v is T}
   */
  #guard;

  /** @type {O} */
  #isOptional;

  /**
   * @param {(v: unknown) => v is T} guard
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
   * @returns {v is T}
   */
  isSatisfiedBy(v) {
    return this.#guard(v);
  }

  null() {
    return new UnionGuard([this.#guard, isNull], {
      isOptional: this.isOptional(),
    });
  }

  undefined() {
    return new UnionGuard([this.#guard, isUndefined], {
      isOptional: this.isOptional(),
    });
  }

  nullish() {
    return new UnionGuard([this.#guard, isUndefined, isNull], {
      isOptional: this.isOptional(),
    });
  }

  optional() {
    return new BasicGuard(this.#guard, { isOptional: true });
  }

  required() {
    return new BasicGuard(this.#guard, { isOptional: false });
  }
}
