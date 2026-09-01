import {
  GetAccessorDeclaration,
  Node,
  PropertyDeclaration,
  PropertySignature,
  ReturnStatement,
  SetAccessorDeclaration,
  Type
} from "typescript";
import { AnalyzerVisitContext } from "../../flavors/analyzer-flavor.js";
import { ComponentMember } from "../../types/features/component-member.js";
import { ComponentMethod } from "../../types/features/component-method.js";
import { LitElementPropertyConfig } from "../../types/features/lit-element-property-config.js";
import {
  getDecorators,
  getMemberVisibilityFromNode,
  getModifiersFromNode,
  getNodeIdentifier,
  getNodeName,
  getNodeSourceFileLang,
  hasModifier,
  resolveNodeValue
} from "../../util/ast-util.js";
import { getJsDoc, getJsDocType } from "../../util/js-doc-util.js";
import { camelToDashCase, isNamePrivate } from "../../util/text-util.js";
import {
  AnalyzerDeclarationVisitContext,
  AnalyzerFlavor,
  DefinitionNodeResult
} from "../analyzer-flavor.js";
import {
  getLitElementPropertyDecoratorConfig,
  getLitPropertyOptions,
  getLitPropertyType
} from "./parse-lit-property-configuration.js";

/**
 * Flavors for analyzing LitElement related features: https://lit-element.polymer-project.org/
 */
export class LitElementFlavor implements AnalyzerFlavor {
  excludeNode = excludeNodeLitElement;
  discoverDefinitions = discoverDefinitionsLitElement;

  discoverFeatures = {
    member: discoverMembersLitElement
  };

  refineFeature = {
    method: refineFeatureLitElement
  };
}

function excludeNodeLitElement(
  node: Node,
  context: AnalyzerVisitContext
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
  context: AnalyzerVisitContext
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
            strict: true
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
                identifierNode: identifier
              }
            ];
          }
        }
      }
    }

    return undefined;
  }

  // note: it did not return definitions from child nodes, was it a bug?
  const results: DefinitionNodeResult[] = [];

  node.forEachChild(child => {
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
  context: AnalyzerDeclarationVisitContext
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
        ts.isReturnStatement.bind(ts)
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
 * @param node
 * @param context
 */
function parsePropertyDecorator(
  node:
    | SetAccessorDeclaration
    | GetAccessorDeclaration
    | PropertyDeclaration
    | PropertySignature,
  context: AnalyzerDeclarationVisitContext
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
        modifiers: getModifiersFromNode(node, ts)
      }
    ];
  }

  return undefined;
}

/**
 * Returns if we are in a Polymer context.
 * @param context
 */
function inPolymerFlavorContext(
  context: AnalyzerDeclarationVisitContext
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
      t => t.tag === "polymer" || t.tag === "polymerElement"
    )
  ) {
    result = true;
  }

  // TODO: This only checks the immediate inheritance. Make it recursive to go throught the entire inheritance chain.
  if (
    context
      .getDeclaration()
      .heritageClauses.some(c =>
        ["PolymerElement", "Polymer.Element"].includes(c.identifier.getText())
      )
  ) {
    result = true;
  }

  context.cache.general.set(cacheKey, result);

  return result;
}

/**
 * Returns an attribute name based on a property name and a lit-configuration
 * @param propName
 * @param litConfig
 * @param context
 */
function getLitAttributeName(
  propName: string,
  litConfig: LitElementPropertyConfig,
  context: AnalyzerDeclarationVisitContext
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
 * @param returnStatement
 * @param context
 */
function parseStaticProperties(
  returnStatement: ReturnStatement,
  context: AnalyzerDeclarationVisitContext
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
            type: getLitPropertyType(ts, checker, propNode.initializer)
          };
        } else {
          const resolved = resolveNodeValue(propNode.initializer, context);

          if (resolved) {
            litConfig = getLitPropertyOptions(
              resolved.node,
              resolved.value,
              context,
              litConfig
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
        visibility: isNamePrivate(propName) ? "private" : undefined
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
  "updateComplete"
];

function refineFeatureLitElement(
  method: ComponentMethod,
  context: AnalyzerVisitContext
): ComponentMethod | undefined {
  // This is temporary, but for now we force lit-element named methods to be protected
  if (LIT_ELEMENT_PROTECTED_METHODS.includes(method.name)) {
    return {
      ...method,
      visibility: "protected"
    };
  }

  return method;
}
