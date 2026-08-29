import {
  SimpleType,
  simpleTypeToString,
} from "../../../../web-component-analyzer/src/api.js";
import { RuleModuleContext } from "../../../analyze/rule-collection.js";
import { HtmlNodeAttr } from "../../../analyze/types/html-node/html-node-attr-types.js";
import { rangeFromHtmlNodeAttr } from "../../../analyze/util/range-util.js";
import {
  isLit1Directive,
  isLit2Directive,
} from "../directive/is-lit-directive.js";

/**
 * Checks that the type represents a Lit 2 directive, which is the only valid
 * value for element expressions.
 */
export function isAssignableInElementBinding(
  htmlAttr: HtmlNodeAttr,
  type: SimpleType,
  context: RuleModuleContext,
): boolean | undefined {
  // TODO: now we have lit 3
  if (!isLit2Directive(type) && type.kind !== "ANY") {
    if (isLit1Directive(type)) {
      context.report({
        location: rangeFromHtmlNodeAttr(htmlAttr),
        message: `Type '${simpleTypeToString(type)}' is a lit-html 1.0 directive, not a Lit 2 directive'`,
      });
    } else {
      context.report({
        location: rangeFromHtmlNodeAttr(htmlAttr),
        message: `Type '${simpleTypeToString(type)}' is not a Lit 2 directive'`,
      });
    }
    return false;
  }

  return true;
}
