import { Node } from "typescript";
import {
  AnalyzerFlavor,
  ComponentFeatureCollection
} from "./flavors/analyzer-flavor.js";
import { CustomElementFlavor } from "./flavors/custom-element/custom-element-flavor.js";
import { JsDocFlavor } from "./flavors/js-doc/js-doc-flavor.js";
import { LitElementFlavor } from "./flavors/lit-element/lit-element-flavor.js";
import { ComponentDeclaration } from "./types/component-declaration.js";

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
