import {
  isAssignableToPrimitiveType,
  simpleTypeToString,
  toSimpleType,
} from "../../web-component-analyzer/src/api.js";
import { HtmlNodeAttrAssignmentKind } from "../analyze/types/html-node/html-node-attr-assignment-types.js";
import { HtmlNodeAttrKind } from "../analyze/types/html-node/html-node-attr-types.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { rangeFromHtmlNodeAttr } from "../analyze/util/range-util.js";
import { isLitDirective } from "./util/directive/is-lit-directive.js";
import { extractBindingTypes } from "./util/type/extract-binding-types.js";
import { isAssignableBindingUnderSecuritySystem } from "./util/type/is-assignable-binding-under-security-system.js";

/**
 * This rule validates that complex types are not used within an expression in an attribute binding.
 */
const rule: RuleModule = {
  id: "no-complex-attribute-binding",
  meta: {
    priority: "medium",
  },
  visitHtmlAssignment(assignment, context) {
    const checker = context.program.getTypeChecker();

    // Only validate attribute bindings, because you are able to assign complex types in property bindings.
    const { htmlAttr } = assignment;
    if (htmlAttr.kind !== HtmlNodeAttrKind.ATTRIBUTE) return;

    // Ignore element expressions
    if (assignment.kind === HtmlNodeAttrAssignmentKind.ELEMENT_EXPRESSION)
      return;

    const { typeA, typeB } = extractBindingTypes(assignment, context);
    const typeASimple = toSimpleType(typeA, checker);
    const typeBSimple = toSimpleType(typeB, checker);

    // Don't validate directives in this rule, because they are assignable even though they are complex types (functions).
    if (isLitDirective(typeBSimple)) return;

    // Only primitive types should be allowed as "typeB"
    if (!isAssignableToPrimitiveType(typeBSimple)) {
      if (
        isAssignableBindingUnderSecuritySystem(
          htmlAttr,
          typeBSimple,
          context,
        ) !== undefined
      ) {
        // This is binding via a security sanitization system, let it do
        // this check. Apparently complex values are OK to assign here.
        return;
      }

      const typeBStr = simpleTypeToString(typeBSimple);
      const message = `You are binding a non-primitive type '${typeBStr}'. This could result in binding the string "[object Object]".`;
      const newModifier = ".";

      context.report({
        location: rangeFromHtmlNodeAttr(htmlAttr),
        message,
        fixMessage: `Use '${newModifier}' binding instead?`,
        fix: () => ({
          message: `Use '${newModifier}' modifier instead`,
          actions: [
            {
              kind: "changeAttributeModifier",
              htmlAttr,
              newModifier,
            },
          ],
        }),
      });
    }

    // Only primitive types should be allowed as "typeA"
    else if (!isAssignableToPrimitiveType(typeASimple)) {
      const typeBStr = simpleTypeToString(typeBSimple);
      const typeAStr = simpleTypeToString(typeASimple);
      const message = `You are assigning the primitive '${typeBStr}' to a non-primitive type '${typeAStr}'.`;
      const newModifier = ".";

      context.report({
        location: rangeFromHtmlNodeAttr(htmlAttr),
        message,
        fixMessage: `Use '${newModifier}' binding instead?`,
        fix: () => ({
          message: `Use '${newModifier}' modifier instead`,
          actions: [
            {
              kind: "changeAttributeModifier",
              htmlAttr,
              newModifier,
            },
          ],
        }),
      });
    }
  },
};

export default rule;
