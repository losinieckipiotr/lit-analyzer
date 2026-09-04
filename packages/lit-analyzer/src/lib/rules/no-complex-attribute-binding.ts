import { Type, UnionType } from "typescript";
import {
  isMyUnionType,
  MyUnionType,
} from "../../web-component-analyzer/src/simple-type.js";
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
    // Only validate attribute bindings, because you are able to assign complex types in property bindings.
    const { htmlAttr } = assignment;
    if (htmlAttr.kind !== HtmlNodeAttrKind.ATTRIBUTE) {
      return;
    }

    // Ignore element expressions
    if (assignment.kind === HtmlNodeAttrAssignmentKind.ELEMENT_EXPRESSION)
      return;

    const { typeA, typeB } = extractBindingTypes(assignment, context);

    // Don't validate directives in this rule, because they are assignable even though they are complex types (functions).
    if (isLitDirective(typeB)) {
      return;
    }

    const checker = context.program.getTypeChecker();

    // lit atrribute types:
    // - string
    // - number
    // - boolean
    // - object (complex)
    // - array (complex)

    function isAssignableToPrimitiveAttributeType(type: Type) {
      return (
        checker.isTypeAssignableTo(type, checker.getStringType()) ||
        checker.isTypeAssignableTo(type, checker.getNumberType()) ||
        checker.isTypeAssignableTo(type, checker.getBooleanType())
      );
    }

    function isUnionPrimitive(type: UnionType | MyUnionType) {
      const isEveryTypePrimitive = type.types.every((t) =>
        isAssignableToPrimitiveAttributeType(t),
      );

      return isEveryTypePrimitive;
    }

    // Only primitive types should be allowed as "typeB"
    if (!isAssignableToPrimitiveAttributeType(typeB)) {
      if (
        isAssignableBindingUnderSecuritySystem(htmlAttr, typeB, context) !==
        undefined
      ) {
        // This is binding via a security sanitization system, let it do
        // this check. Apparently complex values are OK to assign here.
        return;
      }

      if (typeB && typeB.isUnion() && isUnionPrimitive(typeB)) {
        return;
      }

      // TODO: handle directives ?
      // const { ts } = context;
      // const signatures = checker.getSignaturesOfType(
      //   typeB,
      //   ts.SignatureKind.Call,
      // );
      // if (signatures.length > 0) {
      //   throw new Error("Binding a function is considered a complex type.");
      // }

      const typeBStr = checker.typeToString(typeB);
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

      // if (isMyUnionType(typeA)) {
      //     if (isUnionPrimitive(typeA)) {
      //       return;
      //     }
      //   }
    } else {
      // Only primitive types should be allowed as "typeA"
      if (isMyUnionType(typeA)) {
        // primitive unions are ok
        if (isUnionPrimitive(typeA)) {
          return;
        }
      } else if (!isAssignableToPrimitiveAttributeType(typeA)) {
        const typeBStr = checker.typeToString(typeB);
        const typeAStr = checker.typeToString(typeA);

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
    }
  },
};

export default rule;
