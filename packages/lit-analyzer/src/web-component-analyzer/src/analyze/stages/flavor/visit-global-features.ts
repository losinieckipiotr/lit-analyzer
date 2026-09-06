import { Node } from "typescript";
import { AnalyzerVisitContext } from "../../../../../lib/analyze/wca-types.js";
import { arrayDefined } from "../../../util/array-util.js";
import {
  VisitFeatureEmitMap,
  visitFeaturesWithVisitMaps
} from "./visit-features.js";

/**
 * Uses flavors to find global features
 * @param node
 * @param context
 * @param emitMap
 */
export function visitGlobalFeatures<ReturnType>(
  node: Node,
  context: AnalyzerVisitContext,
  emitMap: Partial<VisitFeatureEmitMap>
): void {
  const visitMaps = arrayDefined(
    context.flavors.map(flavor => flavor.discoverGlobalFeatures)
  );

  visitFeaturesWithVisitMaps(node, context, visitMaps, emitMap);
}
