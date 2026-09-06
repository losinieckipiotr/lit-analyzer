import * as tsModule from "typescript";
import { Node, Program, SourceFile } from "typescript";
import {
  DEFAULT_COMPONENT_DECLARATION_CACHE,
  DEFAULT_FEATURE_COLLECTION_CACHE,
} from "../../web-component-analyzer/src/analyze/constants.js";
import { CustomElementFlavor } from "../../web-component-analyzer/src/analyze/flavors/custom-element/custom-element-flavor.js";
import { makeContextFromConfig } from "../../web-component-analyzer/src/analyze/make-context-from-config.js";
import { analyzeComponentDeclaration } from "../../web-component-analyzer/src/analyze/stages/analyze-declaration.js";
import { discoverDeclarations } from "../../web-component-analyzer/src/analyze/stages/discover-declarations.js";
import { discoverDefinitions } from "../../web-component-analyzer/src/analyze/stages/discover-definitions.js";
import { discoverGlobalFeatures } from "../../web-component-analyzer/src/analyze/stages/discover-global-features.js";
import { ALL_COMPONENT_FEATURES } from "../../web-component-analyzer/src/analyze/types/features/component-feature.js";
import {
  AnalyzerOptions,
  AnalyzerResult,
  AnalyzerVisitContext,
  ComponentDeclaration,
  ComponentFeatures,
  ComponentHeritageClause,
} from "./wca-types.js";

//#region analyzeHTMLElement

/**
 * This function only analyzes the HTMLElement declaration found in "lib.dom.d.ts" source file provided by Typescript.
 * @param program
 * @param ts
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
 * @param sourceFile
 * @param options
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
 * A helper function that makes it possible to visit all heritage clauses in the inheritance chain.
 * @param declaration
 * @param emit
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
