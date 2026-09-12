import * as tsMod from "typescript";
import { ObjectType, Type } from "typescript";

export function isLitDirective(
  type: Type,
  ts: typeof tsMod,
): type is ObjectType {
  const isObject = (type.flags & ts.TypeFlags.Object) !== 0;

  if (isObject) {
    const { name } = type.symbol;

    return name === "DirectiveResult";
  }

  return false;
}

/**
 * Checks whether a type is a Lit 2 directive.
 */
// function isLit2Directive(type: SimpleType): boolean {
//   switch (type.kind) {
//     case "INTERFACE": {
//       return type.name === "DirectiveResult";
//     }
//     case "GENERIC_ARGUMENTS": {
//       return isLit2Directive(type.target);
//     }
//     default:
//       return false;
//   }
// }
