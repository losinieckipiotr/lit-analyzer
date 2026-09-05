import { HtmlNodeAttrKind } from "../analyze/types/html-node/html-node-attr-types.js";
import { RuleModule } from "../analyze/types/rule/rule-module.js";
import { rangeFromHtmlNodeAttr } from "../analyze/util/range-util.js";
import { extractBindingTypes } from "./util/type/extract-binding-types.js";

/**
 * This rule validates that only callable types are used within event binding expressions.
 * This rule catches typos like: @click="onClick()"
 */
const rule: RuleModule = {
  id: "no-noncallable-event-binding",
  meta: {
    priority: "high",
  },
  visitHtmlAssignment(assignment, context) {
    // Only validate event listener bindings.
    const { htmlAttr } = assignment;
    if (htmlAttr.kind !== HtmlNodeAttrKind.EVENT_LISTENER) return;

    const { typeB } = extractBindingTypes(assignment, context);
    const { ts } = context;
    const checker = context.program.getTypeChecker();

    /**
     * Returns if this type can be used in a event listener binding
     */
    function isTypeBindableToEventListener(): boolean {
      const isAny = (typeB.flags & ts.TypeFlags.Any) !== 0;

      if (isAny) {
        return true;
      }

      // // Return "true" if the type has a call signature
      // if ("call" in type && type.call != null) {
      //   return true;
      // }

      const hasSignatures =
        checker.getSignaturesOfType(typeB, ts.SignatureKind.Call).length > 0;

      if (hasSignatures) {
        return true;
      }

      // try object type
      const handleEventProperty = typeB.getProperty("handleEvent");

      if (handleEventProperty) {
        const type = checker.getTypeOfSymbol(handleEventProperty);

        const signatures = checker.getSignaturesOfType(
          type,
          ts.SignatureKind.Call,
        );

        if (signatures.length > 0) {
          return true;
        }
      }

      return false;
    }

    // Make sure that the expression given to the event listener binding a function or an object with "handleEvent" property.
    if (!isTypeBindableToEventListener()) {
      const checker = context.program.getTypeChecker();
      const typeBStr = checker.typeToString(typeB);

      context.report({
        location: rangeFromHtmlNodeAttr(htmlAttr),
        message: `You are setting up an event listener with a non-callable type '${typeBStr}'`,
      });
    }
  },
};

export default rule;
