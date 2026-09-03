import { Type } from "typescript";
import {
  isAnyType,
  isMyUnionType,
  isUnknownType,
  MyUnionType,
} from "../../web-component-analyzer/src/simple-type.js";
import { LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER } from "../analyze/constants.js";
import { HtmlNodeAttrAssignmentKind } from "../analyze/types/html-node/html-node-attr-assignment-types.js";
import { HtmlNodeAttrKind } from "../analyze/types/html-node/html-node-attr-types.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { rangeFromHtmlNodeAttr } from "../analyze/util/range-util.js";
import { extractBindingTypes } from "./util/type/extract-binding-types.js";

/**
 * This rule validates that you are not binding a boolean type in an attribute binding
 * This would result in binding the string 'true' or 'false' and a '?' binding should be used instead.
 */
const rule: RuleModule = {
  id: "no-boolean-in-attribute-binding",
  meta: {
    priority: "medium",
  },
  visitHtmlAssignment(assignment, context) {
    // Don't validate boolean attribute bindings.
    if (assignment.kind === HtmlNodeAttrAssignmentKind.BOOLEAN) {
      return;
    }

    // Only validate attribute bindings.
    const { htmlAttr } = assignment;
    if (htmlAttr.kind !== HtmlNodeAttrKind.ATTRIBUTE) {
      return;
    }

    const { typeA, typeB } = extractBindingTypes(assignment, context);

    // Return early if the attribute is like 'required=""' because this is assignable to boolean.
    if (typeB.isStringLiteral() && typeB.value.length === 0) {
      return;
    }

    const checker = context.program.getTypeChecker();

    function isBooleanStringUnion(type: Type | MyUnionType): boolean {
      if (isMyUnionType(type)) {
        const trueStrType = checker.getStringLiteralType("true");
        const falseStrType = checker.getStringLiteralType("false");

        return (
          type.types.length == 2 &&
          type.types.every(
            (t) =>
              checker.isTypeAssignableTo(t, trueStrType) ||
              checker.isTypeAssignableTo(t, falseStrType),
          )
        );
      }

      return false;
    }

    const isAny = isAnyType(typeB);
    const isUnknown = isUnknownType(typeB);
    const isBTypeBoolean = checker.isTypeAssignableTo(
      typeB,
      checker.getBooleanType(),
    );

    // assigned value is definitely boolean, now check attribute type
    if (!isAny && !isUnknown && isBTypeBoolean) {
      // Handle typeA as union of literal boolean values
      if (isMyUnionType(typeA)) {
        // attribute is a boolean string union - no report
        if (isBooleanStringUnion(typeA)) {
          return;
        }
      } else {
        // attribute is a boolean value - no report
        if (checker.isTypeAssignableTo(typeA, checker.getBooleanType())) {
          return;
        }
      }

      context.report({
        location: rangeFromHtmlNodeAttr(htmlAttr),
        message: `The value being assigned is a boolean type, but you are not using a boolean binding.`,
        fixMessage: "Change to boolean binding?",
        fix: () => {
          const newName = `${LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER}${htmlAttr.name}`;

          return {
            message: `Change to '${newName}'`,
            actions: [
              {
                kind: "changeAttributeName",
                htmlAttr,
                newName,
              },
            ],
          };
        },
      });
    }

    // Report a diagnostic if typeA is assignable to boolean type because then
    // we should probably be using a boolean binding instead of an attribute
    // binding.
    else {
      if (isMyUnionType(typeA)) {
        if (!isBooleanStringUnion(typeA)) {
          // not boolean union so rule does not apply, exit early
          return;
        }
      } else if (
        !isAnyType(typeA) &&
        !isUnknownType(typeA) &&
        checker.isTypeAssignableTo(typeA, checker.getBooleanType())
      ) {
        context.report({
          location: rangeFromHtmlNodeAttr(htmlAttr),
          message: `The '${htmlAttr.name}' attribute is of boolean type but you are not using a boolean binding.`,
          fixMessage: "Change to boolean binding?",
          fix: () => {
            const newName = `${LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER}${htmlAttr.name}`;

            return {
              message: `Change to '${newName}'`,
              actions: [
                {
                  kind: "changeAttributeName",
                  htmlAttr,
                  newName,
                },
              ],
            };
          },
        });
      }
    }
  },
};

export default rule;
