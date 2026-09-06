import { VisibilityKind } from "../analyze/types.js";

export interface TransformerConfig {
  cwd?: string;
  visibility?: VisibilityKind;
  markdown?: {
    titleLevel?: number; // deprecated
    headerLevel?: number;
  };
  inlineTypes?: boolean;
}
