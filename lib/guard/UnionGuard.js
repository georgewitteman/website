import { isNull, isUndefined } from "./guards.js";

/**
 * @template T
 * @typedef {(input: unknown) => input is T} Predicate
 */

/**
 * @template {Predicate<unknown>} T
 * @typedef {T extends Predicate<infer R> ? R : never} Infer
 */

/**
 * @template {readonly [...Predicate<unknown>[]]} G
 * @template {boolean} O
 */
export class UnionGuard {
  /**
   * @type {readonly [...G]}
   */
  #guards;

  /** @type {O} */
  #isOptional;

  /**
   * @param {readonly [...G]} guards
   * @param {{ isOptional: O }} options
   */
  constructor(guards, options) {
    this.#guards = guards;
    this.#isOptional = options.isOptional;
  }

  isOptional() {
    return this.#isOptional;
  }

  undefined() {
    return new UnionGuard([...this.#guards, isUndefined], {
      isOptional: this.#isOptional,
    });
  }

  null() {
    return new UnionGuard([...this.#guards, isNull], {
      isOptional: this.#isOptional,
    });
  }

  nullish() {
    return new UnionGuard([...this.#guards, isNull, isUndefined], {
      isOptional: this.#isOptional,
    });
  }

  /**
   * @param {unknown} v
   * @returns {v is Infer<G[number]>}
   */
  isSatisfiedBy(v) {
    return this.#guards.some((guard) => guard(v));
  }

  optional() {
    return new UnionGuard(this.#guards, { isOptional: true });
  }

  required() {
    return new UnionGuard(this.#guards, { isOptional: false });
  }
}

/**
 * @template {readonly [...Predicate<unknown>[]]} G
 * @param {readonly [...G]} guards
 */
export function union(guards) {
  return new UnionGuard(guards, { isOptional: false });
}
