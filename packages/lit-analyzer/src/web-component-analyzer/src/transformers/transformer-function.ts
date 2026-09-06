import { Program } from "typescript";
import { AnalyzerResult } from "../../../lib/analyze/wca-types.js";
import { TransformerConfig } from "./transformer-config.js";

export type TransformerFunction = (
  results: AnalyzerResult[],
  program: Program,
  config: TransformerConfig
) => string;
