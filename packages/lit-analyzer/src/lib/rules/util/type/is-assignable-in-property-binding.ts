import type { Type } from "typescript";
import {
  SimpleType,
  simpleTypeToString,
  toSimpleType,
} from "../../../../web-component-analyzer/src/api.js";
import { HtmlNodeAttr } from "../../../analyze/types/html-node/html-node-attr-types.js";
import { RuleModuleContext } from "../../../analyze/types/rule/rule-module-context.js";
import { rangeFromHtmlNodeAttr } from "../../../analyze/util/range-util.js";
import { isAssignableBindingUnderSecuritySystem } from "./is-assignable-binding-under-security-system.js";
import { isAssignableToType } from "./is-assignable-to-type.js";

export function isAssignableInPropertyBinding(
  htmlAttr: HtmlNodeAttr,
  { typeA, typeB }: { typeA: SimpleType | Type; typeB: SimpleType | Type },
  context: RuleModuleContext,
): boolean | undefined {
  const checker = context.program.getTypeChecker();
  const typeBSimple = toSimpleType(typeB, checker);
  const typeASimple = toSimpleType(typeA, checker);
  const securitySystemResult = isAssignableBindingUnderSecuritySystem(
    htmlAttr,
    typeBSimple,
    context,
  );
  if (securitySystemResult !== undefined) {
    // The security diagnostics take precedence here,
    //   and we should not do any more checking.
    return securitySystemResult;
  }

  if (!isAssignableToType({ typeA, typeB }, context)) {
    context.report({
      location: rangeFromHtmlNodeAttr(htmlAttr),
      message: `Type '${simpleTypeToString(typeBSimple)}' is not assignable to '${simpleTypeToString(typeASimple)}'`,
    });

    return false;
  }

  return true;
}
