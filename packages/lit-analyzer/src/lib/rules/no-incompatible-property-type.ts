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

/**
 * Returns a string, that can be used in a lit @property decorator for the type key, representing the simple type kind.
 * @param simpleTypeKind
 */
function toLitPropertyTypeString(simpleTypeKind: SimpleTypeKind): string {
  switch (simpleTypeKind) {
    case "STRING":
      return "String";
    case "NUMBER":
      return "Number";
    case "BOOLEAN":
      return "Boolean";
    case "ARRAY":
      return "Array";
    case "OBJECT":
      return "Object";
    default:
      return "";
  }
}

function isAssignableTo(
  typeToCheckOptional: SimpleType | Type,
  configType: SimpleTypeKind,
  checker: TypeChecker,
): boolean {
  if (isSimpleType(typeToCheckOptional)) {
    throw new Error("not implemented");
  }

  // allow optional properties
  const typeToCheck = checker.getNonNullableType(typeToCheckOptional);

  switch (configType) {
    case SimpleTypeKind.STRING: {
      const stringType = checker.getStringType();

      if (typeToCheck.isUnion()) {
        const result = checker.isTypeAssignableTo(typeToCheck, stringType);

        return result;
      } else {
        return checker.isTypeAssignableTo(typeToCheck, stringType);
      }
    }
    case SimpleTypeKind.NUMBER:
      return checker.isTypeAssignableTo(typeToCheck, checker.getNumberType());

    case SimpleTypeKind.BOOLEAN:
      return checker.isTypeAssignableTo(typeToCheck, checker.getBooleanType());
    case SimpleTypeKind.ARRAY: {
      return checker.isArrayType(typeToCheck);
    }
    case SimpleTypeKind.OBJECT:
      return checker.isTypeAssignableTo(
        typeToCheck,
        checker.getNonPrimitiveType(),
      );
    case SimpleTypeKind.ANY:
      return true;
    default:
      return false;
  }
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
  // Check if "type" is one of the built in default type converter hint
  if (typeof litConfig.type === "string" && !litConfig.hasConverter) {
    context.report({
      location: rangeFromNode(node),
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
    typeToCheck == null ||
    litConfig.hasConverter ||
    typeof litConfig.type === "string"
  ) {
    return;
  }

  const checker = context.program.getTypeChecker();

  // Collect type kinds that can be used in as "type" in the @property decorator
  const getAcceptedTypeKinds = () => {
    return (
      ["STRING", "NUMBER", "BOOLEAN", "ARRAY", "OBJECT"] as SimpleTypeKind[]
    ).filter((kind) => isAssignableTo(typeToCheck, kind, checker));
  };

  // Test the @property type against the actual type if a type has been provided
  if (litConfig.type) {
    // Report error if the @property type is not assignable to the actual type

    if (!isAssignableTo(typeToCheck, litConfig.type.kind, checker)) {
      // Suggest what to use instead

      const acceptedTypeKindsList = getAcceptedTypeKinds();
      if (acceptedTypeKindsList.length >= 1) {
        const potentialKindText = joinArray(
          acceptedTypeKindsList.map(
            (kind) => `'${toLitPropertyTypeString(kind)}'`,
          ),
          ", ",
          "or",
        );

        context.report({
          location: rangeFromNode(node),
          message: `@property type should be ${potentialKindText} instead of '${toLitPropertyTypeString(litConfig.type.kind)}'`,
        });
      } else if (litConfig.type.kind !== "OBJECT") {
        // If no suggesting can be provided, report that they are not assignable
        // The OBJECT @property type is an escape from this error

        const configTypeString = simpleTypeToString(litConfig.type);
        const typeToCheckString = isSimpleType(typeToCheck)
          ? simpleTypeToString(typeToCheck)
          : typeToString(typeToCheck, checker);
        context.report({
          location: rangeFromNode(node),
          message: `@property type '${configTypeString}' is not assignable to the actual type '${typeToCheckString}'`,
        });
      }
    }
  }

  // If no type has been specified, suggest what to use as the @property type
  else if (litConfig.attribute !== false) {
    const acceptedTypeKindsList = getAcceptedTypeKinds();

    // Don't report errors because String conversion is default
    if (isAssignableTo(typeToCheck, SimpleTypeKind.STRING, checker)) {
      return;
    }

    // Suggest what to use instead if there are multiple accepted @property types for this property
    else if (acceptedTypeKindsList.length > 0) {
      // Suggest types to use and include "{attribute: false}" if the @property type is ARRAY or OBJECT
      const acceptedTypeText = joinArray(
        [
          ...acceptedTypeKindsList.map(
            (kind) => `'{type: ${toLitPropertyTypeString(kind)}}'`,
          ),
          ...(isAssignableTo(typeToCheck, SimpleTypeKind.ARRAY, checker) ||
          isAssignableTo(typeToCheck, SimpleTypeKind.OBJECT, checker)
            ? ["'{attribute: false}'"]
            : []),
        ],
        ", ",
        "or",
      );

      context.report({
        location: rangeFromNode(node),
        message: `Missing ${acceptedTypeText} on @property decorator for '${propName}'`,
      });
    } else {
      const typeToCheckString = isSimpleType(typeToCheck)
        ? simpleTypeToString(typeToCheck)
        : typeToString(typeToCheck, checker);
      context.report({
        location: rangeFromNode(node),
        message: `The built in converter doesn't handle the property type '${typeToCheckString}'.`,
        fixMessage: `Please add '{attribute: false}' on @property decorator for '${propName}'`,
      });
    }
  }

  // message: `You need to add '{attribute: false}' to @property decorator for '${propName}' because '${toTypeString(simplePropType)}' type is not a primitive`
}

export default rule;
