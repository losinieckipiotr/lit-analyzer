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
    case "UNION":
      return {
        ...type,
        types: type.types.filter(
          (t) => !isAssignableToSimpleTypeKind(t, SimpleTypeKind.UNDEFINED),
        ),
      };
  }

  return type;
}
