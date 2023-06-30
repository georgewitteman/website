import { UnionGuard } from "./UnionGuard.js";
import { isNull, isUndefined } from "./guards.js";

/**
 * @template {import("./types.js").Guard<unknown, boolean>[]} G
 * @typedef {G extends [infer R, ...infer Rest] ? Rest extends import("./types.js").Guard<unknown, boolean>[] ? [import("./types.js").TypeOf<R>, ...Infer<Rest>] : [import("./types.js").TypeOf<R>] : []} Infer
 */

/**
 * @template {[...import("./types.js").Guard<unknown, boolean>[]]} G
 * @template {boolean} O;
 */
export class TupleGuard {
  /**
   * @type {[...G]}
   */
  #guards;

  /** @type {O} */
  #isOptional;

  /**
   * @param {[...G]} guards
   * @param {{ isOptional: O }} options
   */
  constructor(guards, options) {
    this.#guards = guards;
    this.#isOptional = options.isOptional;
  }

  isOptional() {
    return this.#isOptional;
  }

  /**
   * @param {unknown} v
   * @returns {v is Infer<G>}
   */
  isSatisfiedBy(v) {
    return (
      Array.isArray(v) &&
      v.length === this.#guards.length &&
      this.#guards.every((guard) => guard.isSatisfiedBy(v))
    );
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
    return new TupleGuard(this.#guards, { isOptional: true });
  }

  required() {
    return new TupleGuard(this.#guards, { isOptional: false });
  }
}

/**
 * @template {[...import("./types.js").Guard<unknown, boolean>[]]} G
 * @param {[...G]} guards
 */
export function tuple(guards) {
  return new TupleGuard(guards, { isOptional: false });
}
