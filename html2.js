import assert from "assert";

/**
 * https://github.com/WebReflection/html-escaper
 * @param {string} unsafe
 */
function escapeHtml(unsafe) {
  if (unsafe.match(/^[A-Za-z0-9 _-]*$/g)) {
    return unsafe;
  }
  return unsafe.replace(/[^A-Za-z0-9_-]/g, (c) => `&#${c.charCodeAt(0)};`);
}

// https://github.com/preactjs/preact/blob/841ef82648b85dbb12dc17a47d7f79f000492030/test/_util/helpers.js#L46
const VOID_ELEMENTS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];

/**
 * @param {string} key
 */
function getPropKey(key) {
  // https://stackoverflow.com/questions/925994/what-characters-are-allowed-in-an-html-attribute-name#comment33673269_926136
  if (!key.match(/^([^\t\n\f />"'=]+)$/g)) {
    throw new Error(`Invalid property name: ${key}`);
  }
  if (key === "class") {
    throw new Error("Use 'className' instead of 'class'");
  }
  switch (key) {
    case "className":
      return "class";
    default:
      return key;
  }
}

/**
 * @param {Record<string, string>} props
 */
function getStringProps(props) {
  return Object.entries(props)
    .map(([key, value]) => `${getPropKey(key)}="${escapeHtml(value)}"`)
    .join(" ");
}

/**
 * @param {(VNode | string)[] | VNode | string} elements
 */
export function render(elements) {
  if (typeof elements === "string") {
    return elements;
  }
  if (!Array.isArray(elements)) {
    return render([elements]);
  }
  // https://josephmate.github.io/java/javascript/stringbuilder/2020/07/27/javascript-does-not-need-stringbuilder.html
  let result = "";
  for (const element of elements) {
    if (typeof element === "string") {
      result += element;
      continue;
    }
    const stringProps = getStringProps(element.props);
    result += `<${element.tag}${stringProps ? " " : ""}${stringProps}>`;
    if (VOID_ELEMENTS.includes(element.tag)) {
      if (element.children) {
        throw new Error(`${element.tag} is not allowed to have children`);
      }
      continue;
    }
    result += `${render(element.children)}</${element.tag}>`;
  }
  return result;
}

/**
 * @param {string | (string | VNode)[] | undefined} children
 */
function cleanChildren(children) {
  if (Array.isArray(children)) {
    return children;
  }
  if (typeof children === "string") {
    return [children];
  }
  return [];
}

/** @typedef {string | VNode} ChildNode */
/** @typedef {Record<string, string> & { class?: never }} Props */

export class VNode {
  /**
   *
   * @param {string} tag
   * @param {Props} props
   * @param  {ChildNode[]} children
   */
  constructor(tag, props, children) {
    this.tag = tag;
    this.props = props;
    this.children = children;
  }
}

/**
 * @template {Props | null | undefined} T
 * @param {string | ((props: T & { children: ChildNode[] }) => VNode)} tag
 * @param {T} props
 * @param {ChildNode[]} [children]
 * @returns {VNode}
 */
export function h(tag, props, children) {
  if (typeof tag === "function") {
    return tag({ ...props, children: cleanChildren(children) });
  }
  return new VNode(tag, props ?? {}, cleanChildren(children));
}

const Mode = /** @type {const} */({
  Slash: 0,
  Text: 1,
  Whitespace: 2,
  TagName: 3,
  Comment: 4,
  PropSet: 5,
  PropAppend: 6,
});

/** @typedef {ChildNode | ChildNode[] | ((props: (Props | null | undefined) & { children: ChildNode[] }) => VNode)} Fields */

/**
 * https://github.com/developit/htm
 * @param {TemplateStringsArray} strings
 * @param {Fields[]} fields
 * @returns {VNode}
 */
export function html(strings, ...fields) {
  /** @type {typeof Mode[keyof typeof Mode]} */
  let mode = Mode.Text;
  /** @type {{ tag: string | null; props: Props; children: ChildNode[] }} */
  let current = {
    tag: null,
    props: {},
    children: [],
  }
  /** @type {typeof current[]} */
  let parents = [];
  let buffer = "";
  let propName = "";
  let quote = "";

  // TODO: Need to update this to support more than just strings
  const commit = (/** @type {ChildNode | ChildNode[]} */value) => {
    buffer = '';
    if (mode === Mode.Text && value) {
      if (Array.isArray(value)) {
        value.forEach(v => current.children.push(v));
        return;
      }
      current.children.push(value);
      return;
    }

    if (mode === Mode.TagName && typeof value === "string") {
      current.tag = value;
      return;
    }

    // if (mode === Mode.Whitespace) {
    //   // <a disabled>
    //   current.props[value] = true;
    //   return;
    // }

    if (mode === Mode.PropSet && typeof value === "string" || typeof value === "boolean") {
      current.props[propName] = value;
      return;
    }
  }

  strings.forEach((string, i) => {
    if (i) {
      if (mode === Mode.Text) {
        commit(buffer);
      }
      const field = fields[i];
      if (field) {
        // TODO: Update this to support undefined fields (and other types)
        commit(field);
      }
    }

    [...string].forEach((char, j) => {
      if (mode === Mode.Text) {
        if (char === "<") {
          commit(buffer);
          // console.log("blah", current, parents);
          parents.push(current);
          current = { tag: null, props: {}, children: [] };
          mode = Mode.TagName
        } else {
          buffer += char;
        }
      } else if (quote) {
        if (char === quote) {
          quote = "";
        } else {
          buffer += char;
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        // if (mode === Mode.Slash) {
        //   assert.strictEqual(current.tag, buffer)
        // }
        commit(buffer);
        mode = Mode.Text;
      } else if (mode === Mode.Slash) {
        // Ignore everything until the tag ends
        buffer += char;
      } else if (char === "=") {
        mode = Mode.PropSet;
        propName = buffer;
        buffer = "";
      } else if (char === "/") {
        if (mode === Mode.TagName) {
          // End of a tag
          // console.log(stack, current);
          // assert.deepStrictEqual(buffer, current.tag);
          const top = parents.pop();
          assert(top, "blah")
          current = top
          buffer = "";
        }
        const parent = parents.pop();
        assert(parent, "Parent should exist");
        // assert(current.tag, "Current tag should be set");
        // if (current.tag) {
        parent.children.push(h(current.tag, current.props, current.children));
        // }
        current = parent;
        mode = Mode.Slash;
      } else if (char === " " || char === "\t" || char === "\n" || char === "\r") {
        commit(buffer);
        mode = Mode.Whitespace;
      } else {
        buffer += char;
      }
    });
  });
  commit(buffer);
  if (parents.length > 1) {
    const parent = parents.pop();
    assert(parent, "Parent should exist 2");
    parent.children.push(h(current.tag, current.props, current.children));
    current = parent;
  }
  return h(current.tag, current.props, current.children);
  // return { current, parents }
}

console.log("Foo", html`Foo`);
console.log();
console.log(`<p>Foo</p>`, html`<p>Foo</p>`);
console.log();
console.log(`<p class="foo">Foo</p>`, html`<p class="foo">Foo</p>`);
console.log();
console.log(`<h1 class="h1c"><h2 class="h2c">Foo</h2>Bar</h1>`)
console.dir(html`<h1 class="h1c"><h2 class="h2c">Foo</h2>Bar</h1>`, { depth: null });

console.log();
/** @param {{ children: VNode[] }} props */
function Component(props) { return html`<div className="child">${props.children}</div>`}
console.log(`<h1 class="h1c"><h2 class="h2c">Foo</h2><${Component}><span>hi</span><p>hi2</p></${Component}></h1>`)
console.dir(html`<h1 class="h1c"><h2 class="h2c">Foo</h2><${Component}><span>hi</span><p>hi2</p></${Component}></h1>`, { depth: null });
  // /** @type {typeof Mode[keyof typeof Mode]} */
  // let mode = Mode.Text;
  // let buffer = '';
  // let quote = '';
  // /** @type {unknown[]} */
  // let current = [0];
  // // /** @type {string} */
  // // let char;
  // /** @type {string} */
  // let propName;

  // /**
  //  * @param {number} [fieldIndex]
  //  */
  // const commit = (fieldIndex) => {
  //   if (mode === Mode.Text) {
  //     if (fieldIndex) {
  //       const fieldAtFieldIndex = fields[fieldIndex];
  //       current.push(fieldAtFieldIndex)
  //       return;
  //     }
  //     // eslint-disable-next-line no-cond-assign
  //     if (buffer = buffer.replace(/^\s*\n\s*|\s*\n\s*$/g, '')) {
  //       return;
  //     }
  //     // throw new Error("Why did I get here 1?")
  //   }
  //   if (mode === Mode.TagName) {
  //     if (fieldIndex) {
  //       current[1] = fields[fieldIndex];
  //       mode = Mode.Whitespace;
  //       return;
  //     }
  //     if (buffer) {
  //       current[1] = buffer;
  //       mode = Mode.Whitespace;
  //       return
  //     }
  //     throw new Error("Why did I get here 2?");
  //   }
  //   if (mode === Mode.Whitespace) {
  //     if (buffer === "..." && fieldIndex) {
  //       // Assign next field to props (props at current[2])
  //       current[2] = Object.assign(current[2] || {}, fields[fieldIndex]);
  //       return;
  //     }
  //     if (buffer && !fieldIndex) {
  //       // @ts-expect-error TODO
  //       (current[2] = current[2] || {})[buffer] = true;
  //       return;
  //     }
  //     throw new Error("Why did I get here 3?");
  //   }
  //   if (mode >= Mode.PropSet) {
  //     if (mode === Mode.PropSet) {
  //       // @ts-expect-error TODO
  //       // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
  //       (current[2] = current[2] || {})[propName] = fieldIndex ? buffer ? (buffer + fields[fieldIndex]) : fields[fieldIndex] : buffer;
  //       mode = Mode.PropAppend;
  //       return;
  //     }
  //     if (fieldIndex || buffer) {
  //       // @ts-expect-error TODO
  //       // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
  //       current[2][propName] += fieldIndex ? buffer + fields[fieldIndex] : buffer;
  //       return;
  //     }
  //     buffer = '';
  //   }
  //   // throw new Error("Why did I get here 4?")
  // }

  // strings.forEach((string, i) => {
  //   if (i) {
  //     if (mode === Mode.Text) {
  //       commit();
  //     }
  //     commit(i);
  //   }

  //   [...string].forEach((char, j) => {
  //     if (mode === Mode.Text) {
  //       if (char === "<") {
  //         // TAG START
  //         // commit buffer
  //         commit();
  //         current = [current, '', null];
  //         mode = Mode.TagName;
  //       } else {
  //         // READ TEXT
  //         buffer += char;
  //       }
  //     } else if (mode === Mode.Comment) {
  //       // Ignore everything until the last three characters are '-', '-' and '>'
  //       if (buffer === '---' && char === ">") {
  //         // END COMMENT
  //         mode = Mode.Text;
  //         buffer = '';
  //       } else {
  //         // IGNORING COMMENT
  //         assert(buffer[0]);
  //         buffer = char + buffer[0];
  //       }
  //     } else if (quote) {
  //       if (char === quote) {
  //         // FINISH QUOTE
  //         quote = '';
  //       } else {
  //         // ADD TO QUOTED TEXT
  //         buffer += char;
  //       }
  //     } else if (char === '"' || char === "'") {
  //       // BEGIN QUOTE
  //       quote = char;
  //     } else if (char === ">") {
  //       // END TAG, BEGIN TEXT
  //       commit();
  //       mode = Mode.Text;
  //     } else if (!mode) {
  //       // ANYTHING EXCEPT SLASH
  //       // Ignore everything until the tag ends
  //     } else if (char === "="){
  //       // START PROP
  //       mode = Mode.PropSet;
  //       propName = buffer;
  //       buffer = '';
  //     } else if (char === "/" && (mode < Mode.PropSet || string[j + 1] === ">")) {
  //       commit();
  //       if (mode === Mode.TagName) {
//           // @ts-expect-error TODO
//           current = current[0];
//         }
//         const tmp = current;
//         // @ts-expect-error TODO
//         // eslint-disable-next-line @typescript-eslint/no-unsafe-call
//         (current = current[0]).push(h.apply(null, tmp.slice(1)));
//         mode = Mode.Slash;
//       } else if (char === " " || char === '\t' || char === '\n' || char === '\r') {
//         // <a disabled>
//         commit();
//         mode = Mode.Whitespace;
//       } else {
//         buffer += char;
//       }

//       if (mode === Mode.TagName && buffer === "!--") {
//         mode = Mode.Comment;
//         // @ts-expect-error TODO
//         current = current[0];
//       }
//     });
//   })
//   commit();

//   return current.length > 2 ? current.slice(1) : current[1];
// }
