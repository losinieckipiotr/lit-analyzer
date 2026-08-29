import {
  isAssignableToSimpleTypeKind,
  SimpleType,
  SimpleTypeKind,
} from "../../../../web-component-analyzer/src/api.js";

export function removeUndefinedFromType(type: SimpleType): SimpleType {
  const { kind } = type;

  switch (kind) {
    case "ALIAS": {
      const { target } = type;
      return {
        ...type,
        target: removeUndefinedFromType(target),
      };
    }
    case "UNION": {
      const { types } = type;
      const filteredTypes = types.filter(
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
