import { Expression, Type, TypeChecker } from "typescript";
import { MyUnionType } from "../../../analyze/my-union-type.js";
import { RuleModuleContext } from "../../../analyze/rule-collection.js";
import {
  HtmlNodeAttrAssignment,
  HtmlNodeAttrAssignmentKind,
} from "../../../analyze/types/html-node/html-node-attr-assignment-types.js";
import { HtmlNodeAttrKind } from "../../../analyze/types/html-node/html-node-attr-types.js";
import { getDirective } from "../directive/get-directive.js";

export function extractBindingTypes(
  assignment: HtmlNodeAttrAssignment,
  context: RuleModuleContext,
): {
  typeA: Type | MyUnionType;
  typeB: Type;
} {
  const checker = context.program.getTypeChecker();

  // Find a corresponding target for this attribute
  const htmlAttrTarget = context.htmlStore.getHtmlAttrTarget(
    assignment.htmlAttr,
  );

  let typeA: Type | MyUnionType | undefined = !htmlAttrTarget
    ? checker.getAnyType()
    : htmlAttrTarget.getType();

  if (!typeA) {
    typeA = htmlAttrTarget?.declaration?.type?.();
  }

  let typeB: Type | undefined;

  const directiveType = getDirective(assignment, context)?.actualType?.();

  if (directiveType) {
    typeB = directiveType;
  } else {
    typeB = inferTypeFromAssignment(assignment, checker);
  }

  return {
    typeA: typeA || checker.getAnyType(),
    typeB,
  };
}

export function inferTypeFromAssignment(
  assignment: HtmlNodeAttrAssignment,
  checker: TypeChecker,
): Type {
  switch (assignment.kind) {
    case HtmlNodeAttrAssignmentKind.STRING: {
      return checker.getStringLiteralType(assignment.value);
    }
    case HtmlNodeAttrAssignmentKind.BOOLEAN:
      return checker.getTrueType();
    case HtmlNodeAttrAssignmentKind.ELEMENT_EXPRESSION:
      return checker.getTypeAtLocation(assignment.expression);
    case HtmlNodeAttrAssignmentKind.EXPRESSION:
      return checker.getTypeAtLocation(assignment.expression);
    case HtmlNodeAttrAssignmentKind.MIXED:
      // Event bindings always looks at the first expression
      // Therefore, return the type of the first expression
      if (assignment.htmlAttr.kind === HtmlNodeAttrKind.EVENT_LISTENER) {
        const expression = assignment.values.find(
          (val): val is Expression => typeof val !== "string",
        );

        if (expression != null) {
          return checker.getTypeAtLocation(expression);
        }
      }

      return checker.getStringType();
  }
}
