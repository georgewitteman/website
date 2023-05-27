/**
 * @template T
 * @typedef {Object} ParseSuccess
 * @property {true} ok
 * @property {T} data
 */

/**
 * @template T
 * @typedef {Object} ParseFailure
 * @property {false} ok
 * @property {ZodIssue[]} error
 */

/**
 * @template T
 * @typedef {ParseSuccess<T> | ParseFailure<T>} ParseResult
 */

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
 * @property {(data: unknown) => ParseResult<Output>} parse
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

  /**
   * @param {unknown} data
   * @returns {ParseResult<string>}
   */
  parse(data) {
    const ctx = new ZodContextImpl();
    if (this.isSatisfiedBy(data, ctx)) {
      return {
        ok: true,
        data: data,
      }
    }
    return {
      ok: false,
      error: ctx.issues,
    }
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

  /**
   * @param {unknown} data
   * @returns {ParseResult<number>}
   */
  parse(data) {
    const ctx = new ZodContextImpl();
    if (this.isSatisfiedBy(data, ctx)) {
      return {
        ok: true,
        data: data,
      }
    }
    return {
      ok: false,
      error: ctx.issues,
    }
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
    if (!Object.keys(data).every(key => key in this.schema)) {
      ctx.addIssue({ message: `${data} had an unexpected key` });
      return false;
    }
    return Object.entries(this.schema).reduce((prev, [key, schema]) => {
      const subCtx = new ZodContextImpl();
      if(schema.isSatisfiedBy(data[key], subCtx)) {
        return prev;
      }
      for (let issue of subCtx.issues) {
        if ("path" in issue) {
          ctx.addIssue({ message: issue.message, path: [key, ...issue.path] })
        } else {
          ctx.addIssue({ message: issue.message, path: [key] });
        }
      }
      return false;
    }, true);
  }

  /**
   * @param {unknown} data
   * @returns {ParseResult<Output>}
   */
  parse(data) {
    const ctx = new ZodContextImpl();
    if (this.isSatisfiedBy(data, ctx)) {
      return {
        ok: true,
        data: data,
      }
    }
    return {
      ok: false,
      error: ctx.issues,
    }
  }
}

/**
 * @template {number | undefined} L
 * @template Value
 * @typedef {L extends 1 ? [Value] : L extends 2 ? [Value, Value] : Value[]} ArrayOfLength
 */

/**
 * @template {number | undefined} L
 * @template {ZodSchema<unknown>} Schema
 * @template {ArrayOfLength<L, TypeOf<Schema>>} Output
 * @implements {ZodSchema<Output>}
 */
class ZodArray {
  /** @type {L} */
  #length;

  /**
   * @param {Schema} schema
   * @param {{ length: L }} options
   */
  constructor(schema, options) {
    /** @type {Schema} */
    this.schema = schema;
    if (options && typeof options.length === "number") {
      if (!Number.isInteger(options.length)) {
        throw new Error("Length must be an integer");
      }
    }
    this.#length = options.length
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
    if (typeof this.#length === "number" && data.length !== this.#length) {
      ctx.addIssue({ message: `${data.length} !== ${this.#length}` });
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

  /**
   * @template {number} N
   * @param {N} num
   */
  length(num) {
    return new ZodArray(this.schema, { length: num });
  }

  /**
   * @param {unknown} data
   * @returns {ParseResult<Output>}
   */
  parse(data) {
    const ctx = new ZodContextImpl();
    if (this.isSatisfiedBy(data, ctx)) {
      return {
        ok: true,
        data: data,
      }
    }
    return {
      ok: false,
      error: ctx.issues,
    }
  }
}

/**
 * @template T
 * @typedef {(x: unknown) => x is T} TypeGuard
 */

/**
 * @template Output
 * @implements {ZodSchema<Output>}
 */
class GenericSchema {
  /**
   * @param {TypeGuard<Output>} guard
   */
  constructor(guard) {
    /** @type {TypeGuard<Output>} */
    this.guard = guard;
  }

  /**
   * @param {unknown} data
   * @param {ZodContext} ctx
   * @return {data is Output}
   */
  isSatisfiedBy(data, ctx) {
    if (this.guard(data)) {
      return true;
    }
    ctx.addIssue({ message: `${data} was the wrong type` });
    return false;
  }

  /**
   * @param {unknown} data
   * @returns {ParseResult<Output>}
   */
  parse(data) {
    const ctx = new ZodContextImpl();
    if (this.isSatisfiedBy(data, ctx)) {
      return {
        ok: true,
        data: data,
      }
    }
    return {
      ok: false,
      error: ctx.issues,
    }
  }
}

// TODO!
// - make all the type checking happen in type predicates https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates

/**
 * @param {unknown} data
 * @return {data is number}
 */
function numberGuard(data) {
  if (typeof data !== "number") {
    return false;
  }
  if (isNaN(data)) {
    return false;
  }
  return true;
}

/**
 * @param {unknown} data
 * @return {data is Date}
 */
function dateGuard(data) {
  return data instanceof Date;
}

/**
 * @param {unknown} data
 * @return {data is null}
 */
function nullGuard(data) {
  return data === null;
}

/**
 * @param {unknown} data
 * @return {data is undefined}
 */
function undefinedGuard(data) {
  return data === undefined;
}

export const z = {
  "null": () => new GenericSchema(nullGuard),
  "undefined": () => new GenericSchema(undefinedGuard),
  date: () => new GenericSchema(dateGuard),
  number2: () => new GenericSchema(numberGuard),
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
     */ (schema) => new ZodArray(schema, { length: undefined }),
};
