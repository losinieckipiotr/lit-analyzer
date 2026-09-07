import {
  BinaryExpression,
  ConstructSignatureDeclaration,
  ExpressionStatement,
  HeritageClause,
  Node,
  ReturnStatement,
} from "typescript";
import { isNamePrivate } from "../util/str-util.js";
import {
  findChild,
  findChildren,
  getInterfaceKeys,
  getMemberVisibilityFromNode,
  getModifiersFromNode,
  hasModifier,
  resolveDeclarationsDeep,
  resolveNodeValue,
} from "./ast-util.js";
import { getJsDoc } from "./js-doc-util.js";
import {
  AnalyzerDeclarationVisitContext,
  AnalyzerFlavor,
  AnalyzerVisitContext,
  ComponentDeclarationKind,
  ComponentEvent,
  ComponentHeritageClause,
  ComponentHeritageClauseKind,
  ComponentMember,
  ComponentMethod,
  DefinitionNodeResult,
  InheritanceResult,
} from "./wca-types.js";

/**
 * A flavor that discovers using standard custom element rules.
 */
export class CustomElementFlavor implements AnalyzerFlavor {
  excludeNode = excludeNode;

  discoverDefinitions = discoverDefinitions;

  discoverFeatures = {
    member: discoverMembers,
    event: discoverEvents,
    method: discoverMethods,
  };

  discoverGlobalFeatures = discoverGlobalFeatures;

  discoverInheritance = discoverInheritance;
}

/**
 * Excludes nodes from "lib.dom.d.ts" if analyzeLibDom is false.
 */
function excludeNode(
  node: Node,
  context: AnalyzerVisitContext,
): boolean | undefined {
  if (context.config.analyzeDefaultLib) {
    return undefined;
  }

  return isLibDom(node);
}

function isLibDom(node: Node) {
  return node.getSourceFile().fileName.endsWith("lib.dom.d.ts");
}

/**
 * Visits custom element definitions.
 */
function discoverDefinitions(
  node: Node,
  { ts, checker }: AnalyzerVisitContext,
): DefinitionNodeResult[] | undefined {
  // customElements.define("my-element", MyElement)
  if (ts.isCallExpression(node)) {
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.escapedText === "define"
    ) {
      let leftExpression: Node = node.expression.expression;

      // Take "window.customElements" into account and return the "customElements" part
      if (
        ts.isPropertyAccessExpression(leftExpression) &&
        ts.isIdentifier(leftExpression.expression) &&
        leftExpression.expression.escapedText === "window"
      ) {
        leftExpression = leftExpression.name;
      }

      // Check if the "left expression" is called "customElements"
      if (
        ts.isIdentifier(leftExpression) &&
        leftExpression.escapedText === "customElements" &&
        node.expression.name != null &&
        ts.isIdentifier(node.expression.name)
      ) {
        // Find the arguments of: define("my-element", MyElement)
        const [unresolvedTagNameNode, identifierNode] = node.arguments;

        // Resolve the tag name node
        // ("my-element", MyElement)
        const resolvedTagNameNode = resolveNodeValue(unresolvedTagNameNode, {
          ts,
          checker,
          strict: true,
        });

        if (
          resolvedTagNameNode != null &&
          identifierNode != null &&
          typeof resolvedTagNameNode.value === "string"
        ) {
          const tagName = resolvedTagNameNode.value;
          const tagNameNode = resolvedTagNameNode.node;

          // (___, MyElement)
          if (ts.isIdentifier(identifierNode)) {
            return [
              {
                tagName,
                identifierNode,
                tagNameNode,
              },
            ];
          }

          // (___, class { ... })
          else if (
            ts.isClassLike(identifierNode) ||
            ts.isInterfaceDeclaration(identifierNode)
          ) {
            return [
              {
                tagName,
                tagNameNode,
                declarationNode: identifierNode,
              },
            ];
          }
        }
      }
    }

    return undefined;
  }

  // interface HTMLElementTagNameMap { "my-button": MyButton; }
  if (
    ts.isInterfaceDeclaration(node) &&
    ["HTMLElementTagNameMap", "ElementTagNameMap"].includes(node.name.text)
  ) {
    const extensions = getInterfaceKeys(node, { ts, checker });
    return extensions.map(({ key, keyNode, identifier, declaration }) => ({
      tagName: key,
      tagNameNode: keyNode,
      identifierNode: identifier,
      declarationNode: declaration,
    }));
  }

  return undefined;
}

/**
 * Discovers members based on standard vanilla custom element rules.
 */
function discoverMembers(
  node: Node,
  context: AnalyzerDeclarationVisitContext,
): ComponentMember[] | undefined {
  const { ts, checker } = context;

  // Never pick up members not declared directly on the declaration node being traversed
  if (node.parent !== context.declarationNode) {
    return undefined;
  }

  // static get observedAttributes() { return ['c', 'l']; }
  if (
    ts.isGetAccessor(node) &&
    hasModifier(node, ts.SyntaxKind.StaticKeyword, ts)
  ) {
    if (node.name.getText() === "observedAttributes" && node.body != null) {
      const members: ComponentMember[] = [];

      // Find either the first "return" statement or the first "array literal expression"
      const arrayLiteralExpression =
        (
          node.body.statements.find((statement) =>
            ts.isReturnStatement(statement),
          ) as ReturnStatement | undefined
        )?.expression ??
        node.body.statements.find((statement) =>
          ts.isArrayLiteralExpression(statement),
        );

      if (
        arrayLiteralExpression != null &&
        ts.isArrayLiteralExpression(arrayLiteralExpression)
      ) {
        // Emit an attribute for each string literal in the array.
        for (const attrNameNode of arrayLiteralExpression.elements) {
          const attrName = ts.isStringLiteralLike(attrNameNode)
            ? attrNameNode.text
            : undefined;
          if (attrName == null) continue;

          members.push({
            priority: "medium",
            node: attrNameNode,
            jsDoc: getJsDoc(attrNameNode, ts),
            kind: "attribute",
            attrName,
            type: undefined, // () => ({ kind: "ANY" } as SimpleType),
          });
        }
      }

      return members;
    }
  }

  // class { myProp = "hello"; }
  else if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
    const { name, initializer } = (() => {
      if (ts.isPropertySignature(node)) {
        return { name: node.name, initializer: undefined };
      }
      return node;
    })();

    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
      // Always ignore the "prototype" property
      if (name.text === "prototype") {
        return undefined;
      }

      // Find default value based on initializer
      const resolvedDefaultValue =
        initializer != null
          ? resolveNodeValue(initializer, context)
          : undefined;
      const def =
        resolvedDefaultValue != null
          ? resolvedDefaultValue.value
          : initializer?.getText();

      return [
        {
          priority: "high",
          node,
          kind: "property",
          jsDoc: getJsDoc(node, ts),
          propName: name.text,
          type: () => checker.getTypeAtLocation(node),
          default: def,
          visibility: getMemberVisibilityFromNode(node, ts),
          modifiers: getModifiersFromNode(node, ts),
          //required: isPropertyRequired(node, context.checker),
        },
      ];
    }
  }

  // class { set myProp(value: string) { ... } }
  else if (ts.isSetAccessor(node) || ts.isGetAccessor(node)) {
    const { name, parameters } = node;

    if (ts.isIdentifier(name)) {
      const parameter =
        ts.isSetAccessor(node) != null && parameters?.length > 0
          ? parameters[0]
          : undefined;

      return [
        {
          priority: "high",
          node,
          jsDoc: getJsDoc(node, ts),
          kind: "property",
          propName: name.text,
          type: () =>
            parameter == null
              ? context.checker.getTypeAtLocation(node)
              : context.checker.getTypeAtLocation(parameter),
          visibility: getMemberVisibilityFromNode(node, ts),
          modifiers: getModifiersFromNode(node, ts),
        },
      ];
    }
  }

  // constructor { super(); this.title = "Hello"; }
  else if (ts.isConstructorDeclaration(node)) {
    if (node.body != null) {
      const assignments = node.body.statements
        .filter((stmt): stmt is ExpressionStatement =>
          ts.isExpressionStatement(stmt),
        )
        .map((stmt) => stmt.expression)
        .filter((exp): exp is BinaryExpression => ts.isBinaryExpression(exp));

      const members: ComponentMember[] = [];
      for (const assignment of assignments) {
        const { left, right } = assignment;

        if (ts.isPropertyAccessExpression(left)) {
          if (left.expression.kind === ts.SyntaxKind.ThisKeyword) {
            const propName = left.name.getText();

            const resolvedInitializer = resolveNodeValue(right, context);
            const def =
              resolvedInitializer != null
                ? resolvedInitializer.value
                : undefined; //right.getText();

            members.push({
              priority: "low",
              node,
              kind: "property",
              propName,
              default: def,
              type: () => {
                return checker.getTypeAtLocation(right);
              },
              jsDoc: getJsDoc(assignment.parent, ts),
              visibility: isNamePrivate(propName) ? "private" : undefined,
            });
          }
        }
      }

      return members;
    }
  }

  return undefined;
}

const EVENT_NAMES = [
  "Event",
  "CustomEvent",
  "AnimationEvent",
  "ClipboardEvent",
  "DragEvent",
  "FocusEvent",
  "HashChangeEvent",
  "InputEvent",
  "KeyboardEvent",
  "MouseEvent",
  "PageTransitionEvent",
  "PopStateEvent",
  "ProgressEvent",
  "StorageEvent",
  "TouchEvent",
  "TransitionEvent",
  "UiEvent",
  "WheelEvent",
];

/**
 * Discovers events dispatched.
 */
function discoverEvents(
  node: Node,
  context: AnalyzerVisitContext,
): ComponentEvent[] | undefined {
  const { ts, checker } = context;

  // new CustomEvent("my-event");
  if (ts.isNewExpression(node)) {
    const { expression, arguments: args } = node;

    if (
      EVENT_NAMES.includes(expression.getText()) &&
      args &&
      args.length >= 1
    ) {
      const arg = args[0];

      const eventName = resolveNodeValue(arg, {
        ...context,
        strict: true,
      })?.value;

      if (typeof eventName === "string") {
        // Either grab jsdoc from the new expression or from a possible call expression that its wrapped in
        const jsDoc =
          getJsDoc(expression, ts) ||
          (ts.isCallLikeExpression(node.parent) &&
            getJsDoc(node.parent.parent, ts)) ||
          (ts.isExpressionStatement(node.parent) &&
            getJsDoc(node.parent, ts)) ||
          undefined;

        return [
          {
            jsDoc,
            name: eventName,
            node,
            type: () => checker.getTypeAtLocation(node),
          },
        ];
      }
    }
  }

  return undefined;
}

/**
 * Discovers global feature defined on "HTMLElementEventMap" or "HTMLElement".
 */
const discoverGlobalFeatures: AnalyzerFlavor["discoverGlobalFeatures"] = {
  event: (
    node: Node,
    context: AnalyzerVisitContext,
  ): ComponentEvent[] | undefined => {
    const { ts, checker } = context;

    if (
      context.ts.isInterfaceDeclaration(node) &&
      ["HTMLElementEventMap", "GlobalEventHandlersEventMap"].includes(
        node.name.text,
      )
    ) {
      const events: ComponentEvent[] = [];

      for (const member of node.members) {
        if (ts.isPropertySignature(member)) {
          const name = resolveNodeValue(member.name, context)?.value;

          if (name != null && typeof name === "string") {
            events.push({
              node: member,
              jsDoc: getJsDoc(member, ts),
              name: name,
              type: () => checker.getTypeAtLocation(member),
            });
          }
        }
      }

      context?.emitContinue?.();

      return events;
    }

    return undefined;
  },
  member: (
    node: Node,
    context: AnalyzerVisitContext,
  ): ComponentMember[] | undefined => {
    const { ts } = context;

    if (
      context.ts.isInterfaceDeclaration(node) &&
      node.name.text === "HTMLElement"
    ) {
      const members: ComponentMember[] = [];

      for (const member of node.members) {
        if (ts.isPropertySignature(member)) {
          const name = resolveNodeValue(member.name, context)?.value;

          if (name != null && typeof name === "string") {
            members.push({
              priority: "medium",
              node: member,
              jsDoc: getJsDoc(member, ts),
              kind: "property",
              propName: name,
              type: () => context.checker.getTypeAtLocation(member),
            });
          }
        }
      }

      context?.emitContinue?.();

      return members;
    }

    return undefined;
  },
};

/**
 * Discovers inheritance from a node by looking at "extends" and "implements"
 * @param node
 * @param baseContext
 */
function discoverInheritance(
  node: Node,
  baseContext: AnalyzerVisitContext,
): InheritanceResult | undefined {
  let declarationKind: ComponentDeclarationKind | undefined = undefined;
  const heritageClauses: ComponentHeritageClause[] = [];
  const declarationNodes = new Set<Node>();

  const context: InheritanceAnalyzerVisitContext = {
    ...baseContext,
    emitDeclaration: (decl) => declarationNodes.add(decl),
    emitInheritance: (kind, identifier) =>
      heritageClauses.push({ kind, identifier, declaration: undefined }),
    emitDeclarationKind: (kind) => (declarationKind = declarationKind || kind),
    visitedNodes: new Set<Node>(),
  };

  // Resolve the structure of the node
  resolveStructure(node, context);

  // Reverse heritage clauses because they come out in wrong order
  heritageClauses.reverse();

  return {
    declarationNodes: Array.from(declarationNodes),
    heritageClauses,
    declarationKind,
  };
}

interface InheritanceAnalyzerVisitContext extends AnalyzerVisitContext {
  emitDeclaration: (node: Node) => void;
  emitDeclarationKind: (kind: ComponentDeclarationKind) => void;
  emitInheritance: (
    kind: ComponentHeritageClauseKind,
    identifier: Node,
  ) => void;
  visitedNodes: Set<Node>;
}

function resolveStructure(
  node: Node,
  context: InheritanceAnalyzerVisitContext,
) {
  const { ts } = context;

  if (context.visitedNodes.has(node)) {
    return;
  }

  context.visitedNodes.add(node);

  // Call this function recursively if this node is an identifier
  if (ts.isIdentifier(node)) {
    for (const decl of resolveDeclarationsDeep(node, context)) {
      resolveStructure(decl, context);
    }
  }

  // Emit declaration node if we've found a class of interface
  else if (ts.isClassLike(node) || ts.isInterfaceDeclaration(node)) {
    context.emitDeclarationKind(ts.isClassLike(node) ? "class" : "interface");
    context.emitDeclaration(node);

    // Resolve inheritance
    for (const heritage of node.heritageClauses || []) {
      for (const type of heritage.types || []) {
        resolveHeritage(heritage, type.expression, context);
      }
    }
  }

  // Emit a declaration node if this node is a type literal
  else if (ts.isTypeLiteralNode(node) || ts.isObjectLiteralExpression(node)) {
    context.emitDeclarationKind("interface");
    context.emitDeclaration(node);
  }

  // Emit a mixin if this node is a function
  else if (ts.isFunctionLike(node) || ts.isCallLikeExpression(node)) {
    context.emitDeclarationKind("mixin");

    if (ts.isFunctionLike(node) && node.getSourceFile().isDeclarationFile) {
      // Find any identifiers if the node is in a declaration file
      findChildren(node.type, ts.isIdentifier, (identifier) => {
        resolveStructure(identifier, context);
      });
    } else {
      // Else find the first class declaration in the block
      // Note that we don't look for a return statement because this would complicate things
      const clzDecl = findChild(node, ts.isClassLike);
      if (clzDecl != null) {
        resolveStructure(clzDecl, context);
        return;
      }

      // If we didn't find any class declarations, we might be in a function that wraps a mixin
      // Therefore find the return statement and call this method recursively
      const returnNode = findChild(node, ts.isReturnStatement);
      if (
        returnNode != null &&
        returnNode.expression != null &&
        returnNode.expression !== node
      ) {
        const returnNodeExp = returnNode.expression;

        // If a function call is returned, this function call expression is followed, and the arguments are treated as heritage
        //    Example: return MyFirstMixin(MySecondMixin(Base))   -->   MyFirstMixin is followed, and MySecondMixin + Base are inherited
        if (
          ts.isCallExpression(returnNodeExp) &&
          returnNodeExp.expression != null
        ) {
          for (const arg of returnNodeExp.arguments) {
            resolveHeritage(undefined, arg, context);
          }

          resolveStructure(returnNodeExp.expression, context);
        }

        return;
      }
    }
  } else if (
    ts.isVariableDeclaration(node) &&
    (node.initializer != null || node.type != null)
  ) {
    resolveStructure((node.initializer || node.type)!, context);
  } else if (ts.isIntersectionTypeNode(node)) {
    emitTypeLiteralsDeclarations(node, context);
  }
}

function resolveHeritage(
  heritage: HeritageClause | ComponentHeritageClauseKind | undefined,
  node: Node,
  context: InheritanceAnalyzerVisitContext,
): void {
  const { ts } = context;

  /**
   * Parse mixins
   */
  if (ts.isCallExpression(node)) {
    // Mixins
    const { expression: identifier, arguments: args } = node;

    // Extend classes given to the mixin
    // Example: class MyElement extends MyMixin(MyBase) --> MyBase
    // Example: class MyElement extends MyMixin(MyBase1, MyBase2) --> MyBase1, MyBase2
    for (const arg of args) {
      resolveHeritage(heritage, arg, context);
    }

    // Resolve and traverse the mixin function
    // Example: class MyElement extends MyMixin(MyBase) --> MyMixin
    if (identifier != null && ts.isIdentifier(identifier)) {
      resolveHeritage("mixin", identifier, context);
    }
  } else if (ts.isIdentifier(node)) {
    // Try to handle situation like this, by resolving the variable in between
    //    const Base = ExtraMixin(base);
    //    class MixinClass extends Base { }
    let dontEmitHeritageClause = false;

    // Resolve the declaration of this identifier
    const declarations = resolveDeclarationsDeep(node, context);

    for (const decl of declarations) {
      // If the resolved declaration is a variable declaration assigned to a function, try to follow the assignments.
      //    Example:    const MyBase = MyMixin(Base); return class extends MyBase { ... }
      if (context.ts.isVariableDeclaration(decl) && decl.initializer != null) {
        if (context.ts.isCallExpression(decl.initializer)) {
          let hasDeclaration = false;
          resolveStructure(decl, {
            ...context,
            emitInheritance: () => {},
            emitDeclarationKind: () => {},
            emitDeclaration: () => {
              hasDeclaration = true;
            },
          });

          if (!hasDeclaration) {
            resolveHeritage(heritage, decl.initializer, context);
            dontEmitHeritageClause = true;
          }
        }
      }

      // Don't emit inheritance if it's a parameter, because the parameter
      //    is a subsitution for the actual base class which we have already resolved.
      else if (context.ts.isParameter(decl)) {
        dontEmitHeritageClause = true;
      }
    }

    if (!dontEmitHeritageClause) {
      // This is an "implements" clause if implement keyword is used or if all the resolved declarations are interfaces
      const kind: ComponentHeritageClauseKind =
        heritage != null && typeof heritage === "string"
          ? heritage
          : heritage?.token === ts.SyntaxKind.ImplementsKeyword ||
              (declarations.length > 0 &&
                !declarations.some(
                  (decl) => !context.ts.isInterfaceDeclaration(decl),
                ))
            ? "implements"
            : "extends";

      context.emitInheritance(kind, node);
    }
  }
}

/**
 * Emits "type literals" in the AST. Emits them with "emitDeclaration"
 * @param node
 * @param context
 */
function emitTypeLiteralsDeclarations(
  node: Node,
  context: InheritanceAnalyzerVisitContext,
) {
  if (context.ts.isTypeLiteralNode(node)) {
    // If we encounter a construct signature, follow the type
    const construct = node.members?.find(
      (member): member is ConstructSignatureDeclaration =>
        context.ts.isConstructSignatureDeclaration(member),
    );
    if (construct != null && construct.type != null) {
      context.emitDeclarationKind("mixin");
      emitTypeLiteralsDeclarations(construct.type, context);
    } else {
      context.emitDeclaration(node);
    }
  } else {
    node.forEachChild((n) => emitTypeLiteralsDeclarations(n, context));
  }
}

/**
 * Discovers methods
 * @param node
 * @param context
 */
function discoverMethods(
  node: Node,
  context: AnalyzerDeclarationVisitContext,
): ComponentMethod[] | undefined {
  const { ts } = context;

  // Never pick up method declaration not declared directly on the declaration node being traversed
  if (node.parent !== context.declarationNode) {
    return undefined;
  }

  // class { myMethod () {} }
  if (
    (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) &&
    !hasModifier(node, ts.SyntaxKind.StaticKeyword, ts)
  ) {
    // Outscope static methods for now
    const name = node.name.getText();

    if (!context.config.analyzeDefaultLib && isHTMLElementMethodName(name)) {
      return undefined;
    }

    // Allow the analyzer to analyze within methods
    context.emitContinue?.();

    return [
      {
        jsDoc: getJsDoc(node, ts),
        name,
        node: node,
        visibility: getMemberVisibilityFromNode(node, ts),
        type: () => context.checker.getTypeAtLocation(node),
      },
    ];
  }

  return undefined;
}

function isHTMLElementMethodName(name: string): boolean {
  return [
    "attributeChangedCallback",
    "connectedCallback",
    "disconnectedCallback",
  ].includes(name);
}
