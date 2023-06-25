// https://developer.mozilla.org/en-US/docs/Web/API/Element
export type HTMLElement = {
  readonly type: "html";
  readonly tagName: string;
  readonly attributes: Record<string, string | boolean>;
  readonly children: Node[];
};

export type SafeText = { readonly type: "safe-text"; readonly value: string };

// https://developer.mozilla.org/en-US/docs/Web/API/Text
export type Text = string;

export type Component = {
  readonly type: "component";
  readonly component: (props: unknown, children: Node[]) => Node;
  readonly props: unknown;
  readonly children: Node[];
};

export type Node = HTMLElement | SafeText | Text | Component;

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
