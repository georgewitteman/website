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
 * @param {ChildNode[]} children
 * @returns {VNode}
 */
export function h(tag, props, ...children) {
  if (typeof tag === "function") {
    return tag({ ...props, children });
  }
  return new VNode(tag, props ?? {}, cleanChildren(children));
}
