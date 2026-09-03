import { Type } from "typescript";
import {
  isMyUnionType,
  MyUnionType,
} from "../../../../web-component-analyzer/src/simple-type.js";
import { RuleModuleContext } from "../../../analyze/rule-collection.js";
import { HtmlNodeAttrAssignmentKind } from "../../../analyze/types/html-node/html-node-attr-assignment-types.js";
import { HtmlNodeAttr } from "../../../analyze/types/html-node/html-node-attr-types.js";
import { rangeFromHtmlNodeAttr } from "../../../analyze/util/range-util.js";
import { isAssignableBindingUnderSecuritySystem } from "./is-assignable-binding-under-security-system.js";
// import { isAssignableToType } from "./is-assignable-to-type.js";

export function isAssignableInAttributeBinding(
  htmlAttr: HtmlNodeAttr,
  { typeA, typeB }: { typeA: Type | MyUnionType; typeB: Type },
  context: RuleModuleContext,
): boolean | undefined {
  const { assignment } = htmlAttr;
  const checker = context.program.getTypeChecker();

  if (assignment == null) {
    return undefined;
  }

  if (assignment.kind === HtmlNodeAttrAssignmentKind.BOOLEAN) {
    if (isMyUnionType(typeA)) {
      throw new Error("not implemented");
    }

    if (!checker.isTypeAssignableTo(typeB, typeA)) {
      const typeBStr = checker.typeToString(typeB);
      const typeAStr = checker.typeToString(typeA);

      context.report({
        location: rangeFromHtmlNodeAttr(htmlAttr),
        message: `Type '${typeBStr}' is not assignable to '${typeAStr}'`,
      });

      return false;
    }
  } else {
    if (assignment.kind !== HtmlNodeAttrAssignmentKind.STRING) {
      // Purely static attributes are never security checked, they're handled
      // in the lit-html internals as trusted by default, because they can
      // not contain untrusted data, they were written by the developer.
      //
      // For everything else, we may need to apply a different type comparison
      // for some security-sensitive built in attributes and properties (like
      // <script src>).
      const securitySystemResult = isAssignableBindingUnderSecuritySystem(
        htmlAttr,
        typeB,
        context,
      );

      if (securitySystemResult !== undefined) {
        // The security diagnostics take precedence here,
        // and we should not do any more checking.
        return securitySystemResult;
      }
    }

    // function isBooleanStringUnion(type: UnionType): boolean {
    //   const trueStrType = checker.getTrueType();
    //   const falseStrType = checker.getFalseType();

    //   const validLength = type.types.length == 2;
    //   const allTypesValid = type.types.every(
    //     (t) =>
    //       checker.isTypeAssignableTo(t, trueStrType) ||
    //       checker.isTypeAssignableTo(t, falseStrType),
    //   );

    //   return validLength && allTypesValid;
    // }

    const types: Type[] = [];

    if (isMyUnionType(typeA)) {
      types.push(...typeA.types);
    } else {
      types.push(typeA);
    }

    const unpackedTypes: Type[] = [];

    for (const t of types) {
      if (t.isUnion()) {
        unpackedTypes.push(...t.types);
      } else {
        unpackedTypes.push(t);
      }
    }

    for (const t of unpackedTypes) {
      if (checker.isTypeAssignableTo(typeB, t)) {
        return true;
      }
    }
  }

  return true;
}

// /**
//  * Assignability check that simulates string coercion.
//  * This is used to type check attribute bindings.
//  */
// export function isAssignableToTypeWithStringCoercion(
//   typeA: Type,
//   typeB: Type,
//   simpleTypeContext: { checker: TypeChecker; ts: typeof tsMod },
// ): boolean {
//   if (isLitDirective(typeB)) {
//     return true;
//   }

//   const { checker, ts } = simpleTypeContext;

//   // Take into account that the empty string is is equal to true
//   if (typeB.isStringLiteral()) {
//     if (typeB.value.length === 0) {
//       return checker.isTypeAssignableTo(typeA, checker.getTrueType());
//     }

//     // Test if a potential string literal is a assignable to a number
//     // Example: max="123"
//     const numberValue = Number(typeB.value);
//     if (!isNaN(numberValue)) {
//       const numberLiteralType = checker.getNumberLiteralType(numberValue);
//       if (checker.isTypeAssignableTo(typeA, numberLiteralType)) {
//         return true;
//       }
//     }
//   }

//   // Test if a boolean coerced string is possible.
//   // Example: attribute "true" | "false" binding with boolean value in template
//   const isBoolean = (typeB.flags & ts.TypeFlags.Boolean) !== 0;
//   if (isBoolean) {
//     const trueStrType = checker.getStringLiteralType("true");
//     const falseStrType = checker.getStringLiteralType("false");

//     return (
//       checker.isTypeAssignableTo(typeA, trueStrType) ||
//       checker.isTypeAssignableTo(typeA, falseStrType)
//     );
//   }

//   /**
//    * Test if a boolean literal coerced to string is possible
//    * Example: aria-expanded="${this.open}"
//    */
//   const isBooleanLiteral = (typeB.flags & ts.TypeFlags.BooleanLiteral) !== 0;
//   if (isBooleanLiteral) {
//     return checker.isTypeAssignableTo(
//       typeA,
//       checker.getStringLiteralType(checker.typeToString(typeB)),
//     );
//   }

//   const isNumber = (typeB.flags & ts.TypeFlags.Number) !== 0;
//   if (isNumber) {
//     // Test if a number coerced to string is possible
//     // Example: value="${this.max}"
//     return checker.isTypeAssignableTo(typeA, checker.getStringType());
//   }

//   // Test if a number literal coerced to string is possible
//   // Example: value="${1}"
//   if (typeB.isNumberLiteral()) {
//     const numberLiteralType = checker.getStringLiteralType(String(typeB.value));

//     return checker.isTypeAssignableTo(typeA, numberLiteralType);
//   }

//   return false;
// }

// /**
//  * Certain attributes like "role" are string literals, but should be type checked
//  *   by comparing each item in the white-space-separated array against typeA
//  * @param assignment
//  * @param typeA
//  * @param typeB
//  * @param context
//  */
// export function isAssignableInPrimitiveArray(
//   assignment: HtmlNodeAttrAssignment,
//   { typeA, typeB }: { typeA: Type; typeB: Type },
//   context: RuleModuleContext,
// ): boolean {
//   // Only check "STRING" and "EXPRESSION" for now
//   if (
//     assignment.kind !== HtmlNodeAttrAssignmentKind.STRING &&
//     assignment.kind !== HtmlNodeAttrAssignmentKind.EXPRESSION
//   ) {
//     throw new Error("not implemented");
//   }

//   const checker = context.program.getTypeChecker();

//   if (!typeA.isUnion()) {
//     throw new Error("not implemented");
//   }

//   function isAssignableToPrimitiveAttributeType(type: Type) {
//     return (
//       checker.isTypeAssignableTo(type, checker.getStringType()) ||
//       checker.isTypeAssignableTo(type, checker.getNumberType()) ||
//       checker.isTypeAssignableTo(type, checker.getBooleanType())
//     );
//   }

//   function isPrimitiveUnionType(type: UnionType) {
//     return type.types.every(isAssignableToPrimitiveAttributeType);
//   }

//   const isAPrimitive = isPrimitiveUnionType(typeA);
//   const isBStringLiteral = typeB.isStringLiteral();

//   if (isAPrimitive && isBStringLiteral) {
//     // Split a value like: "button listitem" into ["button", " ", "listitem"]
//     const valuesAndWhitespace = typeB.value.split(/(\s+)/g);
//     const valuesNotAssignable: string[] = [];

//     const startOffset = assignment.location.start;
//     let offset = 0;

//     for (const value of valuesAndWhitespace) {
//       // Check all non-whitespace values
//       if (value.match(/\s+/) == null && value !== "") {
//         // Make sure that the the value is assignable to the union
//         const literalType = checker.getStringLiteralType(value);

//         if (
//           !isAssignableToTypeWithStringCoercion(typeA, literalType, {
//             checker,
//             ts: context.ts,
//           })
//         ) {
//           valuesNotAssignable.push(value);

//           // If the assignment kind is "STRING" we can report diagnostics directly on the value in the HTML
//           if (assignment.kind === "STRING") {
//             const typeASimpleStr = checker.typeToString(typeA);

//             context.report({
//               location: documentRangeToSFRange(assignment.htmlAttr.document, {
//                 start: startOffset + offset,
//                 end: startOffset + offset + value.length,
//               }),
//               message: `The value '${value}' is not assignable to '${typeASimpleStr}'`,
//             });
//           }
//         }
//       }

//       offset += value.length;
//     }

//     // If the assignment kind as "EXPRESSION" report a single diagnostic on the attribute name
//     if (assignment.kind === "EXPRESSION" && valuesNotAssignable.length > 0) {
//       const multiple = valuesNotAssignable.length > 1;
//       const typeASimpleStr = checker.typeToString(typeA);
//       context.report({
//         location: rangeFromHtmlNodeAttr(assignment.htmlAttr),
//         message: `The value${multiple ? "s" : ""} ${valuesNotAssignable.map((v) => `'${v}'`).join(", ")} ${
//           multiple ? "are" : "is"
//         } not assignable to '${typeASimpleStr}'`,
//       });
//     }

//     return valuesNotAssignable.length === 0;
//   }

//   throw new Error("not implemented");
// }
