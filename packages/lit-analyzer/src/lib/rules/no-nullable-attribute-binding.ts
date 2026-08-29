import {
  isAssignableToSimpleTypeKind,
  SimpleTypeKind,
  simpleTypeToString,
} from "../../web-component-analyzer/src/api.js";
import { HtmlNodeAttrAssignmentKind } from "../analyze/types/html-node/html-node-attr-assignment-types.js";
import { HtmlNodeAttrKind } from "../analyze/types/html-node/html-node-attr-types.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { rangeFromHtmlNodeAttr } from "../analyze/util/range-util.js";
import { extractBindingTypes } from "./util/type/extract-binding-types.js";

/**
 * This rule validates that "null" and "undefined" types are not bound in an attribute binding.
 */
const rule: RuleModule = {
  id: "no-nullable-attribute-binding",
  meta: {
    priority: "high",
  },
  visitHtmlAssignment(assignment, context) {
    const checker = context.program.getTypeChecker();
    // Only validate "expression" kind bindings.
    if (assignment.kind !== HtmlNodeAttrAssignmentKind.EXPRESSION) return;

    // Only validate "attribute" bindings because these will coerce null|undefined to a string.
    const { htmlAttr } = assignment;
    if (htmlAttr.kind !== HtmlNodeAttrKind.ATTRIBUTE) return;

    const { typeB, typeBSimple } = extractBindingTypes(assignment, context);

    let isAssignableToNull: boolean;
    let isAssignableToUndefined: boolean;

    if (typeB) {
      const typeBArr = [typeB].flat();

      isAssignableToNull = typeBArr.every((t) =>
        checker.isTypeAssignableTo(checker.getNullType(), t),
      );

      isAssignableToUndefined = typeBArr.every((t) =>
        checker.isTypeAssignableTo(checker.getUndefinedType(), t),
      );
    } else {
      if (typeBSimple.kind === SimpleTypeKind.UNION) {
        throw new Error("not implemented");
      }
      isAssignableToNull = isAssignableToSimpleTypeKind(
        typeBSimple,
        SimpleTypeKind.NULL,
      );
      isAssignableToUndefined = isAssignableToSimpleTypeKind(
        typeBSimple,
        SimpleTypeKind.UNDEFINED,
      );
    }

    // Test if removing "undefined" or "null" from typeB would work and suggest using "ifDefined".
    if (isAssignableToNull || isAssignableToUndefined) {
      context.report({
        location: rangeFromHtmlNodeAttr(htmlAttr),
        message: `This attribute binds the type '${simpleTypeToString(typeBSimple)}' which can end up binding the string '${
          isAssignableToNull ? "null" : "undefined"
        }'.`,
        fixMessage: "Use the 'ifDefined' directive?",
        fix: () => ({
          message: `Use the 'ifDefined' directive.`,
          actions: [
            {
              kind: "changeAssignment",
              assignment,
              newValue: `ifDefined(${assignment.expression.getText()})`,
            },
          ],
        }),
      });
    }
  },
};
export default rule;
