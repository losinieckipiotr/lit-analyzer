import { Node, Type } from "typescript";
import {
  isAssignableToSimpleTypeKind,
  isSimpleType,
  LitElementPropertyConfig,
  SimpleType,
  SimpleTypeKind,
  simpleTypeToString,
  toSimpleType,
  typeToString,
} from "../../web-component-analyzer/src/api.js";
import { RuleModuleContext } from "../analyze/rule-collection.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { joinArray } from "../analyze/util/array-util.js";
import { lazy } from "../analyze/util/general-util.js";
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
    )
      return;

    if (
      (member.meta.node?.type ?? member.node)?.getSourceFile() !== context.file
    )
      return;

    // Grab the type and fallback to "any"
    const type = member.type?.() || { kind: SimpleTypeKind.ANY };

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

function prepareSimpleAssignabilityTester(
  typeToCheck: SimpleType | Type,
  context: RuleModuleContext,
): {
  isAssignableTo: (kind: SimpleTypeKind) => boolean;
  acceptedTypeKinds: () => SimpleTypeKind[];
} {
  // Test assignments to all possible type kinds
  const _isAssignableToCache = new Map<SimpleTypeKind, boolean>();

  function isAssignableTo(configType: SimpleTypeKind): boolean {
    if (_isAssignableToCache.has(configType)) {
      return _isAssignableToCache.get(configType)!;
    }

    function getResult() {
      const checker = context.program.getTypeChecker();
      const typeToCheckSimple = toSimpleType(typeToCheck, checker);

      switch (configType) {
        case SimpleTypeKind.STRING: {
          const stringType = checker.getStringType();

          if (isSimpleType(typeToCheck)) {
            if (
              isAssignableToSimpleTypeKind(typeToCheck, [
                SimpleTypeKind.STRING,
                SimpleTypeKind.STRING_LITERAL,
              ])
            ) {
              return true;
            }
          } else {
            if (typeToCheck.isUnion()) {
              const result = checker.isTypeAssignableTo(
                typeToCheck,
                stringType,
              );

              return result;
            } else {
              return checker.isTypeAssignableTo(typeToCheck, stringType);
            }
          }

          return false;
        }
        case SimpleTypeKind.NUMBER:
          return isAssignableToSimpleTypeKind(typeToCheckSimple, [
            SimpleTypeKind.NUMBER,
            SimpleTypeKind.NUMBER_LITERAL,
          ]);

        case SimpleTypeKind.BOOLEAN:
          return isAssignableToSimpleTypeKind(typeToCheckSimple, [
            SimpleTypeKind.BOOLEAN,
            SimpleTypeKind.BOOLEAN_LITERAL,
          ]);
        case SimpleTypeKind.ARRAY:
          return isAssignableToSimpleTypeKind(typeToCheckSimple, [
            SimpleTypeKind.ARRAY,
            SimpleTypeKind.TUPLE,
          ]);
        case SimpleTypeKind.OBJECT:
          return isAssignableToSimpleTypeKind(typeToCheckSimple, [
            SimpleTypeKind.OBJECT,
            SimpleTypeKind.INTERFACE,
          ]);
        case SimpleTypeKind.ANY:
          return isAssignableToSimpleTypeKind(
            typeToCheckSimple,
            SimpleTypeKind.ANY,
          );
        default:
          return false;
      }
    }

    const result = getResult();

    _isAssignableToCache.set(configType, result);

    return result;
  }

  // Collect type kinds that can be used in as "type" in the @property decorator
  const acceptedTypeKinds = lazy(() => {
    return (
      [
        "STRING",
        "NUMBER",
        "BOOLEAN",
        "ARRAY",
        "OBJECT",
        "ANY",
      ] as SimpleTypeKind[]
    )
      .filter((kind) => kind !== "ANY")
      .filter((kind) => isAssignableTo(kind));
  });

  return { acceptedTypeKinds, isAssignableTo };
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
  const checker = context.program.getTypeChecker();
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

  const { acceptedTypeKinds, isAssignableTo } =
    prepareSimpleAssignabilityTester(typeToCheck, context);

  // Test the @property type against the actual type if a type has been provided
  if (litConfig.type != null) {
    // Report error if the @property type is not assignable to the actual type
    if (
      !isAssignableTo(litConfig.type.kind) &&
      !isAssignableTo(SimpleTypeKind.ANY)
    ) {
      // Suggest what to use instead
      if (acceptedTypeKinds().length >= 1) {
        const potentialKindText = joinArray(
          acceptedTypeKinds().map(
            (kind) => `'${toLitPropertyTypeString(kind)}'`,
          ),
          ", ",
          "or",
        );

        context.report({
          location: rangeFromNode(node),
          message: `@property type should be ${potentialKindText} instead of '${toLitPropertyTypeString(litConfig.type.kind)}'`,
        });
      }

      // If no suggesting can be provided, report that they are not assignable
      // The OBJECT @property type is an escape from this error
      else if (litConfig.type.kind !== "OBJECT") {
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
    // Don't do anything if there are multiple possibilities for a type.
    if (isAssignableTo(SimpleTypeKind.ANY)) {
      return;
    }

    // Don't report errors because String conversion is default
    else if (isAssignableTo(SimpleTypeKind.STRING)) {
      return;
    }

    // Suggest what to use instead if there are multiple accepted @property types for this property
    else if (acceptedTypeKinds().length > 0) {
      // Suggest types to use and include "{attribute: false}" if the @property type is ARRAY or OBJECT
      const acceptedTypeText = joinArray(
        [
          ...acceptedTypeKinds().map(
            (kind) => `'{type: ${toLitPropertyTypeString(kind)}}'`,
          ),
          ...(isAssignableTo(SimpleTypeKind.ARRAY) ||
          isAssignableTo(SimpleTypeKind.OBJECT)
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
