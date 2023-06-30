import { BasicGuard } from "./BasicGuard.js";
import { object } from "./ObjectGuard.js";
import {
  isBigInt,
  isBoolean,
  isFunction,
  isNull,
  isNumber,
  isString,
  isSymbol,
  isUndefined,
  isLiteral,
  isInstanceOf,
  isRecord,
} from "./guards.js";
import { array } from "./ArrayGuard.js";
import { tuple } from "./TupleGuard.js";

/**
 * @template {null | undefined | string | number | boolean | symbol | bigint} T
 * @param {T} value
 */
function literal(value) {
  return new BasicGuard(isLiteral(value), { isOptional: false });
}

/**
 * @template {Function} T
 * @param {T} klass
 */
function instanceOf(klass) {
  return new BasicGuard(isInstanceOf(klass), { isOptional: false });
}

/**
 * @template {import("./types.js").Guard<unknown, boolean>} V
 * @param {V} valueGuard
 */
function record(valueGuard) {
  return new BasicGuard(isRecord(valueGuard), { isOptional: false });
}

export const g = {
  null: () => new BasicGuard(isNull, { isOptional: false }),
  undefined: () => new BasicGuard(isUndefined, { isOptional: false }),
  string: () => new BasicGuard(isString, { isOptional: false }),
  number: () => new BasicGuard(isNumber, { isOptional: false }),
  function: () => new BasicGuard(isFunction, { isOptional: false }),
  symbol: () => new BasicGuard(isSymbol, { isOptional: false }),
  bigint: () => new BasicGuard(isBigInt, { isOptional: false }),
  boolean: () => new BasicGuard(isBoolean, { isOptional: false }),
  record,
  instanceOf,
  literal,
  object,
  array,
  tuple,
};
