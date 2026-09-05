import { CallExpression, Node, Type } from "typescript";

export interface LitElementPropertyConfig {
  type?: Type;
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
