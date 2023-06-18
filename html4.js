/*
Inspiration:
- https://github.com/jorgebucaran/hyperapp
- https://github.com/developit/htm
- https://preactjs.com/
- https://github.com/lukejacksonn/ijk
*/

class NormalElement {
  /**
   * @param {string} tag
   * @param {Record<string, string | boolean>} attrs
   * @param {Node[]} children
   */
  constructor(tag, attrs, children) {
    this.tag = tag;
    this.attrs = attrs;
    this.children = children;
  }
}

class SelfClosingElement {
  /**
   * @param {string} tag
   * @param {Record<string, string | boolean>} attrs
   */
  constructor(tag, attrs) {
    this.tag = tag;
    this.attrs = attrs;
  }
}

class SafeTextElement {
  /** @param {string} text */
  constructor(text) {
    this.text = text;
  }
}

/**
 * @typedef {string | NormalElement | SelfClosingElement | SafeTextElement} BaseNode
 * @typedef {BaseNode | Promise<BaseNode>} Node
 */

/**
 * @param {string} tag
 * @param {Record<string, string>} attrs
 * @param {Node[]} children
 */
export function e(tag, attrs, children) {
  return new NormalElement(tag, attrs, children);
}

/**
 * @param {string} text
 */
export function safeText(text) {
  return new SafeTextElement(text);
}

/**
 * @param {{ lang: "en" }} attrs
 * @param {Node[]} children
 */
export function html(attrs, children) {
  return new NormalElement("html", attrs, children);
}

/**
 * @param {Record<string, never>} attrs
 * @param {Node[]} children
 */
export function head(attrs, children) {
  return new NormalElement("head", attrs, children);
}

/**
 * @param {{ charset?: string; name?: string; content?: string }} attrs
 */
export function meta(attrs) {
  return new SelfClosingElement("meta", attrs);
}

/**
 * @param {{ type: "number", name: string, id: string, autofocus: boolean, value: string }} attrs
 */
export function input(attrs) {
  return new SelfClosingElement("input", attrs);
}

export function br() {
  return new SelfClosingElement("br", {});
}

/**
 * @param {{ rel: string; type?: string; href: string }} attrs
 */
export function link(attrs) {
  return new SelfClosingElement("link", attrs);
}

/**
 * @param {Record<string, never>} attrs
 * @param {Node[]} children
 */
export function title(attrs, children) {
  return new NormalElement("title", attrs, children);
}

/**
 * @param {{ className?: string }} attrs
 * @param {Node[]} children
 */
export function body(attrs, children) {
  return new NormalElement("body", attrs, children);
}

/**
 *
 * @param {{ type: "module", src: string, async?: boolean }} attrs
 * @returns
 */
export function script(attrs) {
  return new NormalElement("script", attrs, []);
}

/**
 * @typedef {{ className?: string; href: string }} A
 * @typedef {{ className?: string }} LI
 * @typedef {{ className?: string }} UL
 * @typedef {{ className?: string }} P
 * @typedef {{ className?: string }} Table
 * @typedef {{ className?: string }} THead
 * @typedef {{ className?: string }} TBody
 * @typedef {{ className?: string }} TR
 * @typedef {{ className?: string }} TH
 * @typedef {{ className?: string }} TD
 * @typedef {{ className?: string }} Header
 * @typedef {{ className?: string }} Nav
 * @typedef {{ className?: string }} Main
 * @typedef {{ className?: string }} Div
 * @typedef {{ className?: string }} Heading
 * @typedef {{ className?: string, id?: string }} Form
 * @typedef {{ className?: string, for?: string }} Label
 * @typedef {{ className?: string, for?: string, id?: string}} Output
 * @typedef {{ className?: string, id?: string, type: "button" | "submit" }} Button
 * @typedef {{ a: A; li: LI, ul: UL, p: P, table: Table, thead: THead, tbody: TBody, tr: TR, th: TH, td: TD, header: Header, nav: Nav, main: Main, div: Div, h1: Heading, h2: Heading, h3: Heading, h4: Heading, h5: Heading, h6: Heading, form: Form, label: Label, button: Button, output: Output }} TagMap
 */

/**
 * @template {keyof TagMap} Tag
 * @param {Tag} tag
 * @returns {{(props: TagMap[Tag], children: Node[]): NormalElement; (props: Node[], children?: never): NormalElement}}
 */
function normalTag(tag) {
  return (props, children) => {
    const c = Array.isArray(props) ? props : children ?? [];
    return new NormalElement(tag, Array.isArray(props) ? {} : props, c);
  };
}

export const a = normalTag("a");
export const li = normalTag("li");
export const ul = normalTag("ul");
export const p = normalTag("p");
export const table = normalTag("table");
export const thead = normalTag("thead");
export const tbody = normalTag("tbody");
export const tr = normalTag("tr");
export const th = normalTag("th");
export const td = normalTag("td");
export const header = normalTag("header");
export const nav = normalTag("nav");
export const main = normalTag("main");
export const div = normalTag("div");
export const h1 = normalTag("h1");
export const h2 = normalTag("h2");
export const h3 = normalTag("h3");
export const h4 = normalTag("h4");
export const h5 = normalTag("h5");
export const h6 = normalTag("h6");
export const form = normalTag("form");
export const label = normalTag("label");
export const button = normalTag("button");
export const output = normalTag("output");

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
 * https://github.com/zspecza/common-tags/blob/master/src/safeHtml/safeHtml.js
 * @param {string} unsafe
 */
function escapeHtml(unsafe) {
  if (unsafe.match(/^[A-Za-z0-9 _-]*$/g)) {
    return unsafe;
  }
  return unsafe.replaceAll(/[^A-Za-z0-9_-]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * @param {Record<string, string | boolean>} props
 */
function getStringProps(props) {
  return Object.entries(props)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${getPropKey(key)}="${escapeHtml(value)}"`;
      }
      if (typeof value === "boolean") {
        return value ? getPropKey(key) : undefined;
      }
      throw new Error("Invalid prop type");
    })
    .filter((prop) => typeof prop === "string")
    .join(" ");
}

/**
 * @param {Node} node
 * @returns {Promise<string>}
 */
export async function render(node) {
  if (node instanceof Promise) {
    return render(await node);
  }

  if (typeof node === "string") {
    return escapeHtml(node);
  }

  if (node instanceof SafeTextElement) {
    return node.text;
  }

  const attrs = getStringProps(node.attrs);

  if (node instanceof NormalElement) {
    const renderedChildren = await Promise.all(node.children.map(render));
    return `${node.tag === "html" ? "<!DOCTYPE html>" : ""}<${node.tag}${
      attrs ? ` ${attrs}` : ""
    }>${renderedChildren.join("")}</${node.tag}>`;
  }

  if (node instanceof SelfClosingElement) {
    return `<${node.tag}${attrs ? ` ${attrs}` : ""}>`;
  }

  throw new Error("Invalid node type");
}
