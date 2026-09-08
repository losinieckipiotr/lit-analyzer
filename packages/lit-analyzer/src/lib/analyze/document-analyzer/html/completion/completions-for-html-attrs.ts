import { Type } from "typescript";
import {
  LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER,
  LIT_HTML_EVENT_LISTENER_ATTRIBUTE_MODIFIER,
  LIT_HTML_PROP_ATTRIBUTE_MODIFIER,
} from "../../../constants.js";
import { LitAnalyzerContext } from "../../../default-lit-analyzer-context.js";
import { isMyUnionType, MyUnionType } from "../../../my-union-type.js";
import {
  documentationForTarget,
  HtmlAttrTarget,
  isHtmlAttr,
  isHtmlEvent,
  isHtmlProp,
} from "../../../parse/parse-html-data/html-tag.js";
import { HtmlNode } from "../../../types/html-node/html-node-types.js";
import { LitCompletion } from "../../../types/lit-completion.js";
import { DocumentPositionContext } from "../../../util/get-position-context-in-document.js";
import { iterableFilter, iterableMap } from "../../../util/iterable-util.js";

export function completionsForHtmlAttrs(
  htmlNode: HtmlNode,
  location: DocumentPositionContext,
  { htmlStore, ts, program }: LitAnalyzerContext,
): LitCompletion[] {
  const onTagName = htmlNode.tagName;
  const checker = program.getTypeChecker();

  function isAssignableToBoolean(
    type: Type | MyUnionType,
    { matchAny } = { matchAny: true },
  ): boolean {
    if (isMyUnionType(type)) {
      return false;
    }

    if (matchAny === false && type.flags & ts.TypeFlags.Any) {
      return false;
    }

    return checker.isTypeAssignableTo(type, checker.getBooleanType());
  }

  function targetToCompletion(
    target: HtmlAttrTarget,
    {
      modifier,
      insertModifier,
      onTagName,
    }: { modifier?: string; insertModifier?: boolean; onTagName?: string },
  ): LitCompletion {
    if (modifier == null) {
      if (isHtmlAttr(target)) {
        const type = target.getType();

        if (isAssignableToBoolean(type, { matchAny: false })) {
          modifier = LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER;
        } else {
          modifier = "";
        }
      } else if (isHtmlProp(target)) {
        modifier = LIT_HTML_PROP_ATTRIBUTE_MODIFIER;
      } else if (isHtmlEvent(target)) {
        modifier = LIT_HTML_EVENT_LISTENER_ATTRIBUTE_MODIFIER;
      }
    }

    const isMember = onTagName && target.fromTagName === onTagName;
    const isBuiltIn = target.builtIn;

    return {
      name: `${modifier || ""}${target.name}${"required" in target && target.required ? "!" : ""}`,
      insert: `${insertModifier ? modifier : ""}${target.name}`,
      kind: isBuiltIn ? "enumElement" : isMember ? "member" : "label",
      importance: isBuiltIn ? "low" : isMember ? "high" : "medium",
      documentation: () =>
        documentationForTarget(target, ts, checker, { modifier }),
    };
  }

  // Code completions for ".[...]";
  if (location.word.startsWith(LIT_HTML_PROP_ATTRIBUTE_MODIFIER)) {
    const alreadyUsedPropNames = htmlNode.attributes
      .filter((a) => a.modifier === LIT_HTML_PROP_ATTRIBUTE_MODIFIER)
      .map((a) => a.name);
    const unusedProps = iterableFilter(
      htmlStore.getAllPropertiesForTag(htmlNode),
      (prop) => !alreadyUsedPropNames.includes(prop.name),
    );

    return Array.from(
      iterableMap(unusedProps, (prop) =>
        targetToCompletion(prop, {
          modifier: LIT_HTML_PROP_ATTRIBUTE_MODIFIER,
          onTagName,
        }),
      ),
    );
  }

  // Code completions for "?[...]";
  else if (location.word.startsWith(LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER)) {
    const alreadyUsedAttrNames = htmlNode.attributes
      .filter(
        (a) =>
          a.modifier === LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER ||
          a.modifier == null,
      )
      .map((a) => a.name);
    const unusedAttrs = iterableFilter(
      htmlStore.getAllAttributesForTag(htmlNode),
      (prop) => !alreadyUsedAttrNames.includes(prop.name),
    );
    const booleanAttributes = iterableFilter(unusedAttrs, (prop) => {
      const type = prop.getType();

      return isAssignableToBoolean(type);
    });
    return Array.from(
      iterableMap(booleanAttributes, (attr) =>
        targetToCompletion(attr, {
          modifier: LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER,
          onTagName,
        }),
      ),
    );
  }

  // Code completions for "@[...]";
  else if (
    location.word.startsWith(LIT_HTML_EVENT_LISTENER_ATTRIBUTE_MODIFIER)
  ) {
    const alreadyUsedEventNames = htmlNode.attributes
      .filter((a) => a.modifier === LIT_HTML_EVENT_LISTENER_ATTRIBUTE_MODIFIER)
      .map((a) => a.name);
    const unusedEvents = iterableFilter(
      htmlStore.getAllEventsForTag(htmlNode),
      (prop) => !alreadyUsedEventNames.includes(prop.name),
    );
    return Array.from(
      iterableMap(unusedEvents, (prop) =>
        targetToCompletion(prop, {
          modifier: LIT_HTML_EVENT_LISTENER_ATTRIBUTE_MODIFIER,
          onTagName,
        }),
      ),
    );
  }

  const alreadyUsedAttrNames = htmlNode.attributes
    .filter((a) => a.modifier == null)
    .map((a) => a.name);
  const unusedAttrs = iterableFilter(
    htmlStore.getAllAttributesForTag(htmlNode),
    (prop) => !alreadyUsedAttrNames.includes(prop.name),
  );
  return Array.from(
    iterableMap(unusedAttrs, (prop) =>
      targetToCompletion(prop, { modifier: "", onTagName }),
    ),
  );
}
