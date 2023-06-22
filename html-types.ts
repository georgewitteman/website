// https://developer.mozilla.org/en-US/docs/Web/API/Element
export type HTMLElement = {
  type: "html";
  tagName: string;
  attributes: Record<string, string | boolean>;
  children: Node[];
};

export type SafeText = { type: "safe-text"; value: string };

// https://developer.mozilla.org/en-US/docs/Web/API/Text
export type Text = string;

export type Node = HTMLElement | SafeText | Text;

// https://developer.mozilla.org/en-US/docs/Glossary/Void_element
export type VoidTagName =
  | "area"
  | "base"
  | "br"
  | "col"
  | "embed"
  | "hr"
  | "img"
  | "input"
  | "link"
  | "meta"
  | "param"
  | "source"
  | "track"
  | "wbr";
