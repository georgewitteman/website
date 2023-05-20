/**
 * @template Output
 * @typedef {Object} ZodSchema
 * @property {(data: unknown) => Output} parse
 */

/** @implements {ZodSchema<string>} */
class ZodString {
  /**
   * @param {unknown} data
   */
  parse(data) {
    if (typeof data === "string") {
      return data;
    }
    throw new Error("Input was not a string");
  }
}

/** @implements {ZodSchema<number>} */
class ZodNumber {
  /**
   * @param {unknown} data
   */
  parse(data) {
    if (typeof data === "number" && !isNaN(data)) {
      return data;
    }
    throw new Error("Input was not a number");
  }
}


/**
 * @template { [string, any]} T
 * @typedef { {[K in T[0]]: T extends [ K, any ] ? T[1] : never }} ObjectFromEntries
 */

/**
 * @template { [string, any]} T
 * @param { T[]} entries
 * @returns {ObjectFromEntries<T>}
 */
function fromEntries(entries) {
  return /** @type {ObjectFromEntries<T>} */ (Object.fromEntries(entries));
}

/**
 * @template {Record<string, unknown>} T
 * @param {T} obj
 * @returns {{ [K in keyof T]: [K, T[K]]; }[keyof T][]}
 */
function entries(obj) {
  return /** @type {{ [K in keyof T]: [K, T[K]]; }[keyof T][]} */ (Object.entries(obj));
}

const _testentries = entries({asdf: 123, asdf2: null})
const _testFromEntries = fromEntries(_testentries);
// const _blah = _testFromEntries.asdf2
const _testFromEntriesArr = fromEntries([[/** @type {const} */("asdf"), 123], [/** @type {const} */("asdf2"), null]])

/**
 * @template S
 * @typedef {S extends ZodSchema<infer A> ? A : never} TypeOf
 */

/**
 * https://stackoverflow.com/a/50512697
 * @template {Record<string, ZodString | ZodNumber>} T
 * @param {T} obj
 * @return {{[K in keyof T]: T[K]}}
 */
function asObject(obj) {
  return obj
}

/**
 * @template {string} Keys
 * @template {ZodString | ZodNumber} Schemas
 * @template {Record<Keys, Schemas>} Schema
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
    this.schema = asObject(schema);
  }

  /**
   * @param {unknown} data
   */
  parse(data) {
    if (typeof data !== "object" || data === null) {
      throw new Error("Input was not an object")
    }
    return /** @type {Output} */(fromEntries(entries(this.schema).map(
      ([key, schema]) => {
        if (key in data) {
          return [
            key,
            schema.parse(
             (/** @type {Record<keyof Schema, unknown>} */(data)[key])
            )
          ]
        }
        throw new Error(`key ${String(key)} not in the object`);
      }
    )));
  }
}

// TODO!
// - make all the type checking happen in type predicates https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates

const z = {
  string: () => new ZodString(),
  number: () => new ZodNumber(),
  object: (/** @type {any} */ schema) => new ZodObject(schema),
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
console.log(z.object({num: z.number(), str: z.string()}).parse({num: 123, str: "abc"}))
