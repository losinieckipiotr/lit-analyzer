import { Node } from "typescript";
import {
  AnalyzerFlavor,
  AnalyzerVisitContext,
  ComponentCssPart,
  ComponentCssProperty,
  ComponentEvent,
  ComponentMember,
  ComponentSlot
} from "../../../../../lib/analyze/wca-types.js";
import { discoverFeatures } from "./discover-features.js";

export const discoverGlobalFeatures: AnalyzerFlavor["discoverGlobalFeatures"] =
  {
    csspart: (
      node: Node,
      context: AnalyzerVisitContext
    ): ComponentCssPart[] | undefined => {
      if (
        context.ts.isInterfaceDeclaration(node) &&
        node.name.text === "HTMLElement"
      ) {
        return discoverFeatures.csspart?.(node, context);
      }

      return undefined;
    },
    cssproperty: (
      node: Node,
      context: AnalyzerVisitContext
    ): ComponentCssProperty[] | undefined => {
      if (
        context.ts.isInterfaceDeclaration(node) &&
        node.name.text === "HTMLElement"
      ) {
        return discoverFeatures.cssproperty?.(node, context);
      }

      return undefined;
    },
    event: (
      node: Node,
      context: AnalyzerVisitContext
    ): ComponentEvent[] | undefined => {
      if (
        context.ts.isInterfaceDeclaration(node) &&
        node.name.text === "HTMLElement"
      ) {
        return discoverFeatures.event?.(node, context);
      }

      return undefined;
    },
    slot: (
      node: Node,
      context: AnalyzerVisitContext
    ): ComponentSlot[] | undefined => {
      if (
        context.ts.isInterfaceDeclaration(node) &&
        node.name.text === "HTMLElement"
      ) {
        return discoverFeatures.slot?.(node, context);
      }

      return undefined;
    },
    member: (
      node: Node,
      context: AnalyzerVisitContext
    ): ComponentMember[] | undefined => {
      if (
        context.ts.isInterfaceDeclaration(node) &&
        node.name.text === "HTMLElement"
      ) {
        return discoverFeatures?.member?.(node, context);
      }

      return undefined;
    }
  };
