import { Type, TypeChecker } from "typescript";
import {
  isMyUnionType,
  MyUnionType,
} from "../../../../../web-component-analyzer/src/api.js";
import { LitAnalyzerContext } from "../../../default-lit-analyzer-context.js";
import { HtmlNodeAttrAssignmentKind } from "../../../types/html-node/html-node-attr-assignment-types.js";
import {
  HtmlNodeAttr,
  HtmlNodeAttrKind,
} from "../../../types/html-node/html-node-attr-types.js";
import { LitCompletion } from "../../../types/lit-completion.js";
import { DocumentPositionContext } from "../../../util/get-position-context-in-document.js";

export function completionsForHtmlAttrValues(
  htmlNodeAttr: HtmlNodeAttr,
  location: DocumentPositionContext,
  context: LitAnalyzerContext,
): LitCompletion[] {
  const { htmlStore } = context;

  // There is not point in showing completions for event listener bindings
  if (htmlNodeAttr.kind === HtmlNodeAttrKind.EVENT_LISTENER) return [];

  // Don't show completions inside assignments with expressions
  if (
    htmlNodeAttr.assignment &&
    htmlNodeAttr.assignment.kind === HtmlNodeAttrAssignmentKind.EXPRESSION
  )
    return [];

  const htmlTagMember = htmlStore.getHtmlAttrTarget(htmlNodeAttr);
  if (htmlTagMember == null) return [];

  // Special case for handling slot attr as we need to look at its parent
  if (htmlNodeAttr.name === "slot") {
    const parentHtmlTag =
      htmlNodeAttr.htmlNode.parent &&
      htmlStore.getHtmlTag(htmlNodeAttr.htmlNode.parent);
    if (parentHtmlTag != null && parentHtmlTag.slots.length > 0) {
      return parentHtmlTag.slots.map(
        (slot) =>
          ({
            name: slot.name || " ",
            insert: slot.name || "",
            documentation: () => slot.description,
            kind: "enumElement",
          }) as LitCompletion,
      );
    }
  }

  // return [];

  const checker = context.program.getTypeChecker();
  const type = htmlTagMember.getType();

  const options = getOptionsFromType(type, checker);

  return options.map(
    (option) =>
      ({
        name: option,
        insert: option,
        kind: "enumElement",
      }) as LitCompletion,
  );
}

function getOptionsFromType(
  type: Type | MyUnionType,
  checker: TypeChecker,
): string[] {
  if (isMyUnionType(type)) {
    return type.types
      .filter((t) => t.isLiteral())
      .map((t) => checker.typeToString(t));
  }

  return [];
}
