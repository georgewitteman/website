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
 * @template T
 * @param {new(...args: any[]) => T} Constructor
 */
export function isInstanceOf(Constructor) {
  /**
   * @param {unknown} v
   * @returns {v is T}
   */
  const guard = (v) => v instanceof Constructor;
  return guard;
}
