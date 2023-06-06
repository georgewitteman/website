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
    this.issues.push(issue);
  }
}

/**
 * @template Output
 * @typedef {Object} ZodSchema
 * @property {(data: unknown) => ParseResult<Output>} parse
 */

/** @implements {ZodSchema<Date>} */
class ZodDateString {
  /**
   * @param {unknown} data
   * @returns {ParseResult<Date>}
   */
  parse(data) {
    const ctx = new ZodContextImpl();
    // https://tc39.es/ecma262/#sec-date-time-string-format
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/g;
    if (typeof data !== "string") {
      ctx.addIssue({ message: `data is not a string` });
      return { ok: false, error: ctx.issues };
    }
    if (!dateRegex.test(data)) {
      ctx.addIssue({ message: `${data} is not an ISO8601 formatted string` });
      return { ok: false, error: ctx.issues };
    }
    const date = new Date(data);
    if (isNaN(date.valueOf())) {
      ctx.addIssue({
        message: `${data} can not be converted into a Date object`,
      });
      return { ok: false, error: ctx.issues };
    }
    return { ok: true, data: date };
  }
}

/**
 * @template T
 * @implements {ZodSchema<T | undefined>}
 */
class ZodOptional {
  /** @type {ZodSchema<T>} */
  #schema;

  /**
   * @param {ZodSchema<T>} schema
   */
  constructor(schema) {
    this.#schema = schema;
  }

  /**
   * @param {unknown} data
   * @returns {ParseResult<T | undefined>}
   */
  parse(data) {
    if (data === undefined) {
      return { ok: true, data };
    }
    return this.#schema.parse(data);
  }
}

/**
 * @template T
 * @implements {ZodSchema<T | null | undefined>}
 */
class ZodNullish {
  /** @type {ZodSchema<T>} */
  #schema;

  /**
   * @param {ZodSchema<T>} schema
   */
  constructor(schema) {
    this.#schema = schema;
  }

  /**
   * @param {unknown} data
   * @returns {ParseResult<T | null | undefined>}
   */
  parse(data) {
    if (data === undefined || data === null) {
      return { ok: true, data };
    }
    return this.#schema.parse(data);
  }
}

/** @implements {ZodSchema<string>} */
class ZodString {
  /**
   * @param {unknown} data
   * @param {ZodContext} ctx
   * @return {data is string}
   */
  isSatisfiedBy(data, ctx) {
    if (typeof data === "string") {
      return true;
    }
    ctx.addIssue({ message: `data is not a string` });
    return false;
  }

  optional() {
    return new ZodOptional(this);
  }

  nullish() {
    return new ZodNullish(this);
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
      };
    }
    return {
      ok: false,
      error: ctx.issues,
    };
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
      ctx.addIssue({ message: `data is not a number` });
      return false;
    }
    if (isNaN(data)) {
      ctx.addIssue({ message: `${data} is NaN` });
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
      };
    }
    return {
      ok: false,
      error: ctx.issues,
    };
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
  return typeof obj === "object" && obj !== null;
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
   * @returns {ParseResult<Output>}
   */
  parse(data) {
    /** @type {Record<string, unknown>} */
    const result = {};
    const ctx = new ZodContextImpl();

    if (!isRecord(data)) {
      ctx.addIssue({ message: `data is not a record` });
      return { ok: false, error: ctx.issues };
    }

    if (!Object.keys(data).every((key) => key in this.schema)) {
      ctx.addIssue({ message: `data had an unexpected key` });
      return { ok: false, error: ctx.issues };
    }

    for (const [key, schema] of Object.entries(this.schema)) {
      const subResult = schema.parse(data[key]);
      if (!subResult.ok) {
        for (let issue of subResult.error) {
          if ("path" in issue) {
            ctx.addIssue({
              message: issue.message,
              path: [key, ...issue.path],
            });
          } else {
            ctx.addIssue({ message: issue.message, path: [key] });
          }
        }
        return { ok: false, error: ctx.issues };
      }
      result[key] = subResult.data;
    }

    return {
      ok: true,
      data: /** @type {Output} */ (result),
    };
  }

  /**
   * @param {unknown} data
   * @returns {Output}
   */
  unsafeParse(data) {
    const result = this.parse(data);
    if (!result.ok) {
      const e = new Error("Invalid object");
      e.cause = result.error;
      throw e;
    }
    return result.data;
  }
}

/**
 * @template {number | undefined} Min
 * @template {number | undefined} Max
 * @template Value
 * @typedef {[Min, Max] extends [1, 1] ? [Value] : [Min, Max] extends [2, 2] ? [Value, Value] : [Min, Max] extends [0, 1] | [undefined, 1] ? [] | [Value] : Value[]} ArrayOfLength
 */

/**
 * @template {number | undefined} Min
 * @template {number | undefined} Max
 * @template {ZodSchema<unknown>} Schema
 * @template {ArrayOfLength<Min, Max, TypeOf<Schema>>} Output
 * @implements {ZodSchema<Output>}
 */
class ZodArray {
  /** @type {Min} */
  #min;
  /** @type {Max} */
  #max;

  /**
   * @param {Schema} schema
   * @param {{ min: Min; max: Max}} options
   */
  constructor(schema, options) {
    /** @type {Schema} */
    this.schema = schema;
    this.#min = options.min;
    this.#max = options.max;
    if (typeof options.min === "number") {
      if (!Number.isInteger(options.min)) {
        throw new Error("min must be an integer");
      }
    }
    if (typeof options.max === "number") {
      if (!Number.isInteger(options.max)) {
        throw new Error("max must be an integer");
      }
    }
  }

  /**
   * @template {number} N
   * @param {N} num
   */
  length(num) {
    return new ZodArray(this.schema, { min: num, max: num });
  }

  /**
   * @template {number} N
   * @param {N} num
   */
  max(num) {
    return new ZodArray(this.schema, { min: this.#min, max: num });
  }

  /**
   * @template {number} N
   * @param {N} num
   */
  min(num) {
    return new ZodArray(this.schema, { min: num, max: this.#max });
  }

  /**
   * @param {unknown} data
   * @returns {ParseResult<Output>}
   */
  parse(data) {
    const ctx = new ZodContextImpl();
    const result = [];
    if (!Array.isArray(data)) {
      ctx.addIssue({ message: `data is not an array` });
      return { ok: false, error: ctx.issues };
    }
    if (typeof this.#min === "number" && data.length < this.#min) {
      ctx.addIssue({ message: `${data.length} < ${this.#min}` });
      return { ok: false, error: ctx.issues };
    }
    if (typeof this.#max === "number" && data.length > this.#max) {
      ctx.addIssue({ message: `${data.length} > ${this.#max}` });
      return { ok: false, error: ctx.issues };
    }
    for (let i = 0; i < data.length; i++) {
      const subResult = this.schema.parse(data[i]);
      if (!subResult.ok) {
        ctx.addIssue({
          message: "bad array element",
          path: [i],
          issues: subResult.error,
        });
        continue;
      }
      result.push(subResult.data);
    }
    if (ctx.issues.length !== 0) {
      return {
        ok: false,
        error: ctx.issues,
      };
    }
    return {
      ok: true,
      data: /** @type {Output} */ (result),
    };
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
    ctx.addIssue({ message: `data was the wrong type` });
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
      };
    }
    return {
      ok: false,
      error: ctx.issues,
    };
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
  iso8601: () => new ZodDateString(),
  null: () => new GenericSchema(nullGuard),
  undefined: () => new GenericSchema(undefinedGuard),
  date: () => new GenericSchema(dateGuard),
  number2: () => new GenericSchema(numberGuard),
  string: () => new ZodString(),
  number: () => new ZodNumber(),
  object: /**
   * @template {Record<string, ZodSchema<unknown>>} Schema
   * @param {Schema} schema
   */ (schema) => new ZodObject(schema),
  array: /**
   * @template {ZodSchema<unknown>} Schema
   * @param {Schema} schema
   */ (schema) => new ZodArray(schema, { min: undefined, max: undefined }),
};
