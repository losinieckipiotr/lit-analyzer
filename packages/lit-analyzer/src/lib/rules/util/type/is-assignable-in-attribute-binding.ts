import { Type } from "typescript";
import {
  isBooleanStringUnion,
  isMyUnionType,
  MyUnionType,
} from "../../../analyze/my-union-type.js";
import { RuleModuleContext } from "../../../analyze/rule-collection.js";
import { HtmlNodeAttrAssignmentKind } from "../../../analyze/types/html-node/html-node-attr-assignment-types.js";
import { HtmlNodeAttr } from "../../../analyze/types/html-node/html-node-attr-types.js";
import {
  documentRangeToSFRange,
  rangeFromHtmlNodeAttr,
} from "../../../analyze/util/range-util.js";
import { isAssignableBindingUnderSecuritySystem } from "./is-assignable-binding-under-security-system.js";

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
      // FIXME: log and return undefined instead of throwing an error
      throw new Error("not implemented");
    }

    if (checker.isTypeAssignableTo(typeB, typeA)) {
      return true;
    }

    const typeBStr = checker.typeToString(typeB);
    const typeAStr = checker.typeToString(typeA);

    context.report({
      location: rangeFromHtmlNodeAttr(htmlAttr),
      message: `Type '${typeBStr}' is not assignable to '${typeAStr}'`,
    });

    return false;
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

    const types: Type[] = [];

    if (isMyUnionType(typeA)) {
      // special case for a union of exactly two types, one being 'true' and the
      // other being 'false'
      // we treat it as a boolean type for the purpose of attribute binding

      const { ts } = context;

      if (isBooleanStringUnion(typeA, ts, checker)) {
        types.push(checker.getBooleanType());
      } else {
        types.push(...typeA.types);
      }
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

    function tryEmptyStringToBoolean(t: Type, value: string): boolean {
      if (checker.isTypeAssignableTo(t, checker.getBooleanType())) {
        if (value === "") {
          return true;
        }
      }

      return false;
    }

    /** @returns true if the string value can be coerced to the number type, false otherwise */
    function tryStringToNumberCoersion(t: Type, value: string): boolean {
      if (checker.isTypeAssignableTo(t, checker.getNumberType())) {
        const coercedNumber = Number(value);

        if (!isNaN(coercedNumber)) {
          const coercedNumberType = checker.getNumberLiteralType(coercedNumber);

          if (checker.isTypeAssignableTo(coercedNumberType, t)) {
            return true;
          }
        }
      }

      return false;
    }

    function handleStringCoersion(types: Type[], value: string): boolean {
      for (const t of types) {
        if (tryStringToNumberCoersion(t, value)) {
          return true;
        }

        if (tryEmptyStringToBoolean(t, value)) {
          return true;
        }
      }

      return false;
    }

    function handleStringArrays(types: Type[], value: string): boolean {
      if (types.length < 2) {
        return false;
      }

      if (value === "") {
        return false;
      }

      if (!value.includes(" ")) {
        return false;
      }

      const values = value.split(" ");

      for (const val of values) {
        const literal = checker.getStringLiteralType(val);

        const isLiteralAssignable = types.some((t) =>
          checker.isTypeAssignableTo(literal, t),
        );

        if (!isLiteralAssignable) {
          return false;
        }
      }

      return true;
    }

    /** @returns true if the number value can be coerced to the string type, false otherwise */
    function handleNumberCoersion(t: Type): boolean {
      // if type is a string than we can always coerce a number to it
      return checker.isTypeAssignableTo(t, checker.getStringType());
    }

    // If the assignment kind is "STRING" we can report diagnostics directly on the value in the HTML
    if (typeB.isStringLiteral()) {
      const value = typeB.value;

      // try type coercion for string literals
      if (handleStringCoersion(unpackedTypes, value)) {
        return true;
      }

      if (handleStringArrays(unpackedTypes, value)) {
        return true;
      }

      if (assignment.kind === "STRING") {
        const typeAStr = unpackedTypes
          .map((t) => checker.typeToString(t))
          .join(" | ");

        const startOffset = assignment.location.start;
        // FIXME: not used
        const offset = 0;

        context.report({
          location: documentRangeToSFRange(assignment.htmlAttr.document, {
            start: startOffset + offset,
            end: startOffset + offset + value.length,
          }),
          message: `The value '${value}' is not assignable to '${typeAStr}'`,
        });

        return false;
      }
    } else if (typeB.isUnion()) {
      // handles assigning string literal unions  e.g "123" | "1234" to  number attribute
      if (typeB.types.every((t) => t.isStringLiteral())) {
        // try type coercion for string literals for each literal in the union
        const everyLiteralAssignable = typeB.types.every((literal) => {
          const value = literal.value;

          return handleStringCoersion(unpackedTypes, value);
        });

        if (everyLiteralAssignable) {
          return true;
        }
      }
    } else if (typeB.isNumberLiteral()) {
      // try type coercion for number literals

      // FIXME: this may be not true e.g  1 | 2 | 3 attribute with string literal "1"
      if (unpackedTypes.length === 1) {
        const t = unpackedTypes[0];

        if (handleNumberCoersion(t)) {
          return true;
        }
      }
    }

    // If the assignment kind as "EXPRESSION" report a single diagnostic on the attribute name
    if (assignment.kind === "EXPRESSION") {
      const typeAStr = unpackedTypes
        .map((t) => checker.typeToString(t))
        .join(" | ");

      const typeBStr = checker.typeToString(typeB);

      context.report({
        location: rangeFromHtmlNodeAttr(assignment.htmlAttr),
        message: `The value '${typeBStr}' is not assignable to '${typeAStr}'`,
      });

      return false;
    }
  }

  // FIXME: log and return undefined instead of throwing an error
  throw new Error("not implemented");
}
