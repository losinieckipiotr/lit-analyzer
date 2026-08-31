import { JSDocTag, Node } from "typescript";
import { AnalyzerVisitContext } from "../../analyzer-visit-context.js";
import type { JsDocTagParsed } from "../../types/js-doc.js";
import { getJsDoc } from "../../util/js-doc-util.js";

/**
 * Transforms jsdoc tags to a T array using a "transform".
 */
export function parseJsDocForNode<T>(
  node: Node,
  tagNames: string[],
  transform: (tagNode: JSDocTag, parsed: JsDocTagParsed) => T | undefined,
  context: AnalyzerVisitContext
): T[] | undefined {
  const { tags } = getJsDoc(node, context.ts, tagNames) || {};

  if (tags && tags.length > 0) {
    context.emitContinue?.();

    return tags
      .map(tag => {
        if (!tag.node) {
          throw new Error("node is undefined");
        }

        return transform(tag.node, tag.parsed());
      })
      .filter(t => t != null);
  }

  return undefined;
}
