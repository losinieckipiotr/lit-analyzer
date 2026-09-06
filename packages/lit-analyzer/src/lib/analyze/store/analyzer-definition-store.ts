import { SourceFile } from "typescript";
import {
  AnalyzerResult,
  ComponentDeclaration,
  ComponentDefinition,
} from "../wca-types.js";

export interface AnalyzerDefinitionStore {
  getAnalysisResultForFile(sourceFile: SourceFile): AnalyzerResult | undefined;
  getDefinitionsWithDeclarationInFile(
    sourceFile: SourceFile,
  ): ComponentDefinition[];
  getComponentDeclarationsInFile(
    sourceFile: SourceFile,
  ): ComponentDeclaration[];
  getDefinitionForTagName(tagName: string): ComponentDefinition | undefined;
  getDefinitionsInFile(sourceFile: SourceFile): ComponentDefinition[];
}
