/**
 * @template Output
 * @typedef {Object} ZodSchema
 * @property {(data: unknown) => Output} parse
 * @property {(data: unknown, errors: string[]) => data is Output} isSatisfiedBy
 */

/** @implements {ZodSchema<string>} */
class ZodString {
  /**
   * @param {unknown} data
   * @param {string[]} errors
   * @return {data is string}
   */
  isSatisfiedBy(data, errors) {
    if (typeof data === "string") {
      return true
    }
    errors.push(`${data} is not a string`)
    return false
  }

  /**
   * @param {unknown} data
   */
  parse(data) {
    /** @type {string[]} */
    const errors = []
    if (this.isSatisfiedBy(data, errors)) {
      return data;
    }
    throw new Error("did not match schema");
  }
}

/** @implements {ZodSchema<number>} */
class ZodNumber {
  /**
   * @param {unknown} data
   * @param {string[]} errors
   * @return {data is number}
   */
  isSatisfiedBy(data, errors) {
    if (typeof data !== "number") {
      errors.push(`${data} is not a number`);
      return false;
    }
    if (isNaN(data)) {
      errors.push(`${data} is NaN`)
      return false;
    }
    return true;
  }

  /**
   * @param {unknown} data
   */
  parse(data) {
    /** @type {string[]} */
    const errors = []
    if (this.isSatisfiedBy(data, errors)) {
      return data;
    }
    throw new Error(errors.join(" "));
  }
}

/**
 * @template {ZodSchema<unknown>} S
 * @typedef {S extends ZodSchema<infer A> ? A : never} TypeOf
 */

/**
 * @template {string} T
 * @param {unknown} obj
 * @returns {obj is Record<T, unknown>}
 */
function isRecord(obj) {
  return typeof obj === 'object' && obj !== null;
}

/**
 * @template {string} Keys
 * @template {Record<Keys, ZodSchema<any>>} Schema
 * @template {{[key in keyof Schema]: TypeOf<Schema[key]>}} Output
 * @implements {ZodSchema<Output>}
 * */
class ZodObject {
  /**
   *
   * @param {Schema} schema
   */
  constructor(schema) {
    /** @type {{ [K in keyof Schema]: Schema[K]; }} */
    this.schema = schema;
  }

  /**
   * @param {unknown} data
   * @param {string[]} errors
   * @return {data is Output}
   */
  isSatisfiedBy(data, errors) {
    if (!isRecord(data)) {
      errors.push(`${data} is not an object`)
      return false;
    }
    return Object.entries(this.schema).reduce((prev, [key, schema]) => {
      if (!prev) {
        return prev;
      }
      return schema.isSatisfiedBy(data[key], errors);
    }, true);
  }

  /**
   * @param {unknown} data
   */
  parse(data) {
    /** @type {string[]} */
    const errors = []
    if (this.isSatisfiedBy(data, errors)) {
      return data;
    }
    throw new Error(errors.join(" "));
  }
}

// TODO!
// - make all the type checking happen in type predicates https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates

const z = {
  string: () => new ZodString(),
  number: () => new ZodNumber(),
  object: (
    /** @type {ConstructorParameters<typeof ZodObject>[0]} */ schema
  ) => new ZodObject(schema),
};

// TESTS
// TODO: Use node:test

/**
 * @param {any} callback
 */
function expectError(callback) {
  try {
    callback();
    throw "FAILED";
  } catch (e) {
    if (e === "FAILED") {
      console.assert(false, "Did not throw");
    }
  }
}

// string
console.assert(z.string().parse("asdf") === "asdf");
expectError(() => z.string().parse(123));

// number
console.assert(z.number().parse(123) === 123);
console.assert(z.number().parse(0) === 0);
console.assert(z.number().parse(-123) === -123);
expectError(() => z.number().parse("asdf"));
expectError(() => z.number().parse("123"));
expectError(() => z.number().parse(NaN));

// object
console.log(
  z.object({
    num: z.number(), str: z.string(), obj: z.object({foo: z.string()}),
  }).parse({
    num: 123, str: "abc", obj: { foo: "foo", bar: "bar" },
  })
);
