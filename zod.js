/**
 * @template Output
 * @typedef {Object} ZodSchema
 * @property {(data: unknown) => data is Output} isSatisfiedBy
 */

/** @implements {ZodSchema<string>} */
class ZodString {
  /**
   * @param {unknown} data
   * @return {data is string}
   */
  isSatisfiedBy(data) {
    if (typeof data === "string") {
      return true
    }
    console.error(`${data} is not a string`)
    return false
  }
}

/** @implements {ZodSchema<number>} */
class ZodNumber {
  /**
   * @param {unknown} data
   * @return {data is number}
   */
  isSatisfiedBy(data) {
    if (typeof data !== "number") {
      console.error(`${data} is not a number`)
      return false;
    }
    if (isNaN(data)) {
      console.error(`${data} is NaN`)
      return false;
    }
    return true;
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
 * @template {Record<string, ZodSchema<unknown>>} Schema
 * @template {{[k in keyof Schema]: TypeOf<Schema[k]>}} Output
 * @implements {ZodSchema<Output>}
 * */
class ZodObject {
  /**
   *
   * @param {Schema} schema
   */
  constructor(schema) {
    /** @type {Schema} */
    this.schema = schema;
  }

  /**
   * @param {unknown} data
   * @return {data is Output}
   */
  isSatisfiedBy(data) {
    if (!isRecord(data)) {
      console.error("not a record")
      return false;
    }
    if (Object.entries(this.schema).reduce((prev, [key, schema]) => {
      if (!prev) {
        return prev;
      }
      if(schema.isSatisfiedBy(data[key])) {
        return true;
      }
      console.error(`${data} (${key}) is not ok`)
      return false;
    }, true)) {
      return true;
    }

    console.error(`${JSON.stringify(data)} is not an object`);
    return false;
  }
}

/**
 * @template {ZodSchema<unknown>} Schema
 * @template {TypeOf<Schema>[]} Output
 * @implements {ZodSchema<Output>}
 * */
class ZodArray {
  /**
   *
   * @param {Schema} schema
   */
  constructor(schema) {
    /** @type {Schema} */
    this.schema = schema;
  }

  /**
   * @param {unknown} data
   * @return {data is Output}
   */
  isSatisfiedBy(data) {
    console.log(`data: ${JSON.stringify(data)}`)
    if (!Array.isArray(data)) {
      console.error("Not an array")
      return false;
    }
    return data.reduce((previousValue, currentValue) => {
      console.log(`prev: ${previousValue} cur: ${currentValue}`)
      if (!previousValue) {
        return false;
      }
      if (this.schema.isSatisfiedBy(currentValue)) {
        return true;
      }
      console.error("array: field bad")
      return false;
    }, true)
  }
}

// TODO!
// - make all the type checking happen in type predicates https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates

const z = {
  string: () => new ZodString(),
  number: () => new ZodNumber(),
  object:
    /**
     * @template {Record<string, ZodSchema<unknown>>} Schema
     * @param {Schema} schema
     */ (schema) => new ZodObject(schema),
  array:
    /**
     * @template {ZodSchema<unknown>} Schema
     * @param {Schema} schema
     */ (schema) => new ZodArray(schema),
};

// TESTS
// TODO: Use node:test

const num = z.number();
/** @typedef {TypeOf<typeof num>} NumType */

const str = z.string();
/** @typedef {TypeOf<typeof str>} StrType */

const blah = new ZodObject({
  arr: z.array(z.object({ num: z.number() })),
  num: z.number(),
  str: z.string(),
  obj: z.object({ foo: z.string() }),
})

/** @typedef {typeof blah["schema"]} BlahSchemaType */
/** @typedef {TypeOf<typeof blah>} BlahType */

// object
console.log(
  blah.isSatisfiedBy({
    arr: [{ num: 123 }, { num: 456 }],
    num: 123,
    str: "abc",
    obj: { foo: "foo"},
  })
);
