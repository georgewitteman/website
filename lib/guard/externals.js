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
 * @template T
 * @param {new(...args: any[]) => T} Constructor
 */
function instanceOf(Constructor) {
  return new BasicGuard(isInstanceOf(Constructor), { isOptional: false });
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
  instanceOf,
  literal,
  object,
  array,
  tuple,
};
