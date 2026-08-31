import { Node, Type, TypeChecker } from "typescript";
import {
  isSimpleType,
  LitElementPropertyConfig,
  SimpleType,
  SimpleTypeKind,
  simpleTypeToString,
  typeToString,
} from "../../web-component-analyzer/src/api.js";
import { RuleModuleContext } from "../analyze/rule-collection.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { joinArray } from "../analyze/util/array-util.js";
import { rangeFromNode } from "../analyze/util/range-util.js";

const rule: RuleModule = {
  id: "no-incompatible-property-type",
  meta: {
    priority: "low",
  },
  visitComponentMember(member, context) {
    if (
      member.kind !== "property" ||
      member.modifiers?.has("static") ||
      member.meta == null
    ) {
      return;
    }

    if (
      (member.meta.node?.type ?? member.node)?.getSourceFile() !== context.file
    ) {
      return;
    }

    const checker = context.program.getTypeChecker();

    // Grab the type and fallback to "any"
    const type = member.type?.() || checker.getAnyType();

    const node =
      member.meta.node?.type ||
      member.meta.node?.decorator?.expression ||
      member.node;
    const { meta: litConfig, propName } = member;

    return validateLitPropertyConfig(node, litConfig, propName, type, context);
  },
};

enum LitPropertyType {
  String = "String",
  Number = "Number",
  Boolean = "Boolean",
  Array = "Array",
  Object = "Object",
  Any = "Any",
}

function simpleTypeKindToLitPropertyType(
  simpleTypeKind: SimpleTypeKind,
): LitPropertyType {
  switch (simpleTypeKind) {
    case "STRING":
      return LitPropertyType.String;
    case "NUMBER":
      return LitPropertyType.Number;
    case "BOOLEAN":
      return LitPropertyType.Boolean;
    case "ARRAY":
      return LitPropertyType.Array;
    case "OBJECT":
      return LitPropertyType.Object;
    case "ANY":
      return LitPropertyType.Any;
    default: {
      throw new Error(`Unsupported simple type kind: ${simpleTypeKind}`);
    }
  }
}

function isAssignableTo(
  typeToCheckOptional: Type,
  configType: LitPropertyType,
  checker: TypeChecker,
): boolean {
  // allow optional properties
  const typeToCheck = checker.getNonNullableType(typeToCheckOptional);

  switch (configType) {
    case LitPropertyType.String: {
      const stringType = checker.getStringType();

      if (typeToCheck.isUnion()) {
        const result = checker.isTypeAssignableTo(typeToCheck, stringType);

        return result;
      } else {
        return checker.isTypeAssignableTo(typeToCheck, stringType);
      }
    }
    case LitPropertyType.Number:
      return checker.isTypeAssignableTo(typeToCheck, checker.getNumberType());

    case LitPropertyType.Boolean:
      return checker.isTypeAssignableTo(typeToCheck, checker.getBooleanType());
    case LitPropertyType.Array: {
      return checker.isArrayType(typeToCheck);
    }
    case LitPropertyType.Object:
      return checker.isTypeAssignableTo(
        typeToCheck,
        checker.getNonPrimitiveType(),
      );
    case LitPropertyType.Any:
      return true;
    default:
      return false;
  }
}

// Collect type kinds that can be used in as "type" in the @property decorator
function getAcceptedTypeKinds(typeToCheck: Type, checker: TypeChecker) {
  return [
    LitPropertyType.String,
    LitPropertyType.Number,
    LitPropertyType.Boolean,
    LitPropertyType.Array,
    LitPropertyType.Object,
  ].filter((kind) => isAssignableTo(typeToCheck, kind, checker));
}

/**
 * Runs through a lit configuration and validates against the "simplePropType".
 * Emits diagnostics through the context.
 */
function validateLitPropertyConfig(
  node: Node,
  litConfig: LitElementPropertyConfig,
  propName: string,
  typeToCheck: Type | SimpleType,
  context: RuleModuleContext,
) {
  const location = rangeFromNode(node);

  // Check if "type" is one of the built in default type converter hint
  if (typeof litConfig.type === "string" && !litConfig.hasConverter) {
    context.report({
      location,
      message: `'${litConfig.type}' is not a valid type for the default converter.`,
      fixMessage:
        litConfig.attribute !== false
          ? "Have you considered '{attribute: false}' instead?"
          : "Have you considered removing 'type'?",
    });
  }

  // Don't continue if we don't know the property type (eg if we are in a js file)
  // Don't continue if this property has a custom converter (because then we don't know how the value will be converted)
  if (
    !typeToCheck ||
    litConfig.hasConverter ||
    typeof litConfig.type === "string"
  ) {
    return;
  }

  const checker = context.program.getTypeChecker();

  // TODO: should be removed when simple type will be removed
  if (isSimpleType(typeToCheck)) {
    throw new Error("not implemented");
  }

  // Test the @property type against the actual type if a type has been provided
  if (litConfig.type) {
    const configType = simpleTypeKindToLitPropertyType(litConfig.type.kind);

    if (isAssignableTo(typeToCheck, configType, checker)) {
      return;
    }

    // Suggest what to use instead
    const acceptedTypeKindsList = getAcceptedTypeKinds(typeToCheck, checker);

    // Report error if the @property type is not assignable to the actual type
    let message: string;

    if (acceptedTypeKindsList.length >= 1) {
      const potentialKindText = joinArray(
        acceptedTypeKindsList.map((kind) => `'${kind}'`),
        ", ",
        "or",
      );

      message = `@property type should be ${potentialKindText} instead of '${configType}'`;
    } else {
      // If no suggesting can be provided, report that they are not assignable
      // The OBJECT @property type is an escape from this error
      if (litConfig.type.kind === "OBJECT") {
        return;
      }

      const configTypeString = simpleTypeToString(litConfig.type);
      const typeToCheckString = isSimpleType(typeToCheck)
        ? simpleTypeToString(typeToCheck)
        : typeToString(typeToCheck, checker);

      message = `@property type '${configTypeString}' is not assignable to the actual type '${typeToCheckString}'`;
    }

    return context.report({
      location,
      message,
    });
  }

  // continue validation if the attribute is not disabled
  if (litConfig.attribute !== false) {
    const acceptedTypeKindsList = getAcceptedTypeKinds(typeToCheck, checker);

    // Don't report errors because String conversion is default
    if (isAssignableTo(typeToCheck, LitPropertyType.String, checker)) {
      return;
    }

    // report error
    let message: string;
    let fixMessage: string | undefined;

    // Suggest what to use instead if there are multiple accepted @property types for this property
    if (acceptedTypeKindsList.length > 0) {
      // Suggest types to use and include "{attribute: false}" if the @property type is ARRAY or OBJECT

      const textToJoin = acceptedTypeKindsList.map(
        (kind) => `'{type: ${kind}}'`,
      );

      const isAssignableToArray = isAssignableTo(
        typeToCheck,
        LitPropertyType.Array,
        checker,
      );
      const isAssignableToObject = isAssignableTo(
        typeToCheck,
        LitPropertyType.Object,
        checker,
      );

      if (isAssignableToArray || isAssignableToObject) {
        textToJoin.push("'{attribute: false}'");
      }

      const acceptedTypeText = joinArray(textToJoin, ", ", "or");

      message = `Missing ${acceptedTypeText} on @property decorator for '${propName}'`;
    } else {
      const typeToCheckString = typeToString(typeToCheck, checker);

      message = `The built in converter doesn't handle the property type '${typeToCheckString}'.`;
      fixMessage = `Please add '{attribute: false}' on @property decorator for '${propName}'`;
    }

    context.report({
      location,
      message: message,
      fixMessage: fixMessage,
    });
  }

  // TODO: ?
  // message: `You need to add '{attribute: false}' to @property decorator for '${propName}' because '${toTypeString(simplePropType)}' type is not a primitive`
}

export default rule;
