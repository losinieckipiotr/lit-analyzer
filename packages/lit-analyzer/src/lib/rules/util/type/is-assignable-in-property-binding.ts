import type { Type } from "typescript";
import { isMyUnionType, MyUnionType } from "../../../analyze/my-union-type.js";
import { RuleModuleContext } from "../../../analyze/rule-collection.js";
import { HtmlNodeAttr } from "../../../analyze/types/html-node/html-node-attr-types.js";
import { rangeFromHtmlNodeAttr } from "../../../analyze/util/range-util.js";
import { isAssignableBindingUnderSecuritySystem } from "./is-assignable-binding-under-security-system.js";

export function isAssignableInPropertyBinding(
  htmlAttr: HtmlNodeAttr,
  { typeA, typeB }: { typeA: Type | MyUnionType; typeB: Type },
  context: RuleModuleContext,
): boolean | undefined {
  const checker = context.program.getTypeChecker();

  const securitySystemResult = isAssignableBindingUnderSecuritySystem(
    htmlAttr,
    typeB,
    context,
  );
  if (securitySystemResult !== undefined) {
    // The security diagnostics take precedence here,
    //   and we should not do any more checking.
    return securitySystemResult;
  }

  if (isMyUnionType(typeA)) {
    const typeAStr = typeA.types
      .map((t) => checker.typeToString(t))
      .join(" | ");

    // FIXME: log and return undefined instead of throwing an error
    throw new Error(
      `isAssignableInPropertyBinding: typeA is a MyUnionType: "${typeAStr}"`,
    );
  }

  const isAssignable = checker.isTypeAssignableTo(typeB, typeA);

  if (!isAssignable) {
    const typeAStr = checker.typeToString(typeA);
    const typeBStr = checker.typeToString(typeB);

    context.report({
      location: rangeFromHtmlNodeAttr(htmlAttr),
      message: `Type '${typeBStr}' is not assignable to '${typeAStr}'`,
    });

    return false;
  }

  return true;
}
