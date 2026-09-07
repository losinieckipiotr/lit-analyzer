import * as tsModule from "typescript";
import {
  CallExpression,
  GetAccessorDeclaration,
  Node,
  PropertyAssignment,
  PropertyDeclaration,
  PropertySignature,
  ReturnStatement,
  SetAccessorDeclaration,
  Type,
  TypeChecker,
} from "typescript";
import {
  getDecorators,
  getMemberVisibilityFromNode,
  getModifiersFromNode,
  getNodeIdentifier,
  getNodeName,
  getNodeSourceFileLang,
  hasModifier,
  resolveNodeValue,
} from "../ast-util.js";
import { camelToDashCase, isNamePrivate } from "../util/str-util.js";
import { getJsDoc, getJsDocType } from "../wca/js-doc-util.js";
import {
  AnalyzerDeclarationVisitContext,
  AnalyzerFlavor,
  AnalyzerVisitContext,
  ComponentMember,
  ComponentMethod,
  DefinitionNodeResult,
  LitElementPropertyConfig,
} from "../wca/wca-types.js";

/**
 * Flavors for analyzing LitElement related features: https://lit-element.polymer-project.org/
 */
export class LitElementFlavor implements AnalyzerFlavor {
  excludeNode = excludeNodeLitElement;
  discoverDefinitions = discoverDefinitionsLitElement;

  discoverFeatures = {
    member: discoverMembersLitElement,
  };

  refineFeature = {
    method: refineFeatureLitElement,
  };
}

function excludeNodeLitElement(
  node: Node,
  context: AnalyzerVisitContext,
): boolean | undefined {
  if (context.config.analyzeDependencies) {
    return undefined;
  }

  // Exclude lit element related super classes if "analyzeLib" is false
  const declName = getNodeName(node, context);
  if (declName != null) {
    return declName === "LitElement" || declName === "UpdatingElement";
  } else {
    const fileName = node.getSourceFile().fileName;

    return (
      fileName.includes("/lit-element.") ||
      fileName.endsWith("/updating-element.")
    );
  }
}

/**
 * Visits lit-element related definitions.
 * Specifically it finds the usage of the @customElement decorator.
 */
function discoverDefinitionsLitElement(
  node: Node,
  context: AnalyzerVisitContext,
): DefinitionNodeResult[] | undefined {
  const { ts, checker } = context;

  // @customElement("my-element")
  if (ts.isClassDeclaration(node)) {
    // Visit all decorators on the class
    for (const decorator of getDecorators(node, context)) {
      const callExpression = decorator.expression;

      // Find "@customElement"
      if (
        ts.isCallExpression(callExpression) &&
        ts.isIdentifier(callExpression.expression)
      ) {
        const decoratorIdentifierName = callExpression.expression.escapedText;

        // Decorators called "customElement"
        if (decoratorIdentifierName === "customElement") {
          // Resolve the value of the first argument. This is the tag name.
          const unresolvedTagNameNode = callExpression.arguments[0];
          const resolvedTagNameNode = resolveNodeValue(unresolvedTagNameNode, {
            ts,
            checker,
            strict: true,
          });
          const identifier = getNodeIdentifier(node, context);

          if (
            resolvedTagNameNode != null &&
            typeof resolvedTagNameNode.value === "string"
          ) {
            return [
              {
                tagName: resolvedTagNameNode.value,
                tagNameNode: resolvedTagNameNode.node,
                identifierNode: identifier,
              },
            ];
          }
        }
      }
    }

    return undefined;
  }

  // note: it did not return definitions from child nodes, was it a bug?
  const results: DefinitionNodeResult[] = [];

  node.forEachChild((child) => {
    const result = discoverDefinitionsLitElement(child, context);

    if (result) {
      results.push(...result);
    }
  });

  return results.length > 0 ? results : undefined;
}

/**
 * Parses lit-related declaration members.
 * This is primary by looking at the "@property" decorator and the "static get properties()".
 */
function discoverMembersLitElement(
  node: Node,
  context: AnalyzerDeclarationVisitContext,
): ComponentMember[] | undefined {
  const { ts } = context;

  // Never pick up members not declared directly on the declaration node being traversed
  if (node.parent !== context.declarationNode) {
    return undefined;
  }

  // static get properties() { return { myProp: {type: String} } }
  if (
    ts.isGetAccessor(node) &&
    hasModifier(node, ts.SyntaxKind.StaticKeyword, ts)
  ) {
    const name = node.name.getText();
    if (name === "properties" && node.body != null) {
      const returnStatement = node.body.statements.find<ReturnStatement>(
        ts.isReturnStatement.bind(ts),
      );
      if (returnStatement != null) {
        return parseStaticProperties(returnStatement, context);
      }
    }
  }

  // @property({type: String}) myProp = "hello";
  else if (
    ts.isSetAccessor(node) ||
    ts.isGetAccessor(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node)
  ) {
    return parsePropertyDecorator(node, context);
  }

  return undefined;
}

/**
 * Visits a lit property decorator and returns members based on it.
 */
function parsePropertyDecorator(
  node:
    | SetAccessorDeclaration
    | GetAccessorDeclaration
    | PropertyDeclaration
    | PropertySignature,
  context: AnalyzerDeclarationVisitContext,
): ComponentMember[] | undefined {
  const { ts, checker } = context;

  // Parse the content of a possible lit "@property" decorator.
  const litConfig = getLitElementPropertyDecoratorConfig(node, context);

  if (litConfig != null) {
    const propName = node.name.getText();

    // Get the attribute based on the configuration
    const attrName = getLitAttributeName(propName, litConfig, context);

    // Find the default value for this property
    const initializer = "initializer" in node ? node.initializer : undefined;
    const resolvedDefaultValue =
      initializer != null ? resolveNodeValue(initializer, context) : undefined;
    const def =
      resolvedDefaultValue != null
        ? resolvedDefaultValue.value
        : initializer?.getText();

    // Find our if the property/attribute is required
    //const required = ("initializer" in node && isPropertyRequired(node, context.checker)) || undefined;
    const required = undefined;

    const jsDoc = getJsDoc(node, ts);

    // Emit a property with "attrName"
    return [
      {
        priority: "high",
        kind: "property",
        propName,
        attrName,
        type: () => {
          const propType = checker.getTypeAtLocation(node);

          if (
            getNodeSourceFileLang(node) === "js" &&
            typeof litConfig.type === "object"
          ) {
            const isAnyType = (litConfig.type.flags & ts.TypeFlags.Any) !== 0;

            if (isAnyType) {
              return checker.getAnyType();
            }
          }

          return propType;
        },
        node,
        default: def,
        required,
        jsDoc,
        meta: litConfig,
        visibility: getMemberVisibilityFromNode(node, ts),
        reflect: litConfig.reflect
          ? "both"
          : attrName != null
            ? "to-property"
            : undefined,
        modifiers: getModifiersFromNode(node, ts),
      },
    ];
  }

  return undefined;
}

/**
 * Returns if we are in a Polymer context.
 */
function inPolymerFlavorContext(
  context: AnalyzerDeclarationVisitContext,
): boolean {
  const declaration = context.getDeclaration();

  // TODO: find a better way to construct a cache key
  const cacheKey = `isPolymerFlavorContext:${context.sourceFile?.fileName || "unknown"}`;

  if (context.cache.general.has(cacheKey)) {
    return context.cache.general.get(cacheKey) as boolean;
  }

  let result = false;

  // Use "@polymer" jsdoc tag to indicate that this is polymer context
  if (
    declaration.jsDoc?.tags?.some(
      (t) => t.tag === "polymer" || t.tag === "polymerElement",
    )
  ) {
    result = true;
  }

  // TODO: This only checks the immediate inheritance. Make it recursive to go throught the entire inheritance chain.
  if (
    context
      .getDeclaration()
      .heritageClauses.some((c) =>
        ["PolymerElement", "Polymer.Element"].includes(c.identifier.getText()),
      )
  ) {
    result = true;
  }

  context.cache.general.set(cacheKey, result);

  return result;
}

/**
 * Returns an attribute name based on a property name and a lit-configuration.
 */
function getLitAttributeName(
  propName: string,
  litConfig: LitElementPropertyConfig,
  context: AnalyzerDeclarationVisitContext,
): string | undefined {
  // Don't emit attribute if the value is specifically "false"
  if (litConfig.attribute === false) {
    return undefined;
  }

  // Get the attribute name either by looking at "{attribute: ...}" or just taking the property name.
  let attrName =
    typeof litConfig.attribute === "string" ? litConfig.attribute : propName;

  if (inPolymerFlavorContext(context)) {
    // From the documentation: https://polymer-library.polymer-project.org/3.0/docs/devguide/properties#attribute-reflection
    attrName = camelToDashCase(attrName).toLowerCase();
  }

  return attrName;
}

/**
 * Visits static properties
 * static get properties() { return { myProp: {type: String, attribute: "my-attr"} } }
 */
function parseStaticProperties(
  returnStatement: ReturnStatement,
  context: AnalyzerDeclarationVisitContext,
): ComponentMember[] {
  const { ts, checker } = context;

  const memberResults: ComponentMember[] = [];

  if (
    returnStatement.expression != null &&
    ts.isObjectLiteralExpression(returnStatement.expression)
  ) {
    // Each property in the object literal expression corresponds to a class field.
    for (const propNode of returnStatement.expression.properties) {
      // Get propName
      const propName =
        propNode.name != null && ts.isIdentifier(propNode.name)
          ? propNode.name.text
          : undefined;
      if (propName == null) {
        continue;
      }

      // Parse the lit property config for this property
      // Treat non-object-literal-expressions like the "type" (to support Polymer specific syntax)
      let litConfig: LitElementPropertyConfig = {};
      if (ts.isPropertyAssignment(propNode)) {
        if (
          inPolymerFlavorContext(context) &&
          !ts.isObjectLiteralExpression(propNode.initializer)
        ) {
          litConfig = {
            type: getLitPropertyType(ts, checker, propNode.initializer),
          };
        } else {
          const resolved = resolveNodeValue(propNode.initializer, context);

          if (resolved) {
            litConfig = getLitPropertyOptions(
              resolved.node,
              resolved.value,
              context,
              litConfig,
            );
          }
        }
      }

      // Get attrName based on the litConfig
      const attrName = getLitAttributeName(propName, litConfig, context);

      // Get more metadata
      const jsDoc = getJsDoc(propNode, ts);

      const emitAttribute = litConfig.attribute !== false;

      // Emit either the attribute or the property
      memberResults.push({
        priority: "high",
        kind: "property",
        type: () => {
          let result: Type | undefined = undefined;

          if (jsDoc) {
            result = getJsDocType(jsDoc, context);
          }

          if (!result && typeof litConfig.type === "object") {
            result = litConfig.type;
          }

          return result || checker.getAnyType();
        },
        propName: propName,
        attrName: emitAttribute ? attrName : undefined,
        jsDoc,
        node: propNode,
        meta: litConfig,
        default: litConfig.default,
        reflect: litConfig.reflect
          ? "both"
          : attrName != null
            ? "to-property"
            : undefined,
        visibility: isNamePrivate(propName) ? "private" : undefined,
      });
    }
  }

  return memberResults;
}

const LIT_ELEMENT_PROTECTED_METHODS = [
  "render",
  "requestUpdate",
  "firstUpdated",
  "updated",
  "update",
  "shouldUpdate",
  "hasUpdated",
  "updateComplete",
];

function refineFeatureLitElement(
  method: ComponentMethod,
  context: AnalyzerVisitContext,
): ComponentMethod | undefined {
  // This is temporary, but for now we force lit-element named methods to be protected
  if (LIT_ELEMENT_PROTECTED_METHODS.includes(method.name)) {
    return {
      ...method,
      visibility: "protected",
    };
  }

  return method;
}

type LitElementPropertyDecoratorKind =
  "property" | "internalProperty" | "state";

const LIT_ELEMENT_PROPERTY_DECORATOR_KINDS: LitElementPropertyDecoratorKind[] =
  ["property", "internalProperty", "state"];

/**
 * Returns a potential lit element property decorator.
 */
function getLitElementPropertyDecorator(
  node: Node,
  context: AnalyzerVisitContext,
):
  | { expression: CallExpression; kind: LitElementPropertyDecoratorKind }
  | undefined {
  const { ts } = context;

  // Find a decorator with "property" name.
  for (const decorator of getDecorators(node, context)) {
    const expression = decorator.expression;

    // We find the first decorator calling specific identifier name (found in LIT_ELEMENT_PROPERTY_DECORATOR_KINDS)
    if (
      ts.isCallExpression(expression) &&
      ts.isIdentifier(expression.expression)
    ) {
      const identifier = expression.expression;
      const kind = identifier.text as LitElementPropertyDecoratorKind;
      if (LIT_ELEMENT_PROPERTY_DECORATOR_KINDS.includes(kind)) {
        return { expression, kind };
      }
    }
  }

  return undefined;
}

/**
 * Returns a potential lit property decorator configuration.
 */
function getLitElementPropertyDecoratorConfig(
  node: Node,
  context: AnalyzerVisitContext,
): undefined | LitElementPropertyConfig {
  // Get reference to a possible "@property" decorator.
  const decorator = getLitElementPropertyDecorator(node, context);

  if (decorator != null) {
    // Parse the first argument to the decorator which is the lit-property configuration.
    const configNode = decorator.expression.arguments[0];

    // Add decorator to "nodes"
    const config: LitElementPropertyConfig = {
      node: { decorator: decorator.expression },
    };

    // Apply specific config based on the decorator kind
    switch (decorator.kind) {
      case "internalProperty":
      case "state":
        config.attribute = false;
        config.state = true;
        break;
    }

    if (configNode == null) {
      return config;
    }

    const resolved = resolveNodeValue(configNode, context);

    return resolved != null
      ? getLitPropertyOptions(resolved.node, resolved.value, context, config)
      : config;
  }

  return undefined;
}

/**
 * Determines if a given object has the specified property, used
 * as a type-guard.
 */
function hasOwnProperty<T extends string>(
  obj: object,
  key: T,
): obj is { [K in T]: unknown } {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Computes the correct type for a given node for use in lit property
 * configuration.
 * @param ts
 * @param node
 */
function getLitPropertyType(
  ts: typeof tsModule,
  checker: TypeChecker,
  node: Node,
): Type {
  const value = ts.isIdentifier(node) ? node.text : undefined;

  // TODO: magic values, should be documented or taken from compiler?
  switch (value) {
    case "String":
    case "StringConstructor":
      return checker.getStringType();
    case "Number":
    case "NumberConstructor":
      return checker.getNumberType();
    case "Boolean":
    case "BooleanConstructor":
      return checker.getBooleanType();
    case "Array":
    case "ArrayConstructor":
      return checker.getNonPrimitiveType();
    case "Object":
    case "ObjectConstructor":
      return checker.getNonPrimitiveType();
    default:
      return checker.getUnknownType();
  }
}

/**
 * Parses an object literal expression and returns a lit property configuration.
 */
function getLitPropertyOptions(
  node: Node,
  object: unknown,
  context: AnalyzerVisitContext,
  existingConfig: LitElementPropertyConfig = {},
): LitElementPropertyConfig {
  const { ts, checker } = context;
  const result: LitElementPropertyConfig = { ...existingConfig };
  let attributeInitializer: Node | undefined;
  let typeInitializer: Node | undefined;

  if (typeof object === "object" && object !== null && !Array.isArray(object)) {
    if (hasOwnProperty(object, "converter") && object.converter !== undefined) {
      result.hasConverter = true;
    }

    if (hasOwnProperty(object, "reflect") && object.reflect !== undefined) {
      result.reflect = object.reflect === true;
    }

    if (hasOwnProperty(object, "state") && object.state !== undefined) {
      result.state = object.state === true;
    }

    if (hasOwnProperty(object, "value")) {
      result.default = object.value;
    }

    if (
      hasOwnProperty(object, "attribute") &&
      (typeof object.attribute === "boolean" ||
        typeof object.attribute === "string")
    ) {
      result.attribute = object.attribute;

      if (ts.isObjectLiteralExpression(node)) {
        const prop = node.properties.find(
          (p): p is PropertyAssignment =>
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === "attribute",
        );
        if (prop) {
          attributeInitializer = prop.initializer;
        }
      }
    }
  }

  if (ts.isObjectLiteralExpression(node)) {
    const typeProp = node.properties.find(
      (p): p is PropertyAssignment =>
        ts.isPropertyAssignment(p) &&
        ts.isIdentifier(p.name) &&
        p.name.text === "type",
    );

    if (typeProp) {
      typeInitializer = typeProp.initializer;
      result.type = getLitPropertyType(ts, checker, typeProp.initializer);
    }
  }

  return {
    ...result,
    node: {
      ...(result.node || {}),
      attribute: attributeInitializer,
      type: typeInitializer,
    },
  };
}
