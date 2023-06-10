import assert from "node:assert";

const MODE_SLASH = 0;
const MODE_TEXT = 1;
const MODE_WHITESPACE = 2;
const MODE_TAGNAME = 3;
const MODE_COMMENT = 4;
const MODE_PROP_SET = 5;
const MODE_PROP_APPEND = 6;

const CHILD_APPEND = 0;
const CHILD_RECURSE = 2;
const TAG_SET = 3;
const PROPS_ASSIGN = 4;
const PROP_SET = MODE_PROP_SET;
const PROP_APPEND = MODE_PROP_APPEND;

export const evaluate = (h, built, fields, args) => {
  let tmp;

  // `build()` used the first element of the operation list as
  // temporary workspace. Now that `build()` is done we can use
  // that space to track whether the current element is "dynamic"
  // (i.e. it or any of its descendants depend on dynamic values).
  built[0] = 0;

  for (let i = 1; i < built.length; i++) {
    const type = built[i++];

    // Set `built[0]`'s appropriate bits if this element depends on a dynamic value.
    const value = built[i] ? ((built[0] |= type ? 1 : 2), fields[built[i++]]) : built[++i];

    if (type === TAG_SET) {
      args[0] = value;
    }
    else if (type === PROPS_ASSIGN) {
      args[1] = Object.assign(args[1] || {}, value);
    }
    else if (type === PROP_SET) {
      (args[1] = args[1] || {})[built[++i]] = value;
    }
    else if (type === PROP_APPEND) {
      args[1][built[++i]] += (value + '');
    }
    else if (type) { // type === CHILD_RECURSE
      // Set the operation list (including the staticness bits) as
      // `this` for the `h` call.
      tmp = h.apply(value, evaluate(h, value, fields, ['', null]));
      args.push(tmp);

      if (value[0]) {
        // Set the 2nd lowest bit it the child element is dynamic.
        built[0] |= 2;
      }
      else {
        // Rewrite the operation list in-place if the child element is static.
        // The currently evaluated piece `CHILD_RECURSE, 0, [...]` becomes
        // `CHILD_APPEND, 0, tmp`.
        // Essentially the operation list gets optimized for potential future
        // re-evaluations.
        built[i - 2] = CHILD_APPEND;
        built[i] = tmp;
      }
    }
    else { // type === CHILD_APPEND
      args.push(value);
    }
  }

  return args;
};

/**
 * @param {{ apply: (arg0: null, arg1: any) => any; }} h
 */
export function makeBuild(h) {
  /**
   * https://github.com/developit/htm
   * @param {TemplateStringsArray} statics
   * @param {unknown[]} fields
   */
  return function build(statics, ...fields) {
    let mode = MODE_TEXT;
    let buffer = '';
    let quote = '';
    let current = [0];
    /**
     * @type {string}
     */
    let char;
    /**
     * @type {string}
     */
    let propName;

    const commit = (/** @type {number | undefined} */ field) => {
      if (mode === MODE_TEXT && (field || (buffer = buffer.replace(/^\s*\n\s*|\s*\n\s*$/g, '')))) {
        current.push(field ? fields[field] : buffer);
      }
      else if (mode === MODE_TAGNAME && (field || buffer)) {
        current[1] = field ? fields[field] : buffer;
        mode = MODE_WHITESPACE;
      }
      else if (mode === MODE_WHITESPACE && buffer === '...' && field) {
        current[2] = Object.assign(current[2] || {}, fields[field]);
      }
      else if (mode === MODE_WHITESPACE && buffer && !field) {
        (current[2] = current[2] || {})[buffer] = true;
      }
      else if (mode >= MODE_PROP_SET) {
        if (mode === MODE_PROP_SET) {
          (current[2] = current[2] || {})[propName] = field ? buffer ? (buffer + fields[field]) : fields[field] : buffer;
          mode = MODE_PROP_APPEND;
        }
        else if (field || buffer) {
          current[2][propName] += field ? buffer + fields[field] : buffer;
        }
      }

      buffer = '';
    };

    for (let i = 0; i < statics.length; i++) {
      if (i) {
        if (mode === MODE_TEXT) {
          commit();
        }
        commit(i);
      }

      const staticsI = statics[i];
      assert(typeof staticsI !== "undefined");

      for (let j = 0; j < staticsI.length; j++) {
        const maybeChar = staticsI[j];
        assert(typeof maybeChar === "string")
        char = maybeChar;

        if (mode === MODE_TEXT) {
          if (char === '<') {
            // commit buffer
            commit();
            current = [current, '', null];
            mode = MODE_TAGNAME;
          }
          else {
            buffer += char;
          }
        }
        else if (mode === MODE_COMMENT) {
          // Ignore everything until the last three characters are '-', '-' and '>'
          if (buffer === '--' && char === '>') {
            mode = MODE_TEXT;
            buffer = '';
          }
          else {
            buffer = char + buffer[0];
          }
        }
        else if (quote) {
          if (char === quote) {
            quote = '';
          }
          else {
            buffer += char;
          }
        }
        else if (char === '"' || char === "'") {
          quote = char;
        }
        else if (char === '>') {
          commit();
          mode = MODE_TEXT;
        }
        else if (!mode) {
          // Ignore everything until the tag ends
        }
        else if (char === '=') {
          mode = MODE_PROP_SET;
          propName = buffer;
          buffer = '';
        }
        else if (char === '/' && (mode < MODE_PROP_SET || staticsI[j + 1] === '>')) {
          commit();
          if (mode === MODE_TAGNAME) {
            current = current[0];
          }
          mode = current;
          (current = current[0]).push(h.apply(null, mode.slice(1)));
          mode = MODE_SLASH;
        }
        else if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
          // <a disabled>
          commit();
          mode = MODE_WHITESPACE;
        }
        else {
          buffer += char;
        }

        if (mode === MODE_TAGNAME && buffer === '!--') {
          mode = MODE_COMMENT;
          current = current[0];
        }
      }
    }
    commit();

    return current.length > 2 ? current.slice(1) : current[1];
  };

}
