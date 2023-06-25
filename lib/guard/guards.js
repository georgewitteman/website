/**
 * @param {unknown} v
 * @returns {v is null}
 */
export function isNull(v) {
  return v === null;
}

/**
 * @param {unknown} v
 * @returns {v is undefined}
 */
export function isUndefined(v) {
  return v === undefined;
}

/**
 * @param {unknown} v
 * @returns {v is string}
 */
export function isString(v) {
  return typeof v === "string";
}

/**
 * @param {unknown} v
 * @returns {v is number}
 */
export function isNumber(v) {
  return typeof v === "number";
}

/**
 * @param {unknown} v
 * @returns {v is Function}
 */
export function isFunction(v) {
  return typeof v === "function";
}

/**
 * @param {unknown} v
 * @returns {v is symbol}
 */
export function isSymbol(v) {
  return typeof v === "symbol";
}

/**
 * @param {unknown} v
 * @returns {v is bigint}
 */
export function isBigInt(v) {
  return typeof v === "bigint";
}

/**
 * @param {unknown} v
 * @returns {v is boolean}
 */
export function isBoolean(v) {
  return typeof v === "boolean";
}

/**
 * @template {null | undefined | string | number | boolean | symbol | bigint} T
 * @param {T} value
 */
export function isLiteral(value) {
  /**
   * @param {unknown} v
   * @returns {v is T}
   */
  const guard = (v) => v === value;
  return guard;
}

/**
 * @template {Function} T
 * @param {T} klass
 */
export function isInstanceOf(klass) {
  /**
   * @param {unknown} v
   * @returns {v is InstanceType<T>}
   */
  const guard = (v) => v instanceof klass;
  return guard;
}

/**
 * @template {import("./types.js").Guard<unknown, boolean>} V
 * @param {V} valueGuard
 */
export function isRecord(valueGuard) {
  /**
   * @param {unknown} v
   * @returns {v is Record<PropertyKey, import("./types.js").TypeOf<V>>}
   */
  const guard = (v) => {
    return (
      v !== null &&
      typeof v === "object" &&
      Object.values(v).every(valueGuard.isSatisfiedBy.bind(valueGuard))
    );
  };
  return guard;
}
