/**
 * https://github.com/sindresorhus/type-fest/blob/main/source/simplify.d.ts
 */
export type Simplify<T> = {
  [KeyType in keyof T]: T[KeyType];
} & NonNullable<unknown>;

export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONArray
  | { [key in string]: JSONValue };

export type JSONArray = JSONValue[];
