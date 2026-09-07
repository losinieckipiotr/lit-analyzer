import * as tsModule from "typescript";
import { Node, Program, SourceFile } from "typescript";
import { CustomElementFlavor } from "./flavors/custom-element-flavor.js";
import { JsDocFlavor } from "./flavors/js-doc-flavor.js";
import { LitElementFlavor } from "./flavors/lit-element-flavor.js";
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
  ts: typeof tsModule = tsModule,
): ComponentDeclaration | undefined {
  const endsWithLibDom = "lib.dom.d.ts";

  const domLibSourceFile = program
    .getSourceFiles()
    .find((sf) => sf.fileName.endsWith(endsWithLibDom));
  if (domLibSourceFile == null) {
    return undefined;
    //throw new Error(`Couldn't find '${endsWith}'. Have you included the 'dom' lib in your tsconfig?`);
  }

  return visit(domLibSourceFile, {
    ...makeContextFromConfig({
      program,
      ts,
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
  if (options.program == null) {
    throw new Error("A program is required when running 'analyzeSourceFile'");
  }

  // Assign defaults
  const flavors = options.flavors || DEFAULT_FLAVORS;
  const ts = options.ts || tsModule;
  const checker = options.program.getTypeChecker();

  // Create context
  return {
    checker,
    program: options.program,
    ts,
    flavors,
    cache: {
      featureCollection: DEFAULT_FEATURE_COLLECTION_CACHE,
      componentDeclarationCache: DEFAULT_COMPONENT_DECLARATION_CACHE,
      general: new Map(),
    },
    config: {
      ...options.config,
      analyzeDefaultLib: options.config?.analyzeDefaultLib ?? false,
      analyzeDependencies: options.config?.analyzeDependencies ?? false,
      excludedDeclarationNames: options.config?.excludedDeclarationNames ?? [],
      features: options.config?.features ?? ALL_COMPONENT_FEATURES,
    },
  };
}
