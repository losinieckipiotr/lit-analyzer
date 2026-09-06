import { SourceFile } from "typescript";
import { ComponentDeclaration } from "../../../../lib/analyze/wca-types.js";
import { AnalyzerVisitContext } from "../flavors/analyzer-flavor.js";
import { resolveSymbolDeclarations } from "../util/ast-util.js";
import { analyzeComponentDeclaration } from "./analyze-declaration.js";

/**
 * Visits the source file and finds all component definitions using flavors
 * @param sourceFile
 * @param context
 */
export function discoverDeclarations(
  sourceFile: SourceFile,
  context: AnalyzerVisitContext
): ComponentDeclaration[] {
  const declarations: ComponentDeclaration[] = [];

  const symbol = context.checker.getSymbolAtLocation(sourceFile);
  if (symbol != null) {
    // Get all exports in the source file
    const exports = context.checker.getExportsOfModule(symbol);

    // Find all class declarations in the source file
    for (const symbol of exports) {
      const node = symbol.valueDeclaration;

      if (node != null) {
        if (
          context.ts.isClassDeclaration(
            node
          ) /* || context.ts.isInterfaceDeclaration(node)*/
        ) {
          const nodes = resolveSymbolDeclarations(symbol);
          const decl = analyzeComponentDeclaration(nodes, context);
          if (decl != null) {
            declarations.push(decl);
          }
        }
      }
    }
  }

  return declarations;
}
