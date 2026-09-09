import { Node, Type, TypeChecker } from "typescript";
import { isMyUnionType, MyUnionType } from "../analyze/my-union-type.js";
import { RuleModuleContext } from "../analyze/rule-collection.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { joinArray } from "../analyze/util/array-util.js";
import { rangeFromNode } from "../analyze/util/range-util.js";
import { LitElementPropertyConfig } from "../analyze/wca/wca-types.js";

const rule: RuleModule = {
  id: "no-incompatible-property-type",
  meta: {
    priority: "low",
  },
  visitComponentMember(member, context) {
    const { kind, modifiers, meta, node: memberNode } = member;

    if (kind !== "property" || modifiers?.has("static") || !meta) {
      return;
    }

    if ((meta.node?.type ?? memberNode)?.getSourceFile() !== context.file) {
      return;
    }

    const checker = context.program.getTypeChecker();

    // Grab the type and fallback to "any"
    const type = member.type?.() || checker.getAnyType();

    const node =
      meta.node?.type || meta.node?.decorator?.expression || memberNode;

    const { propName } = member;

    return validateLitPropertyConfig(node, meta, propName, type, context);
  },
};

function isAssignableTo(
  typeToCheckOptional: Type | MyUnionType,
  configType: Type,
  checker: TypeChecker,
): boolean {
  if (isMyUnionType(typeToCheckOptional)) {
    const typesToCheck = typeToCheckOptional.types.map((t) =>
      checker.getNonNullableType(t),
    );

    return typesToCheck.every((t) => checker.isTypeAssignableTo(t, configType));
  }

  const typeToCheck = checker.getNonNullableType(typeToCheckOptional);

  return checker.isTypeAssignableTo(typeToCheck, configType);
}

/**
 * Runs through a lit configuration and validates against the "simplePropType".
 * Emits diagnostics through the context.
 */
function validateLitPropertyConfig(
  node: Node,
  litConfig: LitElementPropertyConfig,
  propName: string,
  typeToCheck: Type | MyUnionType,
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

  // Collect type kinds that can be used in as "type" in the @property decorator
  function getAcceptedTypeKinds(typeToCheck: Type) {
    const results: string[] = [];

    const stringType = checker.getStringType();
    const numberType = checker.getNumberType();
    const booleanType = checker.getBooleanType();
    const arrayTypeStr = "Any[]";
    const objectType = checker.getNonPrimitiveType();

    if (checker.isTypeAssignableTo(typeToCheck, stringType)) {
      results.push(checker.typeToString(stringType));
    }

    if (checker.isTypeAssignableTo(typeToCheck, numberType)) {
      results.push(checker.typeToString(numberType));
    }

    if (checker.isTypeAssignableTo(typeToCheck, booleanType)) {
      results.push(checker.typeToString(booleanType));
    }

    if (checker.isArrayLikeType(typeToCheck)) {
      results.push(arrayTypeStr);
    }

    if (checker.isTypeAssignableTo(typeToCheck, objectType)) {
      results.push(checker.typeToString(objectType));
    }

    return results;
  }

  function getAcceptedTypeKindsUnion(typeToCheck: MyUnionType) {
    // FIXME: path not tested in unit tests
    const acceptedTypeKindsList: string[] = [];

    const acceptedTypeKindsListForEachType = typeToCheck.types.map((t) =>
      getAcceptedTypeKinds(checker.getNonNullableType(t)),
    );

    const uniqueAcceptedTypeKinds = Array.from(
      new Set<string>(...acceptedTypeKindsListForEachType.flat()),
    );

    for (const acceptedType of uniqueAcceptedTypeKinds) {
      const isTypeAcceptedForEveryType = acceptedTypeKindsListForEachType.every(
        (list) => list.includes(acceptedType),
      );

      if (isTypeAcceptedForEveryType) {
        acceptedTypeKindsList.push(acceptedType);
      }
    }

    return acceptedTypeKindsList;
  }

  function unionTypeToString(type: MyUnionType) {
    return type.types.map((t) => checker.typeToString(t)).join(" | ");
  }

  const configType = litConfig.type;

  // Test the @property type against the actual type if a type has been provided
  if (configType) {
    // const configType = typeToLitPropertyType(litConfig.type, checker);

    if (isAssignableTo(typeToCheck, configType, checker)) {
      return;
    }

    // Suggest what to use instead
    const acceptedTypeKindsList = isMyUnionType(typeToCheck)
      ? getAcceptedTypeKindsUnion(typeToCheck)
      : getAcceptedTypeKinds(typeToCheck);

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

      // FIXME:
      // if (litConfig.type.kind === "OBJECT") {
      //   return;
      // }

      const configTypeString = checker.typeToString(configType);
      const typeToCheckString = isMyUnionType(typeToCheck)
        ? unionTypeToString(typeToCheck)
        : checker.typeToString(typeToCheck);

      message = `@property type '${configTypeString}' is not assignable to the actual type '${typeToCheckString}'`;
    }

    return context.report({
      location,
      message,
    });
  }

  // continue validation if the attribute is not disabled
  if (litConfig.attribute !== false) {
    const acceptedTypeKindsList = isMyUnionType(typeToCheck)
      ? getAcceptedTypeKindsUnion(typeToCheck)
      : getAcceptedTypeKinds(typeToCheck);

    // Don't report errors because String conversion is default
    if (isAssignableTo(typeToCheck, checker.getStringType(), checker)) {
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

      const isAssignableToArray = isMyUnionType(typeToCheck)
        ? typeToCheck.types.every((t) => checker.isArrayLikeType(t))
        : checker.isArrayLikeType(typeToCheck);

      const nonPrimitiveType = checker.getNonPrimitiveType();

      const isAssignableToObject = isMyUnionType(typeToCheck)
        ? typeToCheck.types.every((t) =>
            checker.isTypeAssignableTo(t, nonPrimitiveType),
          )
        : checker.isTypeAssignableTo(typeToCheck, nonPrimitiveType);

      if (isAssignableToArray || isAssignableToObject) {
        textToJoin.push("'{attribute: false}'");
      }

      const acceptedTypeText = joinArray(textToJoin, ", ", "or");

      message = `Missing ${acceptedTypeText} on @property decorator for '${propName}'`;
    } else {
      const typeToCheckString = isMyUnionType(typeToCheck)
        ? unionTypeToString(typeToCheck)
        : checker.typeToString(typeToCheck);

      message = `The built in converter doesn't handle the property type '${typeToCheckString}'.`;
      fixMessage = `Please add '{attribute: false}' on @property decorator for '${propName}'`;
    }

    context.report({
      location,
      message: message,
      fixMessage: fixMessage,
    });
  }
}

export default rule;
