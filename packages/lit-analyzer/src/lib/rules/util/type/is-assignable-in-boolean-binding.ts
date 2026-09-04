import { Type } from "typescript";
import {
  isMyUnionType,
  MyUnionType,
} from "../../../../web-component-analyzer/src/simple-type.js";
import { RuleModuleContext } from "../../../analyze/rule-collection.js";
import { HtmlNodeAttr } from "../../../analyze/types/html-node/html-node-attr-types.js";
import { rangeFromHtmlNodeAttr } from "../../../analyze/util/range-util.js";

export function isAssignableInBooleanBinding(
  htmlAttr: HtmlNodeAttr,
  { typeA, typeB }: { typeA: Type | MyUnionType; typeB: Type },
  context: RuleModuleContext,
): boolean | undefined {
  const checker = context.program.getTypeChecker();

  const isAssignableToBoolean = checker.isTypeAssignableTo(
    typeB,
    checker.getBooleanType(),
  );
  const isAssignableToUndefined = checker.isTypeAssignableTo(
    typeB,
    checker.getUndefinedType(),
  );
  const isAssignableToNull = checker.isTypeAssignableTo(
    typeB,
    checker.getNullType(),
  );

  const isNonBoolean = !(
    isAssignableToBoolean ||
    isAssignableToUndefined ||
    isAssignableToNull
  );

  const typeBStr = checker.typeToString(typeB);

  if (isNonBoolean) {
    context.report({
      location: rangeFromHtmlNodeAttr(htmlAttr),
      message: `Type '${typeBStr}' is not assignable to 'boolean'`,
    });

    return false;
  }

  // Test if the user is trying to use the `?` modifier on a non-boolean type.

  if (isMyUnionType(typeA)) {
    const typeAStr = typeA.types
      .map((t) => checker.typeToString(t))
      .join(" | ");

    context.report({
      location: rangeFromHtmlNodeAttr(htmlAttr),
      message: `You are using a boolean binding on a non boolean type '${typeAStr}'`,
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

  if (!checker.isTypeAssignableTo(typeA, checker.getBooleanType())) {
    const typeAStr = checker.typeToString(typeA);

    context.report({
      location: rangeFromHtmlNodeAttr(htmlAttr),
      message: `You are using a boolean binding on a non boolean type '${typeAStr}'`,
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
