import type {
  CallExpression,
  JSDoc,
  JSDocTag,
  Node,
  Program,
  SourceFile,
  Symbol,
  Type,
  TypeChecker,
} from "typescript";
import * as tsMod from "typescript";
import { LitAnalyzerLogger } from "../lit-analyzer-logger.js";
import { MyUnionType } from "../my-union-type.js";

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

type ComponentMemberKind = "property" | "attribute";

export type PriorityKind = "low" | "medium" | "high";

export type VisibilityKind = "public" | "protected" | "private";

export type ComponentMemberReflectKind =
  "to-attribute" | "to-property" | "both";

export type ModifierKind = "readonly" | "static";

export interface ComponentFeatureBase {
  jsDoc?: JsDoc;
  declaration?: ComponentDeclaration;
}

interface ComponentMemberBase extends ComponentFeatureBase {
  kind: ComponentMemberKind;
  node: Node;
  priority?: PriorityKind;

  typeHint?: string;
  type: undefined | (() => Type | MyUnionType);

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

export interface ComponentMethod extends ComponentFeatureBase {
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
  type?: () => Type | MyUnionType;
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

export type ComponentDeclarationKind = "mixin" | "interface" | "class";

export type ComponentHeritageClauseKind = "implements" | "extends" | "mixin";

export interface ComponentHeritageClause {
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

export type ComponentFeature =
  "member" | "method" | "cssproperty" | "csspart" | "event" | "slot";

export interface AnalyzerConfig {
  analyzeDefaultLib?: boolean;
  analyzeDependencies?: boolean;
  analyzeGlobalFeatures?: boolean;
  analyzeAllDeclarations?: boolean;
  excludedDeclarationNames?: string[];
  features?: ComponentFeature[];
}

export interface DefinitionNodeResult {
  tagName: string;

  tagNameNode?: Node; // Where to find the node that contains the name of the component
  identifierNode?: Node; // Where to find the node that refers to the declaration node
  declarationNode?: Node; // Where to find the node that contains the implementation of the component

  analyzerFlavor?: AnalyzerFlavor;
}

export interface InheritanceResult {
  heritageClauses?: ComponentHeritageClause[];
  declarationNodes?: Node[];
  declarationKind?: ComponentDeclarationKind;
}

type Optional<T> = T | undefined;

export type FeatureDiscoverVisitMap<Context extends AnalyzerVisitContext> = {
  member?: (node: Node, context: Context) => Optional<ComponentMember[]>;
  method?: (node: Node, context: Context) => Optional<ComponentMethod[]>;
  cssproperty?: (
    node: Node,
    context: Context,
  ) => Optional<ComponentCssProperty[]>;
  csspart?: (node: Node, context: Context) => Optional<ComponentCssPart[]>;
  event?: (node: Node, context: Context) => Optional<ComponentEvent[]>;
  slot?: (node: Node, context: Context) => Optional<ComponentSlot[]>;
};

export interface AnalyzerDeclarationVisitContext extends AnalyzerVisitContext {
  getDeclaration: () => ComponentDeclaration;
  declarationNode: Node;
  sourceFile: SourceFile;
}

type OptionalOrArray<T> = T | T[] | undefined;

type FeatureRefineVisitMap = {
  member?: (
    feature: ComponentMember,
    context: AnalyzerVisitContext,
  ) => OptionalOrArray<ComponentMember>;
  method?: (
    feature: ComponentMethod,
    context: AnalyzerVisitContext,
  ) => OptionalOrArray<ComponentMethod>;
  cssproperty?: (
    feature: ComponentCssProperty,
    context: AnalyzerVisitContext,
  ) => OptionalOrArray<ComponentCssProperty>;
  csspart?: (
    feature: ComponentCssPart,
    context: AnalyzerVisitContext,
  ) => OptionalOrArray<ComponentCssPart>;
  event?: (
    feature: ComponentEvent,
    context: AnalyzerVisitContext,
  ) => OptionalOrArray<ComponentEvent>;
  slot?: (
    feature: ComponentSlot,
    context: AnalyzerVisitContext,
  ) => OptionalOrArray<ComponentSlot>;
};

export interface AnalyzerFlavor {
  excludeNode?(node: Node, context: AnalyzerVisitContext): boolean | undefined;

  discoverDefinitions?(
    node: Node,
    context: AnalyzerVisitContext,
  ): DefinitionNodeResult[] | undefined;

  discoverInheritance?(
    node: Node,
    context: AnalyzerVisitContext,
  ): InheritanceResult | undefined;

  discoverFeatures?: FeatureDiscoverVisitMap<AnalyzerDeclarationVisitContext>;

  discoverGlobalFeatures?: FeatureDiscoverVisitMap<AnalyzerVisitContext>;

  refineFeature?: FeatureRefineVisitMap;

  refineDeclaration?(
    declaration: ComponentDeclaration,
    context: AnalyzerDeclarationVisitContext,
  ): ComponentDeclaration | undefined;
}

export interface ComponentFeatureCollection {
  members: ComponentMember[];
  methods: ComponentMethod[];
  events: ComponentEvent[];
  slots: ComponentSlot[];
  cssProperties: ComponentCssProperty[];
  cssParts: ComponentCssPart[];
}

/**
 * This context is used in the entire analyzer.
 * A new instance of this is created whenever the analyzer runs.
 */
export interface AnalyzerVisitContext {
  checker: TypeChecker;
  program: Program;
  ts: typeof tsMod;
  logger: LitAnalyzerLogger;
  config: AnalyzerConfig;
  flavors: AnalyzerFlavor[];
  emitContinue?(): void;
  cache: {
    featureCollection: WeakMap<Node, ComponentFeatureCollection>;
    componentDeclarationCache: WeakMap<Node, ComponentDeclaration>;
    general: Map<unknown, unknown>;
  };
}

export interface FeatureVisitReturnTypeMap {
  member: ComponentMember;
  method: ComponentMethod;
  cssproperty: ComponentCssProperty;
  csspart: ComponentCssPart;
  event: ComponentEvent;
  slot: ComponentSlot;
}

export type RefineFeatureEmitMap = {
  [K in ComponentFeature]: (result: FeatureVisitReturnTypeMap[K]) => void;
};

export type VisitFeatureEmitMap = {
  [K in ComponentFeature]: (result: FeatureVisitReturnTypeMap[K][]) => void;
};

/**
 * Options to give when analyzing components
 */
export interface AnalyzerOptions {
  program: Program;
  logger: LitAnalyzerLogger;
  ts?: typeof tsMod;
  flavors?: AnalyzerFlavor[];
  config?: AnalyzerConfig;
  verbose?: boolean;
}
