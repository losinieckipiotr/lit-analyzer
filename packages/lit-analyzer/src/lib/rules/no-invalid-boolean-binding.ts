import { LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER } from "../analyze/constants.js";
import { HtmlNodeAttrAssignmentKind } from "../analyze/types/html-node/html-node-attr-assignment-types.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { extractBindingTypes } from "./util/type/extract-binding-types.js";
import { isAssignableInBooleanBinding } from "./util/type/is-assignable-in-boolean-binding.js";

const rule: RuleModule = {
  id: "no-invalid-boolean-binding",
  meta: {
    priority: "low",
  },
  visitHtmlAssignment(assignment, context) {
    // based on `src/lib/rules/no-incompatible-type-binding.ts`
    const { htmlAttr } = assignment;

    // TODO: what is ELEMENT_EXPRESSION ?
    if (assignment.kind === HtmlNodeAttrAssignmentKind.ELEMENT_EXPRESSION) {
      throw new Error("not implemented");
      // For element bindings we only care about the expression type
      // const { typeB } = extractBindingTypes(assignment, context);
      // isAssignableInElementBinding(htmlAttr, typeB, context);
    }

    if (context.htmlStore.getHtmlAttrTarget(htmlAttr) == null) {
      return;
    }

    const { typeA, typeB } = extractBindingTypes(assignment, context);

    // we care only about boolean attribute bindings for this rule?
    if (htmlAttr.modifier === LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER) {
      isAssignableInBooleanBinding(htmlAttr, { typeA, typeB }, context);
    }
  },
};

export default rule;
