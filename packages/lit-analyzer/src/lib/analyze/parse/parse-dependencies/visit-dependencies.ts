import * as tsModule from "typescript";
import { Node, Program, SourceFile } from "typescript";
import tsServerModule from "typescript/lib/tsserverlibrary.js";

interface IVisitDependenciesContext {
  program: Program;
  ts: typeof tsModule;
  project: tsServerModule.server.Project | undefined;
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

  // Check if we have traversed too deep
  if (inExternal && currentDepth >= (context.maxExternalDepth ?? Infinity)) {
    return;
  }

  if (!inExternal && currentDepth >= (context.maxInternalDepth ?? Infinity)) {
    return;
  }

  // Get all direct imports from the cache
  let directImports = context.directImportCache.get(sourceFile);

  // TODO: very unsafe condition
  if (directImports == null) {
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
      if (updatedSf != null) {
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
  // TODO: again unsafe condition
  if (node == null) {
    return;
  }

  // Handle top level imports/exports: (import "..."), (import { ... } from "..."), (export * from "...")

  // TODO: change isTypeOnly to phaseModifier
  if (
    (context.ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) ||
    (context.ts.isExportDeclaration(node) && !node.isTypeOnly)
  ) {
    // TOOO: unsafe condition with null
    if (
      node.moduleSpecifier != null &&
      context.ts.isStringLiteral(node.moduleSpecifier) &&
      context.ts.isSourceFile(node.parent)
    ) {
      // Potentially ignore all imports/exports with named imports/exports because importing an interface would not
      //    necessarily result in the custom element being defined. An even better solution would be to ignore all
      //    import declarations with only interface-like/type-alias imports.
      /*if (("importClause" in node && node.importClause != null) || ("exportClause" in node && node.exportClause != null)) {
			 return;
			 }*/

      emitDirectModuleImportWithName(node.moduleSpecifier.text, node, context);
    }
  }

  // Handle async imports (await import(...))
  else if (
    context.ts.isCallExpression(node) &&
    node.expression.kind === context.ts.SyntaxKind.ImportKeyword
  ) {
    const moduleSpecifier = node.arguments[0];

    if (
      moduleSpecifier != null &&
      context.ts.isStringLiteralLike(moduleSpecifier)
    ) {
      emitDirectModuleImportWithName(moduleSpecifier.text, node, context);
    }
  }

  node.forEachChild((child) => visitDirectImports(child, context));
}

interface MaybeModernProgram extends tsModule.Program {
  // TODO: this is internal and probably should not be used
  getModuleResolutionCache?(): tsModule.ModuleResolutionCache | undefined;
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
  const fromSourceFile = node.getSourceFile();

  // Resolve the imported string
  let result: tsModule.ResolvedModuleWithFailedLookupLocations | undefined;

  if (
    context.project &&
    "getResolvedModuleWithFailedLookupLocationsFromCache" in context.project
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { project } = context as { project: any };
    result = project.getResolvedModuleWithFailedLookupLocationsFromCache(
      moduleSpecifier,
      fromSourceFile.fileName,
    );
  } else if (
    "getResolvedModuleWithFailedLookupLocationsFromCache" in context.program
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { program } = context as { program: any };
    result = program["getResolvedModuleWithFailedLookupLocationsFromCache"](
      moduleSpecifier,
      fromSourceFile.fileName,
    );
  } else {
    const cache = (
      context.program as MaybeModernProgram
    ).getModuleResolutionCache?.();

    let mode: tsModule.ResolutionMode | undefined = undefined;

    // TODO: probably was checked before maybe throw?
    if (
      context.ts.isImportDeclaration(node) ||
      context.ts.isExportDeclaration(node)
    ) {
      // TODO: another null, same condition was checked in visitDirectImports, maybe throw here?
      if (
        node.moduleSpecifier != null &&
        context.ts.isStringLiteral(node.moduleSpecifier) &&
        context.ts.isSourceFile(node.parent)
      ) {
        mode = tsModule.getModeForUsageLocation(
          fromSourceFile,
          node.moduleSpecifier,
          context.program.getCompilerOptions(),
        );
      }
    }

    const fileName = fromSourceFile.fileName;

    if (cache != null) {
      result = context.ts.resolveModuleNameFromCache(
        moduleSpecifier,
        fromSourceFile.fileName,
        cache,
        mode,
      );
    }

    // TODO: unsafe condition
    if (result == null) {
      // Result could not be found from the cache, try and resolve module without using the
      // cache.
      result = context.ts.resolveModuleName(
        moduleSpecifier,
        fileName,
        context.program.getCompilerOptions(),
        context.ts.createCompilerHost(context.program.getCompilerOptions()),
      );
    }
  }

  if (result?.resolvedModule?.resolvedFileName != null) {
    const resolvedModule = result.resolvedModule;
    const sourceFile = context.program.getSourceFile(
      resolvedModule.resolvedFileName,
    );
    if (sourceFile != null) {
      context.emitDirectImport?.(sourceFile);
    }
  }
}

/**
 * Returns whether a SourceFile is a Facade Module.
 * A Facade Module only consists of import and export declarations.
 * @param sourceFile
 * @param ts
 */
export function isFacadeModule(
  sourceFile: SourceFile,
  ts: typeof tsModule,
): boolean {
  const statements = sourceFile.statements;
  const isFacade = statements.every((statement) => {
    return (
      ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)
    );
  });
  return isFacade;
}
