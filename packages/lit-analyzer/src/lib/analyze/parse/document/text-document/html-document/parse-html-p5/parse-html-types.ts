import type { DefaultTreeAdapterTypes, Token } from "parse5";

export interface IP5BaseSourceCodeLocation {
  startTag?: Token.LocationWithAttributes;
  endTag?: Token.LocationWithAttributes;
  startLine: number;
  startCol: number;
  startOffset: number;
  endLine: number;
  endCol: number;
  endOffset: number;
  attrs?: Record<string, Token.Location>;
}

export type IP5NodeAttr = Token.Attribute;

export type IP5DocumentFragmentNode = DefaultTreeAdapterTypes.DocumentFragment;
export type IP5TextNode = DefaultTreeAdapterTypes.TextNode;
export type IP5CommentNode = DefaultTreeAdapterTypes.CommentNode;
export type IP5TagNode = DefaultTreeAdapterTypes.Element;
export type P5Node = DefaultTreeAdapterTypes.ChildNode;

export function getSourceLocation(
  node: P5Node
): IP5BaseSourceCodeLocation | null | undefined {
  return node.sourceCodeLocation;
}
