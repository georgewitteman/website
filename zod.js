/**
 * @typedef {Object} ZodObjectIssue
 * @property {string} message
 * @property {(string | number)[]} path
 * @property {ZodIssue[]} issues
 */

/**
 * @typedef {Object} ZodBasicIssue
 * @property {string} message
 */

/**
 * @typedef {ZodObjectIssue | ZodBasicIssue} ZodIssue
 */

/**
 * @typedef {Object} ZodContext
 * @property {(issue: ZodIssue) => void} addIssue
 * @property {ZodIssue[]} issues
 */

/** @implements {ZodContext} */
class ZodContextImpl {
  constructor() {
    /**
     * @type {ZodIssue[]}
     */
    this.issues = [];
  }

  /**
   * @param {ZodIssue} issue
   */
  addIssue(issue) {
    this.issues.push(issue)
  }
}

/**
 * @template Output
 * @typedef {Object} ZodSchema
 * @property {(data: unknown, ctx: ZodContext) => data is Output} isSatisfiedBy
 */

/** @implements {ZodSchema<string>} */
class ZodString {
  /**
   * @param {unknown} data
   * @param {ZodContext} ctx
   * @return {data is string}
   */
  isSatisfiedBy(data, ctx) {
    if (typeof data === "string") {
      return true
    }
    ctx.addIssue({message: `${data} is not a string`})
    return false
  }
}

/** @implements {ZodSchema<number>} */
class ZodNumber {
  /**
   * @param {unknown} data
   * @param {ZodContext} ctx
   * @return {data is number}
   */
  isSatisfiedBy(data, ctx) {
    if (typeof data !== "number") {
      ctx.addIssue({message:`${data} is not a number`})
      return false;
    }
    if (isNaN(data)) {
      ctx.addIssue({message:`${data} is NaN`})
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
   * @param {ZodContext} ctx
   * @return {data is Output}
   */
  isSatisfiedBy(data, ctx) {
    if (!isRecord(data)) {
      ctx.addIssue({message: `${data} is not a record`})
      return false;
    }
    return Object.entries(this.schema).reduce((prev, [key, schema]) => {
      const subCtx = new ZodContextImpl();
      if(schema.isSatisfiedBy(data[key], subCtx)) {
        return prev;
      }
      // TODO: Figure out how to do path stuff
      ctx.addIssue({message: `${data} (${key}) is not ok`, path: [key], issues: subCtx.issues })
      return false;
    }, true);
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
   * @param {ZodContext} ctx
   * @return {data is Output}
   */
  isSatisfiedBy(data, ctx) {
    if (!Array.isArray(data)) {
      ctx.addIssue({ message: `${data} is not an array` })
      return false;
    }
    return data.reduce((previousValue, currentValue, currentIndex) => {
      const subCtx = new ZodContextImpl();
      if (this.schema.isSatisfiedBy(currentValue, subCtx)) {
        return previousValue;
      }
      ctx.addIssue({message: "bad array element", path: [currentIndex], issues: subCtx.issues })
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

const ctx = new ZodContextImpl();
// object
console.log(
  blah.isSatisfiedBy({
    arr: [{ num: "foo" }, { num: 456 }],
    num: 123,
    str: "foo",
    obj: { foo: null },
  }, ctx)
);
console.dir(ctx.issues, { depth: null });
