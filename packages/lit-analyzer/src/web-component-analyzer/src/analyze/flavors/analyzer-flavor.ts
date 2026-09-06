import * as tsModule from "typescript";
import { Node, Program, SourceFile, TypeChecker } from "typescript";
import {
  ComponentCssPart,
  ComponentCssProperty,
  ComponentDeclaration,
  ComponentEvent,
  ComponentMember,
  ComponentSlot
} from "../../../../lib/analyze/wca-types.js";
import { AnalyzerConfig } from "../types/analyzer-config.js";
import {
  ComponentDeclarationKind,
  ComponentHeritageClause
} from "../types/component-declaration.js";

import { ComponentMethod } from "../types/features/component-method.js";

export type PriorityKind = "low" | "medium" | "high";

export interface DefinitionNodeResult {
  tagName: string;

  tagNameNode?: Node; // Where to find the node that contains the name of the component
  identifierNode?: Node; // Where to find the node that refers to the declaration node
  declarationNode?: Node; // Where to find the node that contains the implementation of the component

  analyzerFlavor?: AnalyzerFlavor;
}

/**
 * This context is used in the entire analyzer.
 * A new instance of this is created whenever the analyzer runs.
 */
export interface AnalyzerVisitContext {
  checker: TypeChecker;
  program: Program;
  ts: typeof tsModule;
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

export interface ComponentFeatureCollection {
  members: ComponentMember[];
  methods: ComponentMethod[];
  events: ComponentEvent[];
  slots: ComponentSlot[];
  cssProperties: ComponentCssProperty[];
  cssParts: ComponentCssPart[];
}

type Optional<T> = T | undefined;

export type FeatureDiscoverVisitMap<Context extends AnalyzerVisitContext> = {
  member?: (node: Node, context: Context) => Optional<ComponentMember[]>;
  method?: (node: Node, context: Context) => Optional<ComponentMethod[]>;
  cssproperty?: (
    node: Node,
    context: Context
  ) => Optional<ComponentCssProperty[]>;
  csspart?: (node: Node, context: Context) => Optional<ComponentCssPart[]>;
  event?: (node: Node, context: Context) => Optional<ComponentEvent[]>;
  slot?: (node: Node, context: Context) => Optional<ComponentSlot[]>;
};

type OptionalOrArray<T> = T | T[] | undefined;

type FeatureRefineVisitMap = {
  member?: (
    feature: ComponentMember,
    context: AnalyzerVisitContext
  ) => OptionalOrArray<ComponentMember>;
  method?: (
    feature: ComponentMethod,
    context: AnalyzerVisitContext
  ) => OptionalOrArray<ComponentMethod>;
  cssproperty?: (
    feature: ComponentCssProperty,
    context: AnalyzerVisitContext
  ) => OptionalOrArray<ComponentCssProperty>;
  csspart?: (
    feature: ComponentCssPart,
    context: AnalyzerVisitContext
  ) => OptionalOrArray<ComponentCssPart>;
  event?: (
    feature: ComponentEvent,
    context: AnalyzerVisitContext
  ) => OptionalOrArray<ComponentEvent>;
  slot?: (
    feature: ComponentSlot,
    context: AnalyzerVisitContext
  ) => OptionalOrArray<ComponentSlot>;
};

export interface InheritanceResult {
  heritageClauses?: ComponentHeritageClause[];
  declarationNodes?: Node[];
  declarationKind?: ComponentDeclarationKind;
}

export interface AnalyzerDeclarationVisitContext extends AnalyzerVisitContext {
  getDeclaration: () => ComponentDeclaration;
  declarationNode: Node;
  sourceFile: SourceFile;
}

export interface AnalyzerFlavor {
  excludeNode?(node: Node, context: AnalyzerVisitContext): boolean | undefined;

  discoverDefinitions?(
    node: Node,
    context: AnalyzerVisitContext
  ): DefinitionNodeResult[] | undefined;

  discoverInheritance?(
    node: Node,
    context: AnalyzerVisitContext
  ): InheritanceResult | undefined;

  discoverFeatures?: FeatureDiscoverVisitMap<AnalyzerDeclarationVisitContext>;

  discoverGlobalFeatures?: FeatureDiscoverVisitMap<AnalyzerVisitContext>;

  refineFeature?: FeatureRefineVisitMap;

  refineDeclaration?(
    declaration: ComponentDeclaration,
    context: AnalyzerDeclarationVisitContext
  ): ComponentDeclaration | undefined;
}
