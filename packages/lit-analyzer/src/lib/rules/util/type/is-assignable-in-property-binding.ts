import type { Type } from "typescript";
import {
  SimpleType,
  simpleTypeToString,
  toSimpleType,
} from "../../../../web-component-analyzer/src/api.js";
import { RuleModuleContext } from "../../../analyze/rule-collection.js";
import { HtmlNodeAttr } from "../../../analyze/types/html-node/html-node-attr-types.js";
import { rangeFromHtmlNodeAttr } from "../../../analyze/util/range-util.js";
import { isAssignableBindingUnderSecuritySystem } from "./is-assignable-binding-under-security-system.js";
import { isAssignableToType } from "./is-assignable-to-type.js";

export function isAssignableInPropertyBinding(
  htmlAttr: HtmlNodeAttr,
  { typeA, typeB }: { typeA: SimpleType | Type; typeB: SimpleType | Type },
  context: RuleModuleContext,
): boolean | undefined {
  const checker = context.program.getTypeChecker();
  const simpleTypeContext = { checker, ts: context.ts };

  // TODO: use native types
  const typeBSimple = toSimpleType(typeB, simpleTypeContext);
  const typeASimple = toSimpleType(typeA, simpleTypeContext);

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
