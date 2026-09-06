import type {
  CallExpression,
  JSDoc,
  JSDocTag,
  Node,
  SourceFile,
  Symbol,
  Type,
} from "typescript";

export interface LitElementPropertyConfig {
  type?: Type;
  attribute?: string | boolean;
  node?: {
    type?: Node;
    attribute?: Node;
    decorator?: CallExpression;
  };
  hasConverter?: boolean;
  default?: unknown;
  reflect?: boolean;
  state?: boolean;
}

interface JsDocTagParsed {
  tag: string;
  name?: string;
  type?: string;
  optional?: boolean;
  default?: unknown;
  description?: string;
  className?: string;
  namespace?: string;
}

interface JSDocTagInternal {
  node: JSDocTag;
  comment?: string;
  tag: string;
  parsed: () => JsDocTagParsed;
}

interface JsDoc {
  node?: JSDoc;
  description?: string;
  tags?: JSDocTagInternal[];
}

type ComponentMemberKind = "property" | "attribute";

type PriorityKind = "low" | "medium" | "high";

type VisibilityKind = "public" | "protected" | "private";

export type ComponentMemberReflectKind =
  "to-attribute" | "to-property" | "both";

type ModifierKind = "readonly" | "static";

interface ComponentFeatureBase {
  jsDoc?: JsDoc;
  declaration?: ComponentDeclaration;
}

interface ComponentMemberBase extends ComponentFeatureBase {
  kind: ComponentMemberKind;
  node: Node;
  priority?: PriorityKind;

  typeHint?: string;
  type: undefined | (() => Type);

  meta?: LitElementPropertyConfig;

  visibility?: VisibilityKind;
  reflect?: ComponentMemberReflectKind;
  required?: boolean;
  deprecated?: boolean | string;
  default?: unknown;
  modifiers?: Set<ModifierKind>;
}

export interface ComponentSlot extends ComponentFeatureBase {
  name?: string;
  permittedTagNames?: string[];
}

export interface ComponentMemberProperty extends ComponentMemberBase {
  kind: "property";
  propName: string;
  attrName?: string;
}

export interface ComponentMemberAttribute extends ComponentMemberBase {
  kind: "attribute";
  attrName: string;
  propName?: undefined;
  modifiers?: undefined;
}

export type ComponentMember =
  ComponentMemberProperty | ComponentMemberAttribute;

interface ComponentMethod extends ComponentFeatureBase {
  name: string;
  node?: Node;
  type?: () => Type;

  visibility?: VisibilityKind;
  //// TODO: remove?
  //modifiers?: Set<ModifierKind>;
}

export interface ComponentEvent extends ComponentFeatureBase {
  name: string;
  node: Node;
  type?: () => Type;
  typeHint?: string;
  visibility?: VisibilityKind;
  deprecated?: boolean | string;
}

export interface ComponentCssProperty extends ComponentFeatureBase {
  name: string;
  typeHint?: string;
  default?: unknown;
}

export interface ComponentCssPart extends ComponentFeatureBase {
  name: string;
}

export interface ComponentFeatures {
  members: ComponentMember[];
  methods: ComponentMethod[];
  events: ComponentEvent[];
  slots: ComponentSlot[];
  cssProperties: ComponentCssProperty[];
  cssParts: ComponentCssPart[];
}

type ComponentDeclarationKind = "mixin" | "interface" | "class";

type ComponentHeritageClauseKind = "implements" | "extends" | "mixin";

interface ComponentHeritageClause {
  kind: ComponentHeritageClauseKind;
  identifier: Node;
  declaration: ComponentDeclaration | undefined;
}

export interface ComponentDeclaration extends ComponentFeatures {
  sourceFile: SourceFile;
  node: Node;
  declarationNodes: Set<Node>;

  kind: ComponentDeclarationKind;
  jsDoc?: JsDoc;
  symbol?: Symbol;
  deprecated?: boolean | string;
  heritageClauses: ComponentHeritageClause[];
}

export interface ComponentDefinition {
  sourceFile: SourceFile;

  identifierNodes: Set<Node>;
  tagNameNodes: Set<Node>;

  tagName: string;
  declaration?: ComponentDeclaration;
}

/**
 * The result returned after components have been analyzed.
 */
export interface AnalyzerResult {
  sourceFile: SourceFile;
  componentDefinitions: ComponentDefinition[];
  declarations?: ComponentDeclaration[];
  globalFeatures?: ComponentFeatures;
}
