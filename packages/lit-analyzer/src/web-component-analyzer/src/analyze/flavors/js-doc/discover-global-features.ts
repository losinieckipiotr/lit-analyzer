import { Node } from "typescript";
import { AnalyzerVisitContext } from "../../flavors/analyzer-flavor.js";
import { ComponentCssPart } from "../../types/features/component-css-part.js";
import { ComponentCssProperty } from "../../types/features/component-css-property.js";
import { ComponentEvent } from "../../types/features/component-event.js";
import { ComponentMember } from "../../types/features/component-member.js";
import { ComponentSlot } from "../../types/features/component-slot.js";
import { AnalyzerFlavor } from "../analyzer-flavor.js";
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
