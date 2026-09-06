import * as tsModule from "typescript";
import { ComponentFeature } from "../../../lib/analyze/wca-types.js";
import { VisibilityKind } from "../analyze/types.js";
import { TransformerKind } from "../transformers/transformer-kind.js";

export interface AnalyzerCliConfig {
  glob?: string[];

  dry?: boolean;
  verbose?: boolean;
  silent?: boolean;
  outFile?: string;
  outFiles?: string;
  outDir?: string;

  format?: TransformerKind;
  visibility?: VisibilityKind;

  features?: ComponentFeature[];
  analyzeGlobalFeatures?: boolean;
  analyzeDependencies?: boolean;
  analyzeDefaultLibrary?: boolean;
  discoverNodeModules?: boolean;

  markdown?: {
    headerLevel?: number;
  };

  inlineTypes?: boolean;

  ts?: typeof tsModule;
  cwd?: string;
}
