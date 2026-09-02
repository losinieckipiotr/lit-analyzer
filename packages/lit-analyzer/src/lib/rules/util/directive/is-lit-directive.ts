import { Type } from "typescript";

/**
 * Checks whether a type is a lit-html 1.x or Lit 2 directive.
 */
export function isLitDirective(type: Type): boolean {
  // FIXME: not implemented
  // return isLit1Directive(type) || isLit2Directive(type);

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
