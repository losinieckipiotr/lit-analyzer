import * as tsMod from "typescript";
import { Node, Program, SourceFile } from "typescript";
import { LitAnalyzerLogger } from "../lit-analyzer-logger.js";
import { CustomElementFlavor } from "./custom-element-flavor.js";
import { JsDocFlavor } from "./js-doc-flavor.js";
import { LitElementFlavor } from "./lit-element-flavor.js";
import {
  analyzeComponentDeclaration,
  discoverDeclarations,
  discoverDefinitions,
  discoverGlobalFeatures,
} from "./wca-discover.js";
import {
  AnalyzerFlavor,
  AnalyzerOptions,
  AnalyzerResult,
  AnalyzerVisitContext,
  ComponentDeclaration,
  ComponentFeature,
  ComponentFeatureCollection,
  ComponentFeatures,
  ComponentHeritageClause,
} from "./wca-types.js";

const ALL_COMPONENT_FEATURES: ComponentFeature[] = [
  "member",
  "method",
  "cssproperty",
  "csspart",
  "event",
  "slot",
];

//#region analyzeHTMLElement

export const VERSION = "<@VERSION@>";

export const DEFAULT_FLAVORS: AnalyzerFlavor[] = [
  new LitElementFlavor(),
  new CustomElementFlavor(),
  new JsDocFlavor(),
];

export const DEFAULT_FEATURE_COLLECTION_CACHE = new WeakMap<
  Node,
  ComponentFeatureCollection
>();

export const DEFAULT_COMPONENT_DECLARATION_CACHE = new WeakMap<
  Node,
  ComponentDeclaration
>();

/**
 * This function only analyzes the HTMLElement declaration found in
 * "lib.dom.d.ts" source file provided by Typescript.
 */
export function analyzeHTMLElement(
  program: Program,
  ts: typeof tsMod = tsMod,
  logger: LitAnalyzerLogger,
): ComponentDeclaration | undefined {
  const endsWithLibDom = "lib.dom.d.ts";

  const domLibSourceFile = program
    .getSourceFiles()
    .find((sf) => sf.fileName.endsWith(endsWithLibDom));
  if (domLibSourceFile == null) {
    return undefined;
  }

  return visit(domLibSourceFile, {
    ...makeContextFromConfig({
      program,
      ts,
      logger,
      flavors: [new CustomElementFlavor()],
      config: {
        analyzeDefaultLib: true,
        features: ALL_COMPONENT_FEATURES,
      },
    }),
    cache: {
      featureCollection: DEFAULT_FEATURE_COLLECTION_CACHE,
      componentDeclarationCache: DEFAULT_COMPONENT_DECLARATION_CACHE,
      general: new Map(),
    },
  });
}

function visit(
  node: Node,
  context: AnalyzerVisitContext,
): ComponentDeclaration | undefined {
  if (
    context.ts.isInterfaceDeclaration(node) &&
    node.name != null &&
    node.name.text === "HTMLElement"
  ) {
    return analyzeComponentDeclaration([node], context);
  }

  return node.forEachChild((child) => {
    return visit(child, context);
  });
}

//#endregion

//#region analyzeSourceFile

/**
 * Analyzes all components in a source file.
 */
export function analyzeSourceFile(
  sourceFile: SourceFile,
  options: AnalyzerOptions,
): AnalyzerResult {
  // Create a new context
  const context = makeContextFromConfig(options);

  // Analyze all components
  const componentDefinitions = discoverDefinitions(
    sourceFile,
    context,
    (definition, declarationNodes) =>
      // The component declaration is analyzed lazily
      analyzeComponentDeclaration(declarationNodes, context),
  );

  // Analyze global features
  let globalFeatures: ComponentFeatures | undefined = undefined;
  if (context.config.analyzeGlobalFeatures) {
    globalFeatures = discoverGlobalFeatures(sourceFile, context);
  }

  // Analyze exported declarations
  let declarations: ComponentDeclaration[] | undefined = undefined;
  if (context.config.analyzeAllDeclarations) {
    declarations = discoverDeclarations(sourceFile, context);
  }

  return {
    sourceFile,
    componentDefinitions,
    globalFeatures,
    declarations,
  };
}

//#endregion

//#region visitAllHeritageClauses

/**
 * A helper function that makes it possible to visit all heritage clauses in the
 * inheritance chain.
 */
export function visitAllHeritageClauses(
  declaration: ComponentDeclaration,
  emit: (clause: ComponentHeritageClause) => void,
): void {
  for (const clause of declaration.heritageClauses) {
    emit(clause);
    if (clause.declaration != null) {
      visitAllHeritageClauses(clause.declaration, emit);
    }
  }
}

//#endregion

/**
 * Creates an "analyzer visit context" based on some options.
 */
export function makeContextFromConfig(
  options: AnalyzerOptions,
): AnalyzerVisitContext {
  const {
    ts = tsMod,
    flavors = DEFAULT_FLAVORS,
    program,
    config,
    logger,
  } = options;

  const checker = program.getTypeChecker();

  // Create context
  return {
    checker,
    program,
    ts,
    logger,
    flavors,
    cache: {
      featureCollection: DEFAULT_FEATURE_COLLECTION_CACHE,
      componentDeclarationCache: DEFAULT_COMPONENT_DECLARATION_CACHE,
      general: new Map(),
    },
    config: {
      ...config,
      analyzeDefaultLib: config?.analyzeDefaultLib ?? false,
      analyzeDependencies: config?.analyzeDependencies ?? false,
      excludedDeclarationNames: config?.excludedDeclarationNames ?? [],
      features: config?.features ?? ALL_COMPONENT_FEATURES,
    },
  };
}
