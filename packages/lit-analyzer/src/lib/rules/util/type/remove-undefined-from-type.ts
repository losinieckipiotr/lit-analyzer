import {
  isAssignableToSimpleTypeKind,
  SimpleType,
  SimpleTypeKind,
} from "../../../../web-component-analyzer/src/api.js";

export function removeUndefinedFromType(type: SimpleType): SimpleType {
  switch (type.kind) {
    case "ALIAS":
      return {
        ...type,
        target: removeUndefinedFromType(type.target),
      };
    case "UNION": {
      const filteredTypes = type.types.filter(
        (t) => !isAssignableToSimpleTypeKind(t, SimpleTypeKind.UNDEFINED),
      );

      if (filteredTypes.length === 1) {
        return filteredTypes[0];
      }

      return {
        ...type,
        types: filteredTypes,
      };
    }
    default:
      return type;
  }
}
