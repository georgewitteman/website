import { Simplify } from "../../utils.js";

export type Guard<T, O extends boolean> = {
  isSatisfiedBy: (v: unknown) => v is T;
  isOptional: () => O;
  undefined: () => Guard<T | undefined, O>;
  null: () => Guard<T | null, O>;
  nullish: () => Guard<T | null | undefined, O>;
  optional: () => Guard<T, true>;
  required: () => Guard<T, false>;
};

export type TypeOf<T> = T extends Guard<infer R, boolean> ? R : never;

export type UnShape<T extends Record<PropertyKey, Guard<unknown, boolean>>> =
  Simplify<
    {
      [K in keyof T as T[K] extends Guard<unknown, false> ? K : never]: TypeOf<
        T[K]
      >;
    } & {
      [K in keyof T as T[K] extends Guard<unknown, true> ? K : never]?: TypeOf<
        T[K]
      >;
    }
  >;

export type Constructor<T, Arguments extends unknown[] = unknown[]> = new (
  ...arguments_: Arguments
) => T;
