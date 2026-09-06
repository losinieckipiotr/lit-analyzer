import { Node } from "typescript";
import {
  AnalyzerVisitContext,
  ComponentCssPart,
  ComponentCssProperty,
  ComponentEvent,
  ComponentMember,
  ComponentMemberAttribute,
  ComponentMemberProperty,
  ComponentSlot,
  FeatureDiscoverVisitMap
} from "../../../../../lib/analyze/wca-types.js";
import {
  isSimpleType,
  SimpleTypeKind,
  SimpleTypeStringLiteral
} from "../../../simple-type.js";
import { getNodeSourceFileLang } from "../../util/ast-util.js";
import { parseSimpleJsDocTypeExpression } from "../../util/js-doc-util.js";
import { lazy } from "../../util/lazy.js";
import { parseJsDocForNode } from "./parse-js-doc-for-node.js";

export const discoverFeatures: Partial<
  FeatureDiscoverVisitMap<AnalyzerVisitContext>
> = {
  csspart: (
    node: Node,
    context: AnalyzerVisitContext
  ): ComponentCssPart[] | undefined => {
    if (
      context.ts.isInterfaceDeclaration(node) ||
      context.ts.isClassDeclaration(node)
    ) {
      return parseJsDocForNode(
        node,
        ["csspart"],
        (_tagNode, { name, description }) => {
          if (name != null && name.length > 0) {
            return {
              name: name,
              jsDoc: description != null ? { description } : undefined
            };
          }

          return undefined;
        },
        context
      );
    }

    return undefined;
  },
  cssproperty: (
    node: Node,
    context: AnalyzerVisitContext
  ): ComponentCssProperty[] | undefined => {
    if (
      context.ts.isInterfaceDeclaration(node) ||
      context.ts.isClassDeclaration(node)
    ) {
      return parseJsDocForNode(
        node,
        ["cssprop", "cssproperty", "cssvar", "cssvariable"],
        (_tagNode, { name, description, type, default: def }) => {
          if (name != null && name.length > 0) {
            return {
              name: name,
              jsDoc: description != null ? { description } : undefined,
              typeHint: type || undefined,
              default: def
            };
          }

          return undefined;
        },
        context
      );
    }
    return undefined;
  },
  event: (
    node: Node,
    context: AnalyzerVisitContext
  ): ComponentEvent[] | undefined => {
    if (
      context.ts.isInterfaceDeclaration(node) ||
      context.ts.isClassDeclaration(node)
    ) {
      const { checker } = context;
      return parseJsDocForNode(
        node,
        ["event", "fires", "emits"],
        (tagNode, { name, description, type }) => {
          if (name != null && name.length > 0 && tagNode != null) {
            return {
              name: name,
              jsDoc: description != null ? { description } : undefined,
              type: type
                ? () =>
                    parseSimpleJsDocTypeExpression(tagNode, type, context) ||
                    checker.getAnyType()
                : undefined,
              typeHint: type,
              node: tagNode
            };
          }

          return undefined;
        },
        context
      );
    }

    return undefined;
  },
  slot: (
    node: Node,
    context: AnalyzerVisitContext
  ): ComponentSlot[] | undefined => {
    if (
      context.ts.isInterfaceDeclaration(node) ||
      context.ts.isClassDeclaration(node)
    ) {
      return parseJsDocForNode(
        node,
        ["slot"],
        (tagNode, { name, type, description }) => {
          // Treat "-" as unnamed slot
          if (name === "-") {
            name = undefined;
          }

          // Grab the type from jsdoc and use it to find permitted tag names
          // Example: @slot {"div"|"span"} myslot
          const permittedTagNameType = type
            ? parseSimpleJsDocTypeExpression(tagNode, type, context)
            : undefined;

          const permittedTagNames: string[] | undefined = (() => {
            if (!permittedTagNameType) {
              return undefined;
            }

            if (isSimpleType(permittedTagNameType)) {
              switch (permittedTagNameType.kind) {
                case SimpleTypeKind.STRING_LITERAL:
                  return [permittedTagNameType.value];
                case SimpleTypeKind.UNION:
                  return permittedTagNameType.types
                    .filter(
                      (type): type is SimpleTypeStringLiteral =>
                        type.kind === SimpleTypeKind.STRING_LITERAL
                    )
                    .map(type => type.value);
                default:
                  return undefined;
              }
            } else {
              if (permittedTagNameType.isStringLiteral()) {
                return [permittedTagNameType.value];
              }

              throw new Error("fixme");
            }
          })();

          return {
            name: name,
            jsDoc: description != null ? { description } : undefined,
            permittedTagNames
          };
        },
        context
      );
    }

    return undefined;
  },
  member: (
    node: Node,
    context: AnalyzerVisitContext
  ): ComponentMember[] | undefined => {
    if (
      context.ts.isInterfaceDeclaration(node) ||
      context.ts.isClassDeclaration(node)
    ) {
      const priority = getNodeSourceFileLang(node) === "js" ? "high" : "medium";

      const checker = context.program.getTypeChecker();

      const properties = parseJsDocForNode(
        node,
        ["prop", "property"],
        (tagNode, { name, default: def, type, description }) => {
          if (name != null && name.length > 0) {
            const member: ComponentMemberProperty = {
              priority,
              kind: "property",
              propName: name,
              jsDoc: description != null ? { description } : undefined,
              typeHint: type,
              type: () =>
                (type &&
                  parseSimpleJsDocTypeExpression(tagNode, type, context)) ||
                checker.getAnyType(),
              node: tagNode,
              default: def,
              visibility: undefined,
              reflect: undefined,
              required: undefined,
              deprecated: undefined
            };

            return member;
          }

          return undefined;
        },
        context
      );

      const attributes = parseJsDocForNode(
        node,
        ["attr", "attribute"],
        (tagNode, { name, default: def, type, description }) => {
          if (name != null && name.length > 0) {
            return {
              priority,
              kind: "attribute",
              attrName: name,
              jsDoc: description != null ? { description } : undefined,
              type: lazy(
                () =>
                  (type &&
                    parseSimpleJsDocTypeExpression(tagNode, type, context)) ||
                  checker.getAnyType()
              ),
              typeHint: type,
              node: tagNode,
              default: def,
              visibility: undefined,
              reflect: undefined,
              required: undefined,
              deprecated: undefined
            } as ComponentMemberAttribute;
          }

          return undefined;
        },
        context
      );

      if (attributes != null || properties != null) {
        return [...(attributes || []), ...(properties || [])];
      }

      return undefined;
    }

    return undefined;
  }
};
