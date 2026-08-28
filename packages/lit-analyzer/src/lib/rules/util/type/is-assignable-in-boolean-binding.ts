import { Type } from "typescript";
import {
  SimpleType,
  SimpleTypeKind,
  simpleTypeToString,
  toSimpleType,
} from "../../../../web-component-analyzer/src/api.js";
import { HtmlNodeAttr } from "../../../analyze/types/html-node/html-node-attr-types.js";
import { RuleModuleContext } from "../../../analyze/types/rule/rule-module-context.js";
import { rangeFromHtmlNodeAttr } from "../../../analyze/util/range-util.js";
import { isAssignableToType } from "./is-assignable-to-type.js";

export function isAssignableInBooleanBinding(
  htmlAttr: HtmlNodeAttr,
  { typeA, typeB }: { typeA: SimpleType | Type; typeB: SimpleType | Type },
  context: RuleModuleContext,
): boolean | undefined {
  const checker = context.program.getTypeChecker();
  const typeBSimple = toSimpleType(typeB, checker);
  const typeASimple = toSimpleType(typeA, checker);
  // Test if the user is trying to use ? modifier on a non-boolean type.
  if (
    !isAssignableToType(
      {
        typeA: {
          kind: SimpleTypeKind.UNION,
          types: [
            { kind: SimpleTypeKind.BOOLEAN },
            { kind: SimpleTypeKind.UNDEFINED },
            { kind: SimpleTypeKind.NULL },
          ],
        },
        typeB,
      },
      context,
    )
  ) {
    context.report({
      location: rangeFromHtmlNodeAttr(htmlAttr),
      message: `Type '${simpleTypeToString(typeBSimple)}' is not assignable to 'boolean'`,
    });

    return false;
  }

  // Test if the user is trying to use the ? modifier on a non-boolean type.
  if (
    !isAssignableToType(
      { typeA, typeB: { kind: SimpleTypeKind.BOOLEAN } },
      context,
    )
  ) {
    context.report({
      location: rangeFromHtmlNodeAttr(htmlAttr),
      message: `You are using a boolean binding on a non boolean type '${simpleTypeToString(typeASimple)}'`,
      fix: () => {
        const htmlAttrTarget = context.htmlStore.getHtmlAttrTarget(htmlAttr);
        const newModifier = htmlAttrTarget == null ? "." : "";

        return {
          message:
            newModifier.length === 0
              ? `Remove '${htmlAttr.modifier || ""}' modifier`
              : `Use '${newModifier}' modifier instead`,
          actions: [
            {
              kind: "changeAttributeModifier",
              htmlAttr,
              newModifier,
            },
          ],
        };
      },
    });

    return false;
  }

  return true;
}
