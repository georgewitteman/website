import { Simplify } from "../../../../utils.js";

export type Guard<T, O extends boolean> = {
  readonly isSatisfiedBy: (v: unknown) => v is T;
  readonly isOptional: () => O;
  readonly undefined: () => Guard<T | undefined, O>;
  readonly null: () => Guard<T | null, O>;
  readonly nullish: () => Guard<T | null | undefined, O>;
  readonly optional: () => Guard<T, true>;
  readonly required: () => Guard<T, false>;
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
