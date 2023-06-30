import { g } from "./lib/guard/index.js";

/**
 * @param {{ class?: string }} attributes
 * @param {(Node)[]} children
 */
function div(attributes, children) {
  const e = document.createElement("div");
  if (typeof attributes.class === "string") {
    e.className = attributes.class;
  }
  e.replaceChildren(...children);
  return e;
}

function br() {
  return document.createElement("br");
}

/**
 * @param {{ href: URL }} attributes
 * @param {Node[]} children
 */
function a(attributes, children) {
  const e = document.createElement("a");
  e.href = attributes.href.toString();
  e.replaceChildren(...children);
  return e;
}

/**
 * @param {Record<string, never>} attributes
 * @param {string} content
 */
function button(attributes, content) {
  const e = document.createElement("button");
  e.textContent = content;
  return e;
}

/**
 * @param {string} value
 */
function text(value) {
  return document.createTextNode(value);
}

/**
 * @param {Record<string, never>} attributes
 * @param {Node[]} children
 */
function strong(attributes, children) {
  const e = document.createElement("strong");
  e.replaceChildren(...children);
  return e;
}

/**
 * @template {ChildNode} T
 * @param {ChildNode} orig
 * @param {T} next
 * @returns {T}
 */
function replace(orig, next) {
  orig.replaceWith(next);
  return next;
}

class Button extends HTMLElement {
  /**
   * @param {{ onClick?: (e: Event) => void; content: string }} props
   */
  constructor(props) {
    super();
    this.btn = button({}, props.content);
    if (props.onClick) {
      this.btn.addEventListener("click", props.onClick);
    }
    this.replaceChildren(this.btn);
  }

  /**
   * @param {boolean} isDisabled
   */
  setDisabled(isDisabled) {
    this.btn.disabled = isDisabled;
  }
}
window.customElements.define("my-button", Button);

class FooBar {
  /**
   * @param {string} s
   */
  constructor(s) {
    this.el = document.createTextNode(s);
  }

  /**
   * @param {string} s
   */
  update(s) {
    this.el = replace(this.el, document.createTextNode(s));
  }

  render() {
    return this.el;
  }
}

const IPAddressSchema = g.object({ ip: g.string() });

async function getIpAddress() {
  const response = await fetch("https://get.geojs.io/v1/ip.json");
  /**
   * @type {unknown}
   */
  const address = await response.json();
  if (!IPAddressSchema.isSatisfiedBy(address)) {
    throw new Error("Invalid response from address");
  }
  return address;
}

class IPAddress {
  constructor() {
    this.el = div({}, [text("click the button...")]);
  }

  refreshPosts() {
    this.el.replaceChildren(text("Loading..."));
    getIpAddress().then(({ ip }) => {
      this.el.replaceChildren(strong({}, [text(ip)]));
    });
  }

  render() {
    return this.el;
  }
}

class App {
  constructor() {
    const datetime = new FooBar(new Date().toISOString());
    const fooBar = new FooBar(new Date().toISOString());
    const address = new IPAddress();

    const btn = new Button({
      content: "button",
      onClick: () => {
        fooBar.update(new Date().toISOString());
        btn.setDisabled(true);
        address.refreshPosts();
      },
    });

    btn.appendChild(text("foobar"));

    this.el = new DocumentFragment();
    this.el.appendChild(
      div({ class: "foo" }, [
        strong({}, [text("strong")]),
        text(" "),
        fooBar.render(),
        text(" "),
        btn,
        br(),
        a({ href: new URL("https://www.google.com") }, [text("Link")]),
        text(" "),
        datetime.render(),
        br(),
        address.render(),
      ]),
    );

    setInterval(() => {
      datetime.update(new Date().toISOString());
    }, 1000);
  }

  render() {
    return this.el;
  }
}
const app = new App();

setTimeout(() => {
  const root = document.getElementById("app");
  if (!root) {
    throw new Error("Missing root");
  }
  root.replaceChildren(app.render());
}, 500);
