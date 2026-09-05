import { LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER } from "../analyze/constants.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { extractBindingTypes } from "./util/type/extract-binding-types.js";
import { isAssignableInBooleanBinding } from "./util/type/is-assignable-in-boolean-binding.js";

const rule: RuleModule = {
  id: "no-invalid-boolean-binding",
  meta: {
    priority: "low",
  },
  visitHtmlAssignment(assignment, context) {
    const { htmlAttr } = assignment;

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
