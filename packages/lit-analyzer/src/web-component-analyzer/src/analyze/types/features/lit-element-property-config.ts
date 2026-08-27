import { CallExpression, Node } from "typescript";
import { SimpleType } from "../../../simple-type.js";

export interface LitElementPropertyConfig {
  type?: SimpleType | string;
  attribute?: string | boolean;
  node?: {
    type?: Node;
    attribute?: Node;
    decorator?: CallExpression;
  };
  hasConverter?: boolean;
  default?: unknown;
  reflect?: boolean;
  state?: boolean;
}
