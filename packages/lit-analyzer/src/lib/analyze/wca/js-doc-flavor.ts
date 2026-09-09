/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { JSDocTag, Node } from "typescript";
import { isMyUnionType } from "../my-union-type.js";
import { getNodeIdentifier, getNodeSourceFileLang } from "./ast-util.js";
import { getJsDoc, parseSimpleJsDocTypeExpression } from "./js-doc-util.js";
import {
  AnalyzerFlavor,
  AnalyzerVisitContext,
  ComponentCssPart,
  ComponentCssProperty,
  ComponentDeclaration,
  ComponentEvent,
  ComponentMember,
  ComponentMemberAttribute,
  ComponentMemberProperty,
  ComponentMemberReflectKind,
  ComponentSlot,
  DefinitionNodeResult,
  FeatureDiscoverVisitMap,
  JsDoc,
  JsDocTagParsed,
  VisibilityKind,
} from "./wca-types.js";

/**
 * Flavors for analyzing jsdoc related features
 */
export class JsDocFlavor implements AnalyzerFlavor {
  discoverDefinitions = discoverDefinitions;

  discoverFeatures = discoverFeatures;

  discoverGlobalFeatures = discoverGlobalFeatures;

  refineFeature = refineFeature;

  refineDeclaration = refineDeclaration;
}

/**
 * Discovers definitions using "@customElement" or "@element" jsdoc.
 */
function discoverDefinitions(
  node: Node,
  context: AnalyzerVisitContext,
): DefinitionNodeResult[] | undefined {
  // /** @customElement my-element */ myClass extends HTMLElement { ... }
  if (
    context.ts.isInterfaceDeclaration(node) ||
    context.ts.isClassDeclaration(node)
  ) {
    const identifier = getNodeIdentifier(node, context);

    return parseJsDocForNode(
      node,
      ["customelement", "element"],
      (tagNode, { name }) => {
        return {
          tagName: name || "",
          definitionNode: tagNode,
          identifierNode: identifier,
          tagNameNode: tagNode,
        };
      },
      context,
    );
  }

  return undefined;
}

const discoverFeatures: Partial<FeatureDiscoverVisitMap<AnalyzerVisitContext>> =
  {
    csspart: (
      node: Node,
      context: AnalyzerVisitContext,
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
                jsDoc: description != null ? { description } : undefined,
              };
            }

            return undefined;
          },
          context,
        );
      }

      return undefined;
    },
    cssproperty: (
      node: Node,
      context: AnalyzerVisitContext,
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
                default: def,
              };
            }

            return undefined;
          },
          context,
        );
      }
      return undefined;
    },
    event: (
      node: Node,
      context: AnalyzerVisitContext,
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
                node: tagNode,
              };
            }

            return undefined;
          },
          context,
        );
      }

      return undefined;
    },
    slot: (
      node: Node,
      context: AnalyzerVisitContext,
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

              if (isMyUnionType(permittedTagNameType)) {
                const { checker } = context;
                return permittedTagNameType.types.map((t) =>
                  t.isStringLiteral() ? t.value : checker.typeToString(t),
                );
              }

              if (permittedTagNameType.isStringLiteral()) {
                return [permittedTagNameType.value];
              }

              // FIXME: looks like we don't test this path,
              // should we return any?

              return undefined;
            })();

            return {
              name: name,
              jsDoc: description != null ? { description } : undefined,
              permittedTagNames,
            };
          },
          context,
        );
      }

      return undefined;
    },
    member: (
      node: Node,
      context: AnalyzerVisitContext,
    ): ComponentMember[] | undefined => {
      if (
        context.ts.isInterfaceDeclaration(node) ||
        context.ts.isClassDeclaration(node)
      ) {
        const priority =
          getNodeSourceFileLang(node) === "js" ? "high" : "medium";

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
                deprecated: undefined,
              };

              return member;
            }

            return undefined;
          },
          context,
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
                type: () =>
                  (type &&
                    parseSimpleJsDocTypeExpression(tagNode, type, context)) ||
                  checker.getAnyType(),
                typeHint: type,
                node: tagNode,
                default: def,
                visibility: undefined,
                reflect: undefined,
                required: undefined,
                deprecated: undefined,
              } as ComponentMemberAttribute;
            }

            return undefined;
          },
          context,
        );

        if (attributes != null || properties != null) {
          return [...(attributes || []), ...(properties || [])];
        }

        return undefined;
      }

      return undefined;
    },
  };

const discoverGlobalFeatures: AnalyzerFlavor["discoverGlobalFeatures"] = {
  csspart: (
    node: Node,
    context: AnalyzerVisitContext,
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
    context: AnalyzerVisitContext,
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
    context: AnalyzerVisitContext,
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
    context: AnalyzerVisitContext,
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
    context: AnalyzerVisitContext,
  ): ComponentMember[] | undefined => {
    if (
      context.ts.isInterfaceDeclaration(node) &&
      node.name.text === "HTMLElement"
    ) {
      return discoverFeatures?.member?.(node, context);
    }

    return undefined;
  },
};

/**
 * Transforms jsdoc tags to a T array using a "transform".
 */
function parseJsDocForNode<T>(
  node: Node,
  tagNames: string[],
  transform: (tagNode: JSDocTag, parsed: JsDocTagParsed) => T | undefined,
  context: AnalyzerVisitContext,
): T[] | undefined {
  const { tags } = getJsDoc(node, context.ts, tagNames) || {};

  if (tags && tags.length > 0) {
    context.emitContinue?.();

    return tags
      .map((tag) => {
        if (!tag.node) {
          throw new Error("node is undefined");
        }

        return transform(tag.node, tag.parsed());
      })
      .filter((t) => t != null);
  }

  return undefined;
}

/**
 * Refines a component declaration by using jsdoc tags.
 */
function refineDeclaration(
  declaration: ComponentDeclaration,
  context: AnalyzerVisitContext,
): ComponentDeclaration | undefined {
  if (declaration.jsDoc == null || declaration.jsDoc.tags == null) {
    return undefined;
  }

  // Applies the "@deprecated" jsdoc tag
  const deprecatedTag = declaration.jsDoc.tags.find(
    (t) => t.tag === "deprecated",
  );
  if (deprecatedTag != null) {
    return {
      ...declaration,
      deprecated: deprecatedTag.comment || true,
    };
  }

  return undefined;
}

/**
 * Refines features by looking at the jsdoc tags on the feature.
 */
const refineFeature: AnalyzerFlavor["refineFeature"] = {
  event: (event, context) => {
    if (event.jsDoc == null || event.jsDoc.tags == null) return event;

    // Check if the feature has "@ignore" jsdoc tag
    if (hasIgnoreJsDocTag(event.jsDoc)) {
      return undefined;
    }

    // TODO: below code could be refactored to be more readable
    // functional approach is not needed here and it is difficult to debug
    // let result = applyJsDocDeprecated(event, event.jsDoc);
    // result = applyJsDocVisibility(result, event.jsDoc);
    // result = applyJsDocType(result, event.jsDoc, context);

    return [applyJsDocDeprecated, applyJsDocVisibility, applyJsDocType].reduce(
      (event, applyFunc) =>
        (applyFunc as Function)(event, event.jsDoc, context),
      event,
    );
  },
  method: (method, context) => {
    if (method.jsDoc == null || method.jsDoc.tags == null) return method;

    // Check if the feature has "@ignore" jsdoc tag
    if (hasIgnoreJsDocTag(method.jsDoc)) {
      return undefined;
    }

    method = [applyJsDocDeprecated, applyJsDocVisibility].reduce(
      (method, applyFunc) =>
        (applyFunc as Function)(method, method.jsDoc, context),
      method,
    );

    return method;
  },
  member: (member, context) => {
    // Return right away if the member doesn't have jsdoc
    if (member.jsDoc == null || member.jsDoc.tags == null) return member;

    // Check if the feature has "@ignore" jsdoc tag
    if (hasIgnoreJsDocTag(member.jsDoc)) {
      return undefined;
    }

    return [
      applyJsDocDeprecated,
      applyJsDocVisibility,
      applyJsDocRequired,
      applyJsDocDefault,
      applyJsDocReflect,
      applyJsDocType,
      applyJsDocAttribute,
      applyJsDocModifiers,
    ].reduce(
      (member, applyFunc) =>
        (applyFunc as Function)(member, member.jsDoc, context),
      member,
    );
  },
};

/**
 * Applies the "@deprecated" jsdoc tag
 * @param feature
 * @param jsDoc
 */
function applyJsDocDeprecated<
  T extends Partial<Pick<ComponentMember, "deprecated">>,
>(feature: T, jsDoc: JsDoc): T {
  const deprecatedTag = jsDoc.tags?.find((tag) => tag.tag === "deprecated");

  if (deprecatedTag != null) {
    return {
      ...feature,
      deprecated: deprecatedTag.comment || true,
    };
  }

  return feature;
}

/**
 * Applies the "@access" jsdoc tag
 * @param feature
 * @param jsDoc
 */
function applyJsDocVisibility<
  T extends Partial<Pick<ComponentMember, "visibility">>,
>(feature: T, jsDoc: JsDoc): T {
  const visibilityTag = jsDoc.tags?.find((tag) =>
    ["public", "protected", "private", "package", "access"].includes(tag.tag),
  ); // member + method

  if (visibilityTag != null) {
    return {
      ...feature,
      visibility: ((): VisibilityKind | undefined => {
        switch (visibilityTag.tag) {
          case "public":
            return "public";
          case "protected":
            return "protected";
          case "package":
          case "private":
            return "private";
          case "access":
            switch (visibilityTag.parsed().name) {
              case "public":
                return "public";
              case "protected":
                return "protected";
              case "private":
              case "package":
                return "private";
              default:
                return undefined;
            }
          default:
            return undefined;
        }
      })(),
    };
  }

  return feature;
}

/**
 * Applies the "@attribute" jsdoc tag
 * @param feature
 * @param jsDoc
 * @param context
 */
function applyJsDocAttribute<
  T extends Partial<
    Pick<
      ComponentMember,
      "propName" | "attrName" | "default" | "type" | "typeHint"
    >
  >,
>(feature: T, jsDoc: JsDoc, context: AnalyzerVisitContext): T {
  const attributeTag = jsDoc.tags?.find((tag) =>
    ["attr", "attribute"].includes(tag.tag),
  );

  if (attributeTag != null && feature.attrName == null) {
    const parsed = attributeTag.parsed();

    const result: T = {
      ...feature,
      attrName: attributeTag.parsed().name || feature.propName,
      default: feature.default ?? parsed.default,
    };

    // @attr jsdoc tag can also include the type of attribute
    if (parsed.type != null && result.typeHint == null) {
      result.typeHint = parsed.type;

      result.type =
        feature.type ??
        (() =>
          parseSimpleJsDocTypeExpression(
            attributeTag.node,
            parsed.type || "",
            context,
          ));
    }

    return result;
  }

  return feature;
}

/**
 * Applies the "@required" jsdoc tag
 * @param feature
 * @param jsDoc
 */
function applyJsDocRequired<
  T extends Partial<Pick<ComponentMember, "required">>,
>(feature: T, jsDoc: JsDoc): T {
  const requiredTag = jsDoc.tags?.find((tag) =>
    ["optional", "required"].includes(tag.tag),
  );

  if (requiredTag != null) {
    return {
      ...feature,
      required: requiredTag.tag === "required",
    };
  }

  return feature;
}

/**
 * Applies the "@readonly" jsdoc tag
 * @param feature
 * @param jsDoc
 */
function applyJsDocModifiers<
  T extends Partial<Pick<ComponentMember, "modifiers">>,
>(feature: T, jsDoc: JsDoc): T {
  const readonlyTag = jsDoc.tags?.find((tag) => tag.tag === "readonly");

  if (readonlyTag != null) {
    return {
      ...feature,
      modifiers: (feature.modifiers != null
        ? new Set(feature.modifiers)
        : new Set()
      ).add("readonly"),
    };
  }

  return feature;
}

/**
 * Applies the "@default" jsdoc tag
 * @param feature
 * @param jsDoc
 */
function applyJsDocDefault<T extends Partial<Pick<ComponentMember, "default">>>(
  feature: T,
  jsDoc: JsDoc,
): T {
  const defaultTag = jsDoc.tags?.find((tag) => tag.tag === "default");

  if (defaultTag != null) {
    return {
      ...feature,
      default: defaultTag.comment,
    };
  }

  return feature;
}

/**
 * Applies the "@reflect" jsdoc tag
 * @param feature
 * @param jsDoc
 */
function applyJsDocReflect<T extends Partial<Pick<ComponentMember, "reflect">>>(
  feature: T,
  jsDoc: JsDoc,
): T {
  const reflectTag = jsDoc.tags?.find((tag) => tag.tag === "reflect");

  if (reflectTag != null && feature.reflect == null) {
    return {
      ...feature,
      reflect: ((): ComponentMemberReflectKind | undefined => {
        switch (reflectTag.comment) {
          case "to-attribute":
            return "to-attribute";
          case "to-property":
            return "to-property";
          case "both":
            return "both";
          default:
            return undefined;
        }
      })(),
    };
  }

  return feature;
}

/**
 * Applies the "@type" jsdoc tag
 * @param feature
 * @param jsDoc
 * @param context
 */
function applyJsDocType<
  T extends Partial<Pick<ComponentMember, "type" | "typeHint">>,
>(feature: T, jsDoc: JsDoc, context: AnalyzerVisitContext): T {
  const typeTag = jsDoc.tags?.find((tag) => tag.tag === "type");

  if (typeTag != null && feature.typeHint == null) {
    const parsed = typeTag.parsed();

    if (parsed.type != null && parsed.type.length > 0) {
      return {
        ...feature,
        typeHint: parsed.type,
        type:
          feature.type ??
          (() =>
            parseSimpleJsDocTypeExpression(
              typeTag.node,
              parsed.type || "",
              context,
            )),
      };
    }
  }

  return feature;
}

/**
 * Returns if jsdoc contains an ignore node
 * @param jsDoc
 */
function hasIgnoreJsDocTag(jsDoc: JsDoc): boolean {
  return jsDoc?.tags?.find((tag) => tag.tag === "ignore") != null;
}
