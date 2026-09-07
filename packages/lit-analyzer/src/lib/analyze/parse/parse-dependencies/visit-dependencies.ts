import * as tsMod from "typescript";
import { Node, Program, SourceFile } from "typescript";

interface IVisitDependenciesContext {
  program: Program;
  host: tsMod.CompilerHost | undefined;
  ts: typeof tsMod;
  project: tsMod.LanguageServiceHost | undefined;
  directImportCache: WeakMap<SourceFile, Set<SourceFile>>;
  emitIndirectImport(file: SourceFile, importedFrom?: SourceFile): boolean;
  emitDirectImport?(file: SourceFile): void;
  depth?: number;
  maxExternalDepth?: number;
  maxInternalDepth?: number;
}

/**
 * Visits all indirect imports from a source file
 * Emits them using "emitIndirectImport" callback
 * @param sourceFile
 * @param context
 */
export function visitIndirectImportsFromSourceFile(
  sourceFile: SourceFile,
  context: IVisitDependenciesContext,
): void {
  const currentDepth = context.depth ?? 0;

  // Emit a visit. If this file has been seen already, the function will return false, and traversal will stop
  if (!context.emitIndirectImport(sourceFile)) {
    return;
  }

  const inExternal =
    context.program.isSourceFileFromExternalLibrary(sourceFile);

  const { maxExternalDepth = Infinity, maxInternalDepth = Infinity } = context;

  // Check if we have traversed too deep
  if (
    (inExternal && currentDepth >= maxExternalDepth) ||
    (!inExternal && currentDepth >= maxInternalDepth)
  ) {
    return;
  }

  // Get all direct imports from the cache
  let directImports = context.directImportCache.get(sourceFile);

  if (!directImports) {
    // If the cache didn't have all direct imports, build up using the visitor function
    directImports = new Set<SourceFile>();

    const newContext = {
      ...context,
      emitDirectImport(file: SourceFile) {
        directImports!.add(file);
      },
    };

    // Emit all direct imports
    visitDirectImports(sourceFile, newContext);

    // Cache the result
    context.directImportCache.set(sourceFile, directImports);
  } else {
    // Updated references to newest source files
    const updatedImports = new Set<SourceFile>();

    for (const sf of directImports) {
      const updatedSf = context.program.getSourceFile(sf.fileName);

      if (updatedSf) {
        updatedImports.add(updatedSf);
      }
    }
    directImports = updatedImports;
  }

  // Call this function recursively on all direct imports from this source file
  for (const file of directImports) {
    const toExternal = context.program.isSourceFileFromExternalLibrary(file);
    const fromProjectToExternal = !inExternal && toExternal;

    // It's possible to only follow external dependencies from the source file of interest (depth 0)
    /*if (fromProjectToExternal && currentDepth !== 0) {
		 continue;
		 }*/

    // Calculate new depth. Reset depth to 1 if we go from a project module to an external module.
    // This will make sure that we always go X modules deep into external modules
    let newDepth;
    if (fromProjectToExternal) {
      newDepth = 1;
    } else {
      newDepth = currentDepth + 1;
    }

    if (isFacadeModule(file, context.ts)) {
      // Facade modules are ignored when calculating depth
      newDepth--;
    }

    // Visit direct imported source files recursively
    visitIndirectImportsFromSourceFile(file, {
      ...context,
      depth: newDepth,
    });
  }
}

/**
 * Visits all direct imports in an AST.
 * Emits them using "emitDirectImport"
 * @param node
 * @param context
 */
function visitDirectImports(
  node: Node,
  context: IVisitDependenciesContext,
): void {
  if (!node) {
    return;
  }

  // Handle top level imports/exports: (import "..."), (import { ... } from "..."), (export * from "...")

  const { ts } = context;

  const isImportDeclaration = ts.isImportDeclaration(node);
  const isExportDeclaration = ts.isExportDeclaration(node);

  if (
    // skip type-only imports
    (isImportDeclaration &&
      !(node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword)) ||
    // skip type-only exports
    (isExportDeclaration && !node.isTypeOnly)
  ) {
    const { moduleSpecifier } = node;

    if (!moduleSpecifier) {
      return;
    }

    const isStringLiteral = ts.isStringLiteral(moduleSpecifier);

    if (!isStringLiteral) {
      return;
    }

    const isParentSourceFile = ts.isSourceFile(node.parent);

    if (!isParentSourceFile) {
      return;
    }

    // Potentially ignore all imports/exports with named imports/exports because importing an interface would not
    //    necessarily result in the custom element being defined. An even better solution would be to ignore all
    //    import declarations with only interface-like/type-alias imports.
    /*if (("importClause" in node && node.importClause != null) || ("exportClause" in node && node.exportClause != null)) {
			 return;
			 }*/

    emitDirectModuleImportWithName(moduleSpecifier.text, node, context);
  }

  // Handle async imports (await import(...))
  else if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword
  ) {
    const moduleSpecifier = node.arguments.at(0);

    if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
      emitDirectModuleImportWithName(moduleSpecifier.text, node, context);
    }
  }

  node.forEachChild((child) => visitDirectImports(child, context));
}

/**
 * Resolves and emits a direct imported module
 * @param moduleSpecifier
 * @param node
 * @param context
 */
function emitDirectModuleImportWithName(
  moduleSpecifier: string,
  node: Node,
  context: IVisitDependenciesContext,
) {
  // Resolve the imported string
  let result: tsMod.ResolvedModuleWithFailedLookupLocations | undefined;
  const { project, program } = context;

  if (project && project.getResolvedModuleWithFailedLookupLocationsFromCache) {
    // TODO: not tested in units
    result = project.getResolvedModuleWithFailedLookupLocationsFromCache(
      moduleSpecifier,
      node.getSourceFile().fileName,
    );
  } else {
    let host: tsMod.CompilerHost;

    if (context.host) {
      host = context.host;
    } else {
      host = context.ts.createCompilerHost(program.getCompilerOptions());
    }

    if (!result) {
      // Result could not be found from the cache, try and resolve module without using the
      // cache.
      result = context.ts.resolveModuleName(
        moduleSpecifier,
        node.getSourceFile().fileName,
        program.getCompilerOptions(),
        host,
      );
    }
  }

  if (result?.resolvedModule?.resolvedFileName) {
    const resolvedModule = result.resolvedModule;
    const sourceFile = program.getSourceFile(resolvedModule.resolvedFileName);

    if (sourceFile) {
      context.emitDirectImport?.(sourceFile);
    }
  }
}

/**
 * @returns whether a `sourceFile` is a Facade Module. A Facade Module only
 * consists of import and export declarations.
 */
export function isFacadeModule(
  sourceFile: SourceFile,
  ts: typeof tsMod,
): boolean {
  const statements = sourceFile.statements;
  const isFacade = statements.every((statement) => {
    return (
      ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
    );
  });

  return isFacade;
}
