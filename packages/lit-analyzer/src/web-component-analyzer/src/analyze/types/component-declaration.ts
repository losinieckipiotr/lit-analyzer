import { Node, SourceFile, Symbol } from "typescript";
import {
  ComponentCssPart,
  ComponentCssProperty,
  ComponentEvent,
  ComponentMember,
  ComponentSlot
} from "../../../../lib/analyze/wca-types.js";
import { ComponentMethod } from "./features/component-method.js";
import { JsDoc } from "./js-doc.js";

interface ComponentFeatures {
  members: ComponentMember[];
  methods: ComponentMethod[];
  events: ComponentEvent[];
  slots: ComponentSlot[];
  cssProperties: ComponentCssProperty[];
  cssParts: ComponentCssPart[];
}

export type ComponentHeritageClauseKind = "implements" | "extends" | "mixin";

export interface ComponentHeritageClause {
  kind: ComponentHeritageClauseKind;
  identifier: Node;
  declaration: ComponentDeclaration | undefined;
}

export type ComponentDeclarationKind = "mixin" | "interface" | "class";

interface ComponentDeclaration extends ComponentFeatures {
  sourceFile: SourceFile;
  node: Node;
  declarationNodes: Set<Node>;

  kind: ComponentDeclarationKind;
  jsDoc?: JsDoc;
  symbol?: Symbol;
  deprecated?: boolean | string;
  heritageClauses: ComponentHeritageClause[];
}
