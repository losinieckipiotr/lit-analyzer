import { Node, Type } from "typescript";
import { SimpleType } from "../../../simple-type.js";
import { VisibilityKind } from "../visibility-kind.js";
import { ComponentFeatureBase } from "./component-feature.js";

export interface ComponentEvent extends ComponentFeatureBase {
  name: string;
  node: Node;
  type?: () => SimpleType | Type;
  typeHint?: string;
  visibility?: VisibilityKind;
  deprecated?: boolean | string;
}
