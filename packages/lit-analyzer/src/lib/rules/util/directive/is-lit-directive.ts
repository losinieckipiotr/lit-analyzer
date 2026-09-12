import { Type } from "typescript";

export function isLitDirective(type: Type): boolean {
  if (type.isClassOrInterface()) {
    return type.symbol.name === "DirectiveResult";
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
