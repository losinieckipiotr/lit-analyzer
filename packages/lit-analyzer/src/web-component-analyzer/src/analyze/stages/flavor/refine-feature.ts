import {
  AnalyzerDeclarationVisitContext,
  AnalyzerVisitContext,
  ComponentFeature,
  ComponentFeatureBase,
  FeatureVisitReturnTypeMap
} from "../../../../../lib/analyze/wca-types.js";

export type RefineFeatureEmitMap = {
  [K in ComponentFeature]: (result: FeatureVisitReturnTypeMap[K]) => void;
};

/**
 * Uses flavors to refine a feature
 * Flavors can also remove a feature
 * @param featureKind
 * @param value
 * @param context
 * @param emitMap
 */
export function refineFeature<
  FeatureKind extends ComponentFeature,
  ValueType extends ComponentFeatureBase =
    FeatureVisitReturnTypeMap[FeatureKind]
>(
  featureKind: FeatureKind,
  value: ValueType | ValueType[],
  context: AnalyzerVisitContext | AnalyzerDeclarationVisitContext,
  emitMap: Partial<RefineFeatureEmitMap>
): void {
  /*if (Array.isArray(value)) {
		value.forEach(v => refineComponentFeature(featureKind, v, context, emitMap));
		return;
	}*/

  let refinedValue: undefined | ComponentFeatureBase | ComponentFeatureBase[] =
    value;

  // Add "declaration" to the feature if necessary
  if ("getDeclaration" in context && refinedValue != null) {
    const decl = context.getDeclaration();

    if (Array.isArray(refinedValue)) {
      for (const val of refinedValue) {
        if (val.declaration == null) {
          val.declaration = decl;
        }
      }
    } else if (refinedValue.declaration == null) {
      refinedValue.declaration = decl;
    }
  }

  for (const flavor of context.flavors) {
    const refineFunc = flavor.refineFeature?.[featureKind];
    if (refineFunc != null) {
      if (refinedValue == null) {
        return;
      } else if (Array.isArray(refinedValue)) {
        const newValue: ValueType[] = [];
        for (const val of refinedValue) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const refined = refineFunc(val as any, context);
          if (refined != null) {
            newValue.push(
              ...((Array.isArray(refined)
                ? refined
                : [refined]) as unknown as ValueType[])
            );
          }
        }
        refinedValue = newValue.length === 0 ? undefined : newValue;
      } else {
        refinedValue = refineFunc(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          refinedValue as any,
          context
        ) as unknown as typeof refinedValue;
      }
    }
  }

  if (refinedValue != null) {
    (Array.isArray(refinedValue) ? refinedValue : [refinedValue]).forEach(v =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emitMap?.[featureKind]?.(v as any)
    );
  }
}
