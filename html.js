import assert from "node:assert";
import { g } from "./lib/guard/externals.js";

/** @typedef {import("./html-types.js").Node} Node */
/** @typedef {import("./html-types.js").HTMLElement} HTMLElement */
/** @typedef {import("./html-types.js").SafeText} SafeText */
/** @typedef {import("./html-types.js").VoidTagName} VoidTagName */
/** @typedef {import("./html-types.js").Component} Component */

// https://developer.mozilla.org/en-US/docs/Glossary/Void_element
const VOID_TAG_NAME_REGEX =
  /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/g;

export const NBSP = /** @type {const} */ ("\u00a0");

/**
 * @param {string} char
 * @return {`&${string};`}
 */
function getHtmlEntity(char) {
  assert.strictEqual(char.length, 1);

  // https://html.spec.whatwg.org/multipage/named-characters.html#named-character-references
  switch (char) {
    case "&":
      return "&amp;";
    case "<":
      return "&lt;";
    case ">":
      return "&gt;";
    case '"':
      return "&quot;";
    case "'":
      return "&apos;";
    case "`":
      return "&grave;";
    case NBSP:
      return "&nbsp;";
    case "\u2039":
      return "&lsaquo;";
    default:
      return `&#${char.charCodeAt(0)};`;
  }
}

/**
 * https://github.com/zspecza/common-tags/blob/master/src/safeHtml/safeHtml.js
 * @param {string} unsafe
 */
function escapeHtml(unsafe) {
  // return unsafe.replaceAll(/[^A-Za-z0-9 _-]/g, getHtmlEntity);
  return unsafe.replaceAll(/[&<>"'`]/g, getHtmlEntity);
}

/**
 * @param {string} attributeName
 */
function formatAttributeName(attributeName) {
  // https://stackoverflow.com/questions/925994/what-characters-are-allowed-in-an-html-attribute-name#comment33673269_926136
  if (!/^([^\t\n\f />"'=]+)$/g.test(attributeName)) {
    throw new Error(`Invalid property name: ${attributeName}`);
  }
  switch (attributeName) {
    case "className":
      return "class";
    default:
      return attributeName;
  }
}

// Using a whitelist here for safety
// https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(double-quoted)-state
const DOUBLE_QUOTED_ATTRIBUTE_UNSAFE = /[^A-Za-z0-9 -_/-=]/g;

/**
 * https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(double-quoted)-state
 * @param {string} unsafe
 * @returns {string}
 */
function escapeDoubleQuotedAttribute(unsafe) {
  return unsafe.replaceAll(DOUBLE_QUOTED_ATTRIBUTE_UNSAFE, getHtmlEntity);
}

/**
 * @param {Record<string, string | boolean>} props
 */
function getAttributesAsString(props) {
  const entries = Object.entries(props);
  if (entries.length === 0) {
    return "";
  }
  return (
    " " +
    entries
      .map(([key, value]) => {
        if (typeof value === "string") {
          return `${formatAttributeName(key)}="${escapeDoubleQuotedAttribute(
            value,
          )}"`;
        }
        if (typeof value === "boolean") {
          return value ? formatAttributeName(key) : undefined;
        }
        throw new Error("Invalid prop type");
      })
      .filter((prop) => typeof prop === "string")
      .join(" ")
  );
}

/**
 * @template {unknown} P
 * @typedef {{ guard: import("./lib/guard/types.js").Guard<P, false>, component: (props: P, children: Node[]) => Node }} ComponentHelper
 */

/**
 * @template {unknown} P
 * @param {import("./lib/guard/types.js").Guard<P, false>} guard
 * @param {(props: P, children: Node[]) => Node} component
 * @returns {ComponentHelper<P>}
 */
export function createComponent(guard, component) {
  return { guard, component };
}

/**
 * @template {unknown} T
 * @template {ComponentHelper<T>} C
 * @param {C} component
 * @param {T} props
 * @param {Node[]} [children]
 * @returns {Component}
 */
export function c(component, props, children) {
  const { guard, component: originalComponent } = component;

  /**
   * @param {unknown} props
   * @param {Node[]} children
   */
  const finalComponent = (props, children) => {
    assert(guard.isSatisfiedBy(props));
    return originalComponent(props, children);
  };

  return {
    type: "component",
    component: finalComponent,
    props,
    children: children ?? [],
  };
}

/**
 * @template {string} TagName
 * @param {TagName} tagName
 * @param {Record<string, string | boolean>} [attributes]
 * @param {TagName extends VoidTagName ? undefined : Node[]} [children]
 * @returns {HTMLElement}
 */
export function h(tagName, attributes, children) {
  return {
    type: "html",
    tagName,
    attributes: attributes ?? {},
    children: children ?? [],
  };
}

/**
 * @template {string | ComponentHelper<PropsType>} NodeType
 * @template {NodeType extends string ? Record<string, string | boolean> : unknown} PropsType
 * @param {NodeType} type
 * @param {PropsType} props
 * @param {NodeType extends VoidTagName ? undefined : Node[]} [children]
 */
export function e(type, props, children) {
  if (typeof type === "string") {
    if (g.record(g.string().or(g.boolean())).isSatisfiedBy(props)) {
      return h(type, props, children);
    }
    console.log(type, props);
    throw new Error("Invalid prop types passed to e()");
  }
  if (typeof type === "object") {
    if (!type.guard.isSatisfiedBy(props)) {
      throw new Error("Invalid props passed to component");
    }
    return c(type, props, children);
  }
  throw new Error("invalid type");
}

/**
 * @param {string} value
 * @returns {import("./html.d.ts").SafeText}
 */
export function UNSAFE_escaped(value) {
  return { type: "safe-text", value };
}

/**
 * @param {Node} node
 * @returns {string}
 */
function renderNode(node) {
  if (typeof node === "string") {
    return escapeHtml(node);
  }

  if (node.type === "safe-text") {
    return node.value;
  }

  if (node.type === "component") {
    const { component, props, children } = node;
    return renderNode(component(props, children));
  }

  const attributes = getAttributesAsString(node.attributes);

  if (VOID_TAG_NAME_REGEX.test(node.tagName)) {
    assert.strictEqual(node.children.length, 0);

    return `<${node.tagName}${attributes}>`;
  }

  const renderedChildren = node.children.map(renderNode);
  return `<${node.tagName}${attributes}>${renderedChildren.join("")}</${
    node.tagName
  }>`;
}

/**
 * @param {Node} rootNode
 * @returns {string}
 */
export function render(rootNode) {
  return `<!DOCTYPE html>${renderNode(rootNode)}`;
}

const TestComponent = createComponent(
  g.object({ href: g.string() }),
  (props, children) => {
    return e("a", { href: props.href }, children);
  },
);

const NoPropsComponent = createComponent(g.object({}), () => {
  return e("br", {});
});

console.log(
  render(e("html", {}, [e(TestComponent, { href: "the-href" }, ["foo"])])),
);

console.log(
  render(
    e("html", {}, [
      e("meta", {}),
      e(TestComponent, { href: "the-href" }),
      e(NoPropsComponent, {}),
    ]),
  ),
);
