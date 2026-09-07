import { Node, SourceFile, TypeChecker } from "typescript";
import {
  getNodeName,
  getSymbol,
  resolveDeclarations,
  resolveSymbolDeclarations,
} from "../ast-util.js";
import { arrayDefined } from "../util/array-util.js";
import { getJsDoc } from "./js-doc-util.js";
import {
  AnalyzerDeclarationVisitContext,
  AnalyzerFlavor,
  AnalyzerVisitContext,
  ComponentCssPart,
  ComponentCssProperty,
  ComponentDeclaration,
  ComponentDeclarationKind,
  ComponentDefinition,
  ComponentEvent,
  ComponentFeature,
  ComponentFeatureBase,
  ComponentFeatureCollection,
  ComponentFeatures,
  ComponentHeritageClause,
  ComponentMember,
  ComponentMemberAttribute,
  ComponentMemberProperty,
  ComponentMethod,
  ComponentSlot,
  DefinitionNodeResult,
  FeatureVisitReturnTypeMap,
  InheritanceResult,
  JsDoc,
  ModifierKind,
  PriorityKind,
  RefineFeatureEmitMap,
  VisitFeatureEmitMap,
} from "./wca-types.js";

//#region analyze

/**
 * Discovers features on component declaration nodes.
 */
export function analyzeComponentDeclaration(
  initialDeclarationNodes: Node[],
  baseContext: AnalyzerVisitContext,
  options: { visitedNodes?: Set<Node> } = {},
): ComponentDeclaration | undefined {
  const mainDeclarationNode = initialDeclarationNodes[0];
  if (mainDeclarationNode == null) {
    return undefined;
    //throw new Error("Couldn't find main declaration node");
  }

  // Check if there exists a cached declaration for this node.
  // If a cached declaration was found, test if it should be invalidated (by looking at inherited declarations)
  const cachedDeclaration =
    baseContext.cache.componentDeclarationCache.get(mainDeclarationNode);
  if (
    cachedDeclaration != null &&
    !shouldInvalidateCachedDeclaration(cachedDeclaration, baseContext)
  ) {
    return cachedDeclaration;
  }

  options.visitedNodes = options.visitedNodes || new Set();

  // Discover inheritance
  const { declarationKind, declarationNodes, heritageClauses } =
    discoverInheritance(
      initialDeclarationNodes,
      options.visitedNodes,
      baseContext,
    );

  // Expand all heritage clauses with the component declaration
  for (const heritageClause of heritageClauses) {
    // Only resolve declarations we haven't yet seen and shouldn't be excluded
    const declarations = resolveDeclarations(
      heritageClause.identifier,
      baseContext,
    ).filter(
      (n) =>
        !options.visitedNodes?.has(n) && !shouldExcludeNode(n, baseContext),
    );

    if (declarations.length > 0) {
      heritageClause.declaration = analyzeComponentDeclaration(
        declarations,
        baseContext,
        options,
      );
    }
  }

  // Get symbol of main declaration node
  const symbol = getSymbol(mainDeclarationNode, baseContext);

  const sourceFile = mainDeclarationNode.getSourceFile();

  const baseDeclaration: ComponentDeclaration = {
    sourceFile,
    node: mainDeclarationNode,
    declarationNodes: new Set(declarationNodes),
    symbol,
    heritageClauses,
    kind: declarationKind || "class",
    events: [],
    cssParts: [],
    cssProperties: [],
    members: [],
    methods: [],
    slots: [],
    jsDoc: getJsDoc(mainDeclarationNode, baseContext.ts),
  };

  // Add the "get declaration" hook to the context
  const context: AnalyzerDeclarationVisitContext = {
    ...baseContext,
    declarationNode: mainDeclarationNode,
    sourceFile: mainDeclarationNode.getSourceFile(),
    getDeclaration: () => baseDeclaration,
  };

  // Find features on all declaration nodes
  const featureCollections: ComponentFeatureCollection[] = [];

  for (const node of declarationNodes) {
    if (shouldExcludeNode(node, context)) {
      continue;
    }

    // Discover component features using flavors
    featureCollections.push(
      discoverFeatures(node, {
        ...context,
        declarationNode: node,
        sourceFile: node.getSourceFile(),
      }),
    );
  }

  // Add all inherited features to the feature collections array
  for (const heritageClause of heritageClauses) {
    if (heritageClause.declaration != null) {
      featureCollections.push({
        ...heritageClause.declaration,
        members: heritageClause.declaration.members,
      });
    }
  }

  // If all nodes were excluded, return empty declaration
  if (featureCollections.length === 0) {
    return baseDeclaration;
  }

  // Merge all features into one single collection prioritizing features found in first
  const mergedFeatureCollection = mergeFeatures(featureCollections, context);

  // Refine the declaration and return the result
  const refinedDeclaration = refineDeclaration(
    {
      ...baseDeclaration,
      cssParts: mergedFeatureCollection.cssParts,
      cssProperties: mergedFeatureCollection.cssProperties,
      events: mergedFeatureCollection.events,
      methods: mergedFeatureCollection.methods,
      members: mergedFeatureCollection.members,
      slots: mergedFeatureCollection.slots,
    },
    context,
  );

  Object.assign(baseDeclaration, refinedDeclaration);

  // Update the cache
  baseContext.cache.componentDeclarationCache.set(
    mainDeclarationNode,
    baseDeclaration,
  );

  return baseDeclaration;
}

/**
 * Returns if a node should be excluded from the analyzing
 * @param node
 * @param context
 */
function shouldExcludeNode(node: Node, context: AnalyzerVisitContext): boolean {
  // Uses flavors to determine if the node should be excluded
  if (excludeNode(node, context)) {
    return true;
  }

  // It's possible to exclude declaration names
  const name = getNodeName(node, context);

  if (name != null && context.config.excludedDeclarationNames?.includes(name)) {
    return true;
  }

  return false;
}

/**
 * Returns if the declaration should be invalidated by testing
 *    if any of the inherited declarations in the tree has been invalidated
 * @param componentDeclaration
 * @param context
 */
function shouldInvalidateCachedDeclaration(
  componentDeclaration: ComponentDeclaration,
  context: AnalyzerVisitContext,
): boolean {
  for (const heritageClause of componentDeclaration.heritageClauses) {
    if (heritageClause.declaration != null) {
      // This declaration shouldn't be invalidated if the existing "node.getSourceFile()" is equal to the "program.getSourceFile(...)" with the same file name,
      const node = heritageClause.declaration.node;
      const oldSourceFile = node.getSourceFile();
      const newSourceFile = context.program.getSourceFile(
        oldSourceFile.fileName,
      );

      const foundInCache =
        (newSourceFile != null && newSourceFile === oldSourceFile) ?? false;

      // Return "true" that the declaration should invalidate if it wasn't found in the cache
      if (!foundInCache) {
        return true;
      }

      // Test the inherited declarations recursively
      if (
        shouldInvalidateCachedDeclaration(heritageClause.declaration, context)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Uses flavors to determine if a node should be excluded from the output
 */
function excludeNode(node: Node, context: AnalyzerVisitContext): boolean {
  for (const flavor of context.flavors) {
    const exclude = flavor.excludeNode?.(node, context);
    if (exclude) {
      return true;
    }
  }

  return false;
}

/**
 * Uses flavors to refine a declaration.
 */
function refineDeclaration(
  declaration: ComponentDeclaration,
  context: AnalyzerDeclarationVisitContext,
): ComponentDeclaration {
  for (const flavor of context.flavors) {
    declaration =
      flavor.refineDeclaration?.(declaration, context) ?? declaration;
  }

  return declaration;
}

//#endregion

//#region discover

/**
 * Visits the source file and finds all component definitions using flavors.
 */
export function discoverDeclarations(
  sourceFile: SourceFile,
  context: AnalyzerVisitContext,
): ComponentDeclaration[] {
  const declarations: ComponentDeclaration[] = [];

  const symbol = context.checker.getSymbolAtLocation(sourceFile);
  if (symbol != null) {
    // Get all exports in the source file
    const exports = context.checker.getExportsOfModule(symbol);

    // Find all class declarations in the source file
    for (const symbol of exports) {
      const node = symbol.valueDeclaration;

      if (node != null) {
        if (
          context.ts.isClassDeclaration(
            node,
          ) /* || context.ts.isInterfaceDeclaration(node)*/
        ) {
          const nodes = resolveSymbolDeclarations(symbol);
          const decl = analyzeComponentDeclaration(nodes, context);
          if (decl != null) {
            declarations.push(decl);
          }
        }
      }
    }
  }

  return declarations;
}

/**
 * Visits the source file and finds all component definitions using flavors.
 */
export function discoverDefinitions(
  sourceFile: SourceFile,
  context: AnalyzerVisitContext,
  analyzeDeclaration: (
    definition: ComponentDefinition,
    declarationNodes: Node[],
  ) => ComponentDeclaration | undefined,
): ComponentDefinition[] {
  // Find all definitions in the file using flavors
  const definitionResults = analyzeAndDedupeDefinitions(sourceFile, context);

  return Array.from(definitionResults.entries()).map(
    ([definition, declarationSet]) => {
      let declaration: ComponentDeclaration | undefined;
      let didEvaluateDeclaration = false;

      return {
        ...definition,
        get declaration() {
          if (!didEvaluateDeclaration) {
            declaration = analyzeDeclaration(
              definition,
              Array.from(declarationSet),
            );
            didEvaluateDeclaration = true;
          }

          return declaration;
        },
      };
    },
  );
}

/**
 * Finds all component definitions in a file and combine multiple declarations
 * with same tag name.
 */
function analyzeAndDedupeDefinitions(
  sourceFile: SourceFile,
  context: AnalyzerVisitContext,
): Map<ComponentDefinition, Set<Node>> {
  if (!sourceFile) {
    return new Map();
  }

  // Keep a map of "tag name" ==> "definition"
  const tagNameDefinitionMap: Map<string, ComponentDefinition> = new Map();

  // Keep a map of "definition" ==> "declaration nodes"
  const definitionToDeclarationMap: Map<
    ComponentDefinition,
    Set<Node>
  > = new Map();

  // Discover definitions using flavors
  visitDefinitions(sourceFile, context, (results) => {
    // Definitions are unique by tag name and are merged when pointing to multiple declaration nodes.
    // This is because multiple definitions can exist side by side for the same tag name (think global TagName type definition and customElements.define)
    for (const result of results) {
      // Find existing definition with the result name
      let definition = tagNameDefinitionMap.get(result.tagName);

      if (definition == null) {
        // No existing definition was found, - create one!
        definition = {
          sourceFile,
          tagName: result.tagName,
          tagNameNodes: new Set(),
          identifierNodes: new Set(),
        };

        tagNameDefinitionMap.set(result.tagName, definition);
      }

      // Add the discovered identifier node to the definition
      if (result.identifierNode != null) {
        definition.identifierNodes.add(result.identifierNode);
      }

      // Add the discovered tag name node to the definition
      if (result.tagNameNode) {
        definition.tagNameNodes.add(result.tagNameNode);
      }

      // Add the discovered declaration node to the map from "definition" ==> "declaration nodes"
      let declarationNodeSet = definitionToDeclarationMap.get(definition);
      if (declarationNodeSet == null) {
        declarationNodeSet = new Set();
        definitionToDeclarationMap.set(definition, declarationNodeSet);
      }

      // Grab the symbol from the identifier node and get the declarations
      // If the is no symbol on the result, use "result.declarationNode" instead
      const symbol =
        result.identifierNode != null
          ? getSymbol(result.identifierNode, context)
          : undefined;
      const declarations =
        symbol != null
          ? resolveSymbolDeclarations(symbol)
          : result.declarationNode != null
            ? [result.declarationNode]
            : [];

      for (const decl of declarations) {
        declarationNodeSet.add(decl);
      }
    }
  });

  // Remove duplicates where "tagName" is equals to "" if the declaration node is not used in any other definition.
  const results = Array.from(definitionToDeclarationMap.entries());
  for (const [definition, declarations] of results) {
    if (definition.tagName === "") {
      for (const [checkDefinition, checkDeclarations] of results) {
        // Find duplicated based on overlapping declarations
        if (
          definition !== checkDefinition &&
          Array.from(declarations).find(
            (decl) => checkDeclarations.has(decl) != null,
          )
        ) {
          definitionToDeclarationMap.delete(definition);
          break;
        }
      }
    }
  }

  return definitionToDeclarationMap;
}

/**
 * Discovers features for a given node using flavors.
 */
export function discoverFeatures(
  node: Node,
  context: AnalyzerDeclarationVisitContext,
): ComponentFeatureCollection {
  // Return the result if we already found this node
  if (context.cache.featureCollection.has(node)) {
    return context.cache.featureCollection.get(node)!;
  }

  const { collection, refineEmitMap } = prepareRefineEmitMap();

  const emitMap: Partial<VisitFeatureEmitMap> = {
    event: (event) => refineFeature("event", event, context, refineEmitMap),
    member: (memberResult) =>
      refineFeature("member", memberResult, context, refineEmitMap),
    csspart: (cssPart) =>
      refineFeature("csspart", cssPart, context, refineEmitMap),
    cssproperty: (cssProperty) =>
      refineFeature("cssproperty", cssProperty, context, refineEmitMap),
    method: (method) => refineFeature("method", method, context, refineEmitMap),
    slot: (slot) => refineFeature("slot", slot, context, refineEmitMap),
  };

  // Discovers features for "node" using flavors
  visitFeatures(node, context, emitMap);

  // Merge features that were found
  const mergedCollection = mergeFeatures(collection, context);

  // Cache the features for this node
  context.cache.featureCollection.set(node, mergedCollection);

  return mergedCollection;
}

/**
 * Discover all global features using flavors.
 */
export function discoverGlobalFeatures(
  node: Node,
  context: AnalyzerVisitContext,
): ComponentFeatures {
  const { collection, refineEmitMap } = prepareRefineEmitMap();

  // Discovers global features using flavors
  visitGlobalFeatures(node, context, {
    event: (event) => refineFeature("event", event, context, refineEmitMap),
    member: (memberResult) =>
      refineFeature("member", memberResult, context, refineEmitMap),
    csspart: (cssPart) =>
      refineFeature("csspart", cssPart, context, refineEmitMap),
    cssproperty: (cssProperty) =>
      refineFeature("cssproperty", cssProperty, context, refineEmitMap),
    method: (method) => refineFeature("method", method, context, refineEmitMap),
    slot: (slot) => refineFeature("slot", slot, context, refineEmitMap),
  });

  // Merge features in the collection
  return mergeFeatures(collection, context);
}

/**
 * Uses flavors in order to discover inheritance from one of more nodes.
 */
export function discoverInheritance(
  startNode: Node | Node[],
  visitedNodes: Set<Node>,
  context: AnalyzerVisitContext,
): Required<InheritanceResult> {
  const nodes = Array.isArray(startNode) ? startNode : [startNode];

  let declarationKind: ComponentDeclarationKind | undefined = undefined;
  const heritageClauses: ComponentHeritageClause[] = [];
  const declarationNodes = new Set<Node>();

  for (const node of nodes) {
    visitedNodes.add(node);

    // Visit inheritance using flavors
    visitInheritance(node, context, (result) => {
      // Combine results into one single result
      declarationKind = declarationKind || result.declarationKind;

      if (result.declarationNodes != null) {
        for (const node of result.declarationNodes) {
          declarationNodes.add(node);
        }
      }

      if (result.heritageClauses != null) {
        heritageClauses.push(...result.heritageClauses);
      }
    });
  }

  return {
    declarationNodes: Array.from(declarationNodes),
    heritageClauses,
    declarationKind: declarationKind || "class",
  };
}

/**
 * Prepares a map of component features and a callback map that adds to the component feature map.
 */
function prepareRefineEmitMap(): {
  collection: ComponentFeatureCollection;
  refineEmitMap: RefineFeatureEmitMap;
} {
  const collection: ComponentFeatureCollection = {
    members: [],
    methods: [],
    events: [],
    slots: [],
    cssProperties: [],
    cssParts: [],
  };

  const refineEmitMap: RefineFeatureEmitMap = {
    event: (event) => collection.events.push(event),
    member: (member) => collection.members.push(member),
    csspart: (cssPart) => collection.cssParts.push(cssPart),
    cssproperty: (cssProperty) => collection.cssProperties.push(cssProperty),
    method: (method) => collection.methods.push(method),
    slot: (slot) => collection.slots.push(slot),
  };

  return {
    collection,
    refineEmitMap,
  };
}

//#endregion

//#region flavor

/**
 * Uses flavors to refine a feature.
 * Flavors can also remove a feature.
 */
export function refineFeature<
  FeatureKind extends ComponentFeature,
  ValueType extends ComponentFeatureBase =
    FeatureVisitReturnTypeMap[FeatureKind],
>(
  featureKind: FeatureKind,
  value: ValueType | ValueType[],
  context: AnalyzerVisitContext | AnalyzerDeclarationVisitContext,
  emitMap: Partial<RefineFeatureEmitMap>,
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
                : [refined]) as unknown as ValueType[]),
            );
          }
        }
        refinedValue = newValue.length === 0 ? undefined : newValue;
      } else {
        refinedValue = refineFunc(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          refinedValue as any,
          context,
        ) as unknown as typeof refinedValue;
      }
    }
  }

  if (refinedValue != null) {
    (Array.isArray(refinedValue) ? refinedValue : [refinedValue]).forEach((v) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emitMap?.[featureKind]?.(v as any),
    );
  }
}

/**
 * Uses flavors to visit definitions.
 */
export function visitDefinitions(
  node: Node,
  context: AnalyzerVisitContext,
  emit: (results: DefinitionNodeResult[]) => void,
): void {
  const result = executeFunctionsUntilMatch(
    context.flavors,
    "discoverDefinitions",
    node,
    context,
  );

  if (result != null) {
    emit(result.value);

    if (!result.shouldContinue) return;
  }

  // Visit child nodes
  node.forEachChild((child) => {
    visitDefinitions(child, context, emit);
  });
}

/**
 * Uses flavors to find features for a node.
 */
export function visitFeatures(
  node: Node,
  context: AnalyzerDeclarationVisitContext,
  emitMap: Partial<VisitFeatureEmitMap>,
): void {
  const visitMaps = arrayDefined(
    context.flavors.map((flavor) => flavor.discoverFeatures),
  );

  visitFeaturesWithVisitMaps(node, context, visitMaps, emitMap);
}

/**
 * Uses flavors to find features for a node, using a visit map.
 */
export function visitFeaturesWithVisitMaps(
  node: Node,
  context: AnalyzerVisitContext,
  visitMaps: NonNullable<AnalyzerFlavor["discoverFeatures"]>[],
  emitMap: Partial<VisitFeatureEmitMap>,
): void {
  for (const feature of context.config.features || []) {
    // Visit all features: always "continue"
    for (const functionMap of visitMaps) {
      const func = functionMap?.[feature];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = func?.(node, context as any);

      if (value != null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        emitMap[feature]?.(value as any);
      }
    }
  }

  // Visit child nodes
  node.forEachChild((child) => {
    visitFeaturesWithVisitMaps(child, context, visitMaps, emitMap);
  });
}

/**
 * Uses flavors to find global features.
 */
export function visitGlobalFeatures(
  node: Node,
  context: AnalyzerVisitContext,
  emitMap: Partial<VisitFeatureEmitMap>,
): void {
  const visitMaps = arrayDefined(
    context.flavors.map((flavor) => flavor.discoverGlobalFeatures),
  );

  visitFeaturesWithVisitMaps(node, context, visitMaps, emitMap);
}

/**
 * Uses flavors to find inheritance for a node.
 */
export function visitInheritance(
  node: Node,
  context: AnalyzerVisitContext,
  emit: (result: InheritanceResult) => void,
  visitSet?: Set<Node>,
): void {
  for (const flavor of context.flavors) {
    const result = flavor.discoverInheritance?.(node, context);
    if (result != null) {
      emit(result);
    }
  }
}

/**
 * Executes functions in a function map until some function returns a
 * non-undefined value.
 *
 * @param functionMaps An array of function maps to execute.
 * @param keys The keys of the functions to execute.
 * @param arg The argument to pass to each function.
 * @param context The analyzer visit context to pass to each function.
 */
function executeFunctionsUntilMatch<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Partial<Record<K, any>>,
  K extends keyof T,
  ReturnValue extends ReturnType<NonNullable<T[K]>>,
  ArgType,
>(
  functionMaps: T[],
  keys: K | K[],
  arg: ArgType,
  context: AnalyzerVisitContext,
): { value: NonNullable<ReturnValue>; shouldContinue?: boolean } | undefined {
  keys = Array.isArray(keys) ? keys : [keys];

  for (const key of keys) {
    // Loop through each function
    for (const functionMap of functionMaps) {
      const func = functionMap[key];

      if (func == null) continue;

      // Save a "continue" flag if necessary
      let shouldContinue = false;
      const result = func(arg, {
        ...context,
        emitContinue() {
          shouldContinue = true;
        },
      });

      // Return a result if not undefined
      if (result != null) {
        return { value: result as NonNullable<ReturnValue>, shouldContinue };
      }
    }
  }

  return undefined;
}

//#endregion

//#region merge

/**
 * Merges multiple slots.
 */
function mergeSlots(slots: ComponentSlot[]): ComponentSlot[] {
  return mergeNamedEntries(slots, (slot) => slot.name || "");
}

/**
 * Merges multiple css parts.
 */
function mergeCssParts(cssParts: ComponentCssPart[]): ComponentCssPart[] {
  return mergeNamedEntries(cssParts, (cssPart) => cssPart.name);
}

/**
 * Merges multiple css properties.
 */
function mergeCssProperties(
  cssProps: ComponentCssProperty[],
): ComponentCssProperty[] {
  return mergeNamedEntries(cssProps, (cssProp) => cssProp.name);
}

/**
 * Merges multiple methods.
 */
function mergeMethods(methods: ComponentMethod[]): ComponentMethod[] {
  return mergeNamedEntries(
    methods,
    (method) => method.name,
    (left, right) => ({
      ...left,
      jsDoc: mergeJsDoc(left.jsDoc, right.jsDoc),
      //modifiers: mergeModifiers(left.modifiers, right.modifiers)
    }),
  );
  /*return mergeEntries(
		methods,
		(method, mergedMethod) => {
			if (method.name === mergedMethod.name) {
				return (method.modifiers?.has("static") || false) === (mergedMethod.modifiers?.has("static") || false);
			}

			return false;
		},
		(left, right) => ({
			...left,
			jsDoc: mergeJsDoc(left.jsDoc, right.jsDoc),
			modifiers: mergeModifiers(left.modifiers, right.modifiers)
		})
	);*/
}

/**
 * Merges multiple events.
 */
function mergeEvents(
  events: ComponentEvent[],
  checker: TypeChecker,
): ComponentEvent[] {
  return mergeNamedEntries(
    events,
    (event) => event.name,
    (left, right) => {
      const jsDoc = mergeJsDoc(left.jsDoc, right.jsDoc);

      const type = () =>
        left.type != null
          ? left.type()
          : right.type != null
            ? right.type()
            : checker.getAnyType();

      return {
        ...left,
        typeHint: left.typeHint || right.typeHint,
        jsDoc,
        type,
      };
    },
  );
}

/**
 * Merges all features in collections of features.
 */
export function mergeFeatures(
  collection: ComponentFeatureCollection | ComponentFeatureCollection[],
  context: AnalyzerVisitContext,
): ComponentFeatureCollection {
  if (Array.isArray(collection)) {
    if (collection.length === 1) {
      return collection[0];
    }

    collection = {
      cssParts: collection.map((c) => c.cssParts).flat(),
      cssProperties: collection.map((c) => c.cssProperties).flat(),
      events: collection.map((c) => c.events).flat(),
      members: collection.map((c) => c.members).flat(),
      methods: collection.map((c) => c.methods).flat(),
      slots: collection.map((c) => c.slots).flat(),
    };

    return mergeFeatures(collection, context);
  }

  const { checker } = context;

  return {
    cssParts: mergeCssParts(collection.cssParts),
    cssProperties: mergeCssProperties(collection.cssProperties),
    events: mergeEvents(collection.events, checker),
    members: mergeMembers(collection.members, context),
    methods: mergeMethods(collection.methods),
    slots: mergeSlots(collection.slots),
  };
}

const priorityValueMap: Record<PriorityKind, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

interface MergeMap {
  props: Map<string, ComponentMemberProperty>;
  attrs: Map<string, ComponentMemberAttribute>;
}

/**
 * Merges multiple members based on priority.
 */
function mergeMembers(
  members: ComponentMember[],
  context: AnalyzerVisitContext,
): ComponentMember[] {
  // Start merging by sorting member results from high to low priority.
  // If two priorities are the same: prioritize the first found element
  // From node 11, equal elements keep their order after sort, but not in node 10
  // Therefore we use "indexOf" to return correct order if two priorities are equal
  members = [...members].sort((a, b) => {
    const vA = priorityValueMap[a.priority || "low"];
    const vB = priorityValueMap[b.priority || "low"];

    if (vA === vB) {
      const iA = members.indexOf(a);
      const iB = members.indexOf(b);

      return iA < iB ? -1 : 1;
    }

    return vA < vB ? 1 : -1;
  });

  // Keep track of merged props and merged attributes
  // These are stored in maps for speed, because we are going to lookup a member per each memberResult
  const mergeMap: MergeMap = {
    props: new Map<string, ComponentMemberProperty>(),
    attrs: new Map<string, ComponentMemberAttribute>(),
  };

  // Merge all members one by one adding them to the merge map
  for (const member of members) {
    // Find a member that is similar to this member
    const mergeableMember = findMemberToMerge(member, mergeMap);
    let newMember: ComponentMember;

    if (mergeableMember == null) {
      // No mergeable member was found, so just add this to the map
      newMember = member;
    } else {
      // Remove "member" and "mergeableMember" from the merge map
      // We are going to merge those and add the result to the merge map again
      clearMergeMapWithMember(mergeableMember, mergeMap);
      clearMergeMapWithMember(member, mergeMap);

      newMember = mergeMemberIntoMember(
        mergeableMember,
        member,
        context.checker,
      );
    }

    // Add to merge map
    switch (newMember.kind) {
      case "attribute":
        mergeMap.attrs.set(newMember.attrName, newMember);
        break;
      case "property":
        mergeMap.props.set(newMember.propName, newMember);
        break;
    }
  }

  // Return merged results with only "high" priorities
  return [...mergeMap.props.values(), ...mergeMap.attrs.values()].map(
    (member) => ({ ...member, priority: "high" }),
  );
}

/**
 * Removes a member from the merge map
 * @param member
 * @param mergeMap
 */
function clearMergeMapWithMember(member: ComponentMember, mergeMap: MergeMap) {
  switch (member.kind) {
    case "attribute":
      mergeMap.attrs.delete(member.attrName);
      break;
    case "property":
      mergeMap.props.delete(member.propName);
      if (member.attrName != null) {
        mergeMap.attrs.delete(member.attrName);
      }
      break;
  }
}

/**
 * Finds a mergeable member
 * @param similar
 * @param mergeMap
 */
function findMemberToMerge(
  similar: ComponentMember,
  mergeMap: MergeMap,
): ComponentMember | undefined {
  const attrName = similar.attrName; //?.toLowerCase(); // (similar.kind === "attribute" && similar.attrName.toLowerCase()) || undefined;
  const propName = similar.propName; /*?.toLowerCase()*/ //(similar.kind === "property" && similar.propName.toLowerCase()) || undefined;

  // Return a member that matches either propName (prioritized) or attrName
  if (propName != null) {
    const mergeable =
      mergeMap.props.get(propName) || mergeMap.attrs.get(propName);
    if (mergeable != null) {
      return mergeable;
    }
  }

  if (attrName != null) {
    const mergeableAttr = mergeMap.attrs.get(attrName);
    if (mergeableAttr != null) {
      return mergeableAttr;
    }

    // Try to find a prop with the attr name.
    // Don't return the prop if it already has an attribute that is not equals to the attr name
    const mergeableProp = mergeMap.props.get(attrName);
    if (mergeableProp != null && mergeableProp.attrName == null) {
      return mergeableProp;
    }

    for (const mergedAttr of mergeMap.props.values()) {
      if (mergedAttr.attrName === attrName) {
        return mergedAttr;
      }
    }
  }

  return undefined;
}

/**
 * Merges two members of the same kind into each other.
 * This operation prioritizes leftMember
 * @param leftMember
 * @param rightMember
 * @param checker
 */
function mergeMemberIntoMember<
  T extends ComponentMemberProperty | ComponentMemberAttribute,
>(leftMember: T, rightMember: T, checker: TypeChecker): T {
  // Always prioritize merging attribute into property if possible
  if (leftMember.kind === "attribute" && rightMember.kind === "property") {
    return mergeMemberIntoMember(rightMember, leftMember, checker);
  }

  return {
    ...leftMember,
    attrName: leftMember.attrName ?? rightMember.attrName,
    type: (() => {
      // Always prioritize a "property" over an "attribute" when merging types
      if (
        leftMember.kind === rightMember.kind ||
        leftMember.kind === "property"
      ) {
        return leftMember.type ?? rightMember.type;
      } else if (rightMember.kind === "property") {
        return rightMember.type ?? leftMember.type;
      }

      return undefined;
    })(),
    typeHint: leftMember.typeHint ?? rightMember.typeHint,
    jsDoc: mergeJsDoc(leftMember.jsDoc, rightMember.jsDoc),
    modifiers: mergeModifiers(leftMember.modifiers, rightMember.modifiers),
    meta: leftMember.meta ?? rightMember.meta,
    default:
      leftMember.default === undefined
        ? rightMember.default
        : leftMember.default,
    required: leftMember.required ?? rightMember.required,
    visibility: leftMember.visibility ?? rightMember.visibility,
    deprecated: leftMember.deprecated ?? rightMember.deprecated,
    declaration: rightMember.declaration ?? leftMember.declaration,
  };
}

/**
 * Merges based on a name.
 */
function mergeNamedEntries<T>(
  entries: T[],
  getName: (entry: T) => string,
  merge?: (left: T, right: T) => T,
): T[] {
  const merged = new Map<string, T>();

  for (const entry of entries) {
    const name = getName(entry);

    const existing = merged.get(name);

    if (existing == null) {
      merged.set(name, entry);
    } else if (merge != null) {
      merged.set(name, merge(existing, entry));
    }
  }

  return Array.from(merged.values());
}

/**
 * Merges two jsdocs.
 */
function mergeJsDoc(
  leftJsDoc: JsDoc | undefined,
  rightJsDoc: JsDoc | undefined,
): JsDoc | undefined {
  if (leftJsDoc == null) {
    return rightJsDoc;
  } else if (rightJsDoc == null) {
    return leftJsDoc;
  }

  return {
    ...(leftJsDoc ?? rightJsDoc),
    description: leftJsDoc.description ?? rightJsDoc.description,
  };
}

/**
 * Merges modifiers.
 */
function mergeModifiers(
  leftModifiers: Set<ModifierKind> | undefined,
  rightModifiers: Set<ModifierKind> | undefined,
): Set<ModifierKind> | undefined {
  const newSet = new Set<ModifierKind>();

  if (leftModifiers?.has("static") && rightModifiers?.has("static")) {
    newSet.add("static");
  }

  if (leftModifiers?.has("readonly") && rightModifiers?.has("readonly")) {
    newSet.add("readonly");
  }

  if (newSet.size === 0) {
    return undefined;
  }

  return newSet;
}

//#endregion
