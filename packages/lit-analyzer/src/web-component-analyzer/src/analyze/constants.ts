import { Node } from "typescript";
import {
  AnalyzerFlavor,
  ComponentDeclaration,
  ComponentFeatureCollection
} from "../../../lib/analyze/wca-types.js";
import { CustomElementFlavor } from "./flavors/custom-element/custom-element-flavor.js";
import { JsDocFlavor } from "./flavors/js-doc/js-doc-flavor.js";
import { LitElementFlavor } from "./flavors/lit-element/lit-element-flavor.js";

export const VERSION = "<@VERSION@>";

export const DEFAULT_FLAVORS: AnalyzerFlavor[] = [
  new LitElementFlavor(),
  new CustomElementFlavor(),
  new JsDocFlavor()
];

export const DEFAULT_FEATURE_COLLECTION_CACHE = new WeakMap<
  Node,
  ComponentFeatureCollection
>();

export const DEFAULT_COMPONENT_DECLARATION_CACHE = new WeakMap<
  Node,
  ComponentDeclaration
>();
