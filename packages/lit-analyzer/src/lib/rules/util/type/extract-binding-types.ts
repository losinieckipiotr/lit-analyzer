import { Expression, Type, TypeChecker } from "typescript";
import {
  SimpleType,
  // SimpleTypeBooleanLiteral,
  SimpleTypeEnumMember,
  SimpleTypeKind,
} from "../../../../web-component-analyzer/src/api.js";
import {
  HtmlNodeAttrAssignment,
  HtmlNodeAttrAssignmentKind,
} from "../../../analyze/types/html-node/html-node-attr-assignment-types.js";
import { HtmlNodeAttrKind } from "../../../analyze/types/html-node/html-node-attr-types.js";
import { RuleModuleContext } from "../../../analyze/types/rule/rule-module-context.js";
import { getDirective } from "../directive/get-directive.js";

// TODO: disable cache for now
// const cache = new WeakMap<
//   HtmlNodeAttrAssignment,
//   { typeA: SimpleType; typeB: SimpleType }
// >();

export function extractBindingTypes(
  assignment: HtmlNodeAttrAssignment,
  context: RuleModuleContext,
): { typeA: SimpleType | Type; typeB: SimpleType | Type } {
  // if (cache.has(assignment)) {
  //   return cache.get(assignment)!;
  // }

  const checker = context.program.getTypeChecker();
  let typeB: Type | SimpleType = inferTypeFromAssignment(assignment, checker);

  // Find a corresponding target for this attribute
  const htmlAttrTarget = context.htmlStore.getHtmlAttrTarget(
    assignment.htmlAttr,
  );

  const typeA =
    htmlAttrTarget == null
      ? ({ kind: SimpleTypeKind.ANY } as SimpleType)
      : htmlAttrTarget.getType();

  // Handle directives
  const directive = getDirective(assignment, context);
  const directiveType = directive?.actualType?.();
  if (directiveType) {
    typeB = directiveType;
  }

  // Cache the result
  // const result = { typeA, typeB };
  // cache.set(assignment, result);

  return { typeA, typeB };
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

/**
 * Relax the type so that for example "string literal" become "string" and "function" become "any"
 * This is used for javascript files to provide type checking with Typescript type inferring
 * @param type
 */
export function relaxType(type: SimpleType): SimpleType {
  switch (type.kind) {
    case "INTERSECTION":
    case "UNION":
      return {
        ...type,
        types: type.types.map((t) => relaxType(t)),
      };

    case "ENUM":
      return {
        ...type,
        types: type.types.map((t) => relaxType(t) as SimpleTypeEnumMember),
      };

    case "ARRAY":
      return {
        ...type,
        type: relaxType(type.type),
      };

    case "PROMISE":
      return {
        ...type,
        type: relaxType(type.type),
      };

    case "INTERFACE":
    case "OBJECT":
    case "FUNCTION":
    case "CLASS":
      return {
        kind: SimpleTypeKind.ANY,
      };

    case "NUMBER_LITERAL":
      return { kind: SimpleTypeKind.NUMBER };
    case "STRING_LITERAL":
      return { kind: SimpleTypeKind.STRING };
    case "BOOLEAN_LITERAL":
      return { kind: SimpleTypeKind.BOOLEAN };
    case "BIG_INT_LITERAL":
      return { kind: SimpleTypeKind.BIG_INT };

    case "ENUM_MEMBER":
      return {
        ...type,
        type: relaxType(type.type),
      } as SimpleTypeEnumMember;

    case "ALIAS":
      return {
        ...type,
        target: relaxType(type.target),
      };

    default:
      return type;
  }
}
