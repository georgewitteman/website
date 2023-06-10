class NormalElement {
  /**
   * @param {string} tag
   * @param {Record<string, string>} attrs
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
   * @param {Record<string, string>} attrs
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

/** @typedef {string | NormalElement | SelfClosingElement | SafeTextElement} Node */

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
 * @typedef {{ href: string }} A
 * @typedef {Record<string, never>} LI
 * @typedef {Record<string, never>} UL
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
 * @typedef {{ a: A; li: LI, ul: UL, p: P, table: Table, thead: THead, tbody: TBody, tr: TR, th: TH, td: TD, header: Header, nav: Nav, main: Main }} TagMap
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
 * @param {Record<string, string>} props
 */
function getStringProps(props) {
  return Object.entries(props)
    .map(([key, value]) => `${getPropKey(key)}="${escapeHtml(value)}"`)
    .join(" ");
}

/**
 * @param {Node} node
 * @returns {string}
 */
export function render(node) {
  if (typeof node === "string") {
    return escapeHtml(node);
  }

  if (node instanceof SafeTextElement) {
    return node.text;
  }

  const attrs = getStringProps(node.attrs);

  if (node instanceof NormalElement) {
    return `${node.tag === "html" ? "<!DOCTYPE html>" : ""}<${node.tag}${
      attrs ? ` ${attrs}` : ""
    }>${node.children.map(render).join("")}</${node.tag}>`;
  }

  if (node instanceof SelfClosingElement) {
    return `<${node.tag}${attrs ? ` ${attrs}` : ""}>`;
  }

  throw new Error("Invalid node type");
}
