import { JSDoc, JSDocTag } from "typescript";

export interface JsDocTagParsed {
  tag: string;
  name?: string;
  type?: string;
  optional?: boolean;
  default?: unknown;
  description?: string;
  className?: string;
  namespace?: string;
}

export interface JSDocTagInternal {
  node: JSDocTag;
  comment?: string;
  tag: string;
  parsed: () => JsDocTagParsed;
}

export interface JsDoc {
  node?: JSDoc;
  description?: string;
  tags?: JSDocTagInternal[];
}

export type ModifierKind = "readonly" | "static";

export type VisibilityKind = "public" | "protected" | "private";
