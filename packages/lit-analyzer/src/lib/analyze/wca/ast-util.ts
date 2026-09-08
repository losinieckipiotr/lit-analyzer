import * as tsMod from "typescript";
import {
  Declaration,
  Decorator,
  Identifier,
  InterfaceDeclaration,
  Node,
  PropertyDeclaration,
  PropertySignature,
  SetAccessorDeclaration,
  Symbol,
  SyntaxKind,
  TypeChecker,
} from "typescript";
import { isNamePrivate } from "../util/str-util.js";
import { ModifierKind, VisibilityKind } from "./wca-types.js";

// TODO: refactor with util/ast-util.ts

interface AstContext {
  ts: typeof tsMod;
  checker: TypeChecker;
}

/**
 * Resolves all relevant declarations of a specific node.
 */
export function resolveDeclarations(
  node: Node,
  context: { checker: TypeChecker; ts: typeof tsMod },
): Declaration[] {
  if (node == null) return [];

  const symbol = getSymbol(node, context);
  if (symbol == null) return [];

  return resolveSymbolDeclarations(symbol);
}

/**
 * Returns the symbol of a node.
 * This function follows aliased symbols.
 */
export function getSymbol(
  node: Node,
  context: { checker: TypeChecker; ts: typeof tsMod },
): Symbol | undefined {
  if (node == null) return undefined;
  const { checker, ts } = context;

  // Get the symbol
  let symbol = checker.getSymbolAtLocation(node);

  if (symbol == null) {
    const identifier = getNodeIdentifier(node, context);
    symbol =
      identifier != null ? checker.getSymbolAtLocation(identifier) : undefined;
  }

  // Resolve aliased symbols
  if (symbol != null && isAliasSymbol(symbol, ts)) {
    symbol = checker.getAliasedSymbol(symbol);
    if (symbol == null) return undefined;
  }

  return symbol;
}

/**
 * Resolves the declarations of a symbol. A valueDeclaration is always the first
 * entry in the array.
 */
export function resolveSymbolDeclarations(symbol: Symbol): Declaration[] {
  // Filters all declarations
  const valueDeclaration = symbol.valueDeclaration;
  const declarations = symbol.getDeclarations() || [];

  if (valueDeclaration == null) {
    return declarations;
  } else {
    // Make sure that "valueDeclaration" is always the first entry
    return [
      valueDeclaration,
      ...declarations.filter((decl) => decl !== valueDeclaration),
    ];
  }
}

/**
 * Resolve a declaration by trying to find the real value by following
 * assignments.
 */
export function resolveDeclarationsDeep(
  node: Node,
  context: { checker: TypeChecker; ts: typeof tsMod },
): Node[] {
  const declarations: Node[] = [];
  const allDeclarations = resolveDeclarations(node, context);

  for (const declaration of allDeclarations) {
    if (
      context.ts.isVariableDeclaration(declaration) &&
      declaration.initializer != null &&
      context.ts.isIdentifier(declaration.initializer)
    ) {
      declarations.push(
        ...resolveDeclarationsDeep(declaration.initializer, context),
      );
    } else if (
      context.ts.isTypeAliasDeclaration(declaration) &&
      declaration.type != null &&
      context.ts.isIdentifier(declaration.type)
    ) {
      declarations.push(...resolveDeclarationsDeep(declaration.type, context));
    } else {
      declarations.push(declaration);
    }
  }

  return declarations;
}

/**
 * Returns if the symbol has "alias" flag.
 */
function isAliasSymbol(symbol: Symbol, ts: typeof tsMod): boolean {
  return hasFlag(symbol.flags, ts.SymbolFlags.Alias);
}

/**
 * Returns a set of modifiers on a node.
 */
export function getModifiersFromNode(
  node: Node,
  ts: typeof tsMod,
): Set<ModifierKind> | undefined {
  const modifiers: Set<ModifierKind> = new Set();

  if (hasModifier(node, ts.SyntaxKind.ReadonlyKeyword, ts)) {
    modifiers.add("readonly");
  }

  if (hasModifier(node, ts.SyntaxKind.StaticKeyword, ts)) {
    modifiers.add("static");
  }

  if (ts.isGetAccessor(node)) {
    modifiers.add("readonly");
  }

  return modifiers.size > 0 ? modifiers : undefined;
}

/**
 * Returns if a number has a flag.
 */
function hasFlag(num: number, flag: number): boolean {
  return (num & flag) !== 0;
}

/**
 * Returns if a node has a specific modifier.
 */
export function hasModifier(
  node: Node,
  modifierKind: SyntaxKind,
  ts: typeof tsMod,
): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  if (modifiers == null) return false;
  return (
    (node.modifiers || []).find(
      (modifier) => modifier.kind === (modifierKind as unknown),
    ) != null
  );
}

/**
 * Returns the visibility of a node
 */
export function getMemberVisibilityFromNode(
  node: PropertyDeclaration | PropertySignature | SetAccessorDeclaration | Node,
  ts: typeof tsMod,
): VisibilityKind | undefined {
  if (
    hasModifier(node, ts.SyntaxKind.PrivateKeyword, ts) ||
    ("name" in node &&
      ts.isIdentifier(node.name) &&
      isNamePrivate(node.name.text))
  ) {
    return "private";
  } else if (hasModifier(node, ts.SyntaxKind.ProtectedKeyword, ts)) {
    return "protected";
  } else if (getNodeSourceFileLang(node) === "ts") {
    // Only return "public" in typescript land
    return "public";
  }

  return undefined;
}

/**
 * Returns all keys and corresponding interface/class declarations for keys in
 * an interface.
 */
export function getInterfaceKeys(
  interfaceDeclaration: InterfaceDeclaration,
  context: AstContext,
): { key: string; keyNode: Node; identifier?: Node; declaration?: Node }[] {
  const extensions: {
    key: string;
    keyNode: Node;
    identifier?: Node;
    declaration?: Node;
  }[] = [];

  const { ts } = context;

  for (const member of interfaceDeclaration.members) {
    // { "my-button": MyButton; }
    if (ts.isPropertySignature(member) && member.type != null) {
      const resolvedKey = resolveNodeValue(member.name, context);
      if (resolvedKey == null) {
        continue;
      }

      let identifier: Node | undefined;
      let declaration: Node | undefined;
      if (ts.isTypeReferenceNode(member.type)) {
        // { ____: MyButton; } or { ____: namespace.MyButton; }
        identifier = member.type.typeName;
      } else if (ts.isTypeLiteralNode(member.type)) {
        identifier = undefined;
        declaration = member.type;
      } else {
        continue;
      }

      if (declaration != null || identifier != null) {
        extensions.push({
          key: String(resolvedKey.value),
          keyNode: resolvedKey.node,
          declaration,
          identifier,
        });
      }
    }
  }

  return extensions;
}

/**
 * Find a node recursively walking down the children of the tree. Depth first
 * search.
 */
export function findChild<T extends Node = Node>(
  node: Node | undefined,
  test: (node: Node) => node is T,
): T | undefined {
  if (!node) return;
  if (test(node)) return node;
  return node.forEachChild((child) => findChild(child, test));
}

/**
 * Find multiple children by walking down the children of the tree. Depth first
 * search.
 */
export function findChildren<T extends Node = Node>(
  node: Node | undefined,
  test: (node: Node) => node is T,
  emit: (node: T) => void,
): void {
  if (!node) return;
  if (test(node)) {
    emit(node);
  }
  node.forEachChild((child) => findChildren(child, test, emit));
}

/**
 * Returns the language of the node's source file
 * @param node
 */
export function getNodeSourceFileLang(node: Node): "js" | "ts" {
  return node.getSourceFile().fileName.endsWith("ts") ? "ts" : "js";
}

/**
 * Returns the leading comment for a given node.
 */
export function getLeadingCommentForNode(
  node: Node,
  ts: typeof tsMod,
): string | undefined {
  const sourceFileText = node.getSourceFile().text;

  const leadingComments = ts.getLeadingCommentRanges(sourceFileText, node.pos);

  if (leadingComments != null && leadingComments.length > 0) {
    return sourceFileText.substring(
      leadingComments[0].pos,
      leadingComments[0].end,
    );
  }

  return undefined;
}

/**
 * Returns the declaration name of a given node if possible.
 */
export function getNodeName(
  node: Node,
  context: { ts: typeof tsMod },
): string | undefined {
  return getNodeIdentifier(node, context)?.getText();
}

/**
 * Returns the declaration name of a given node if possible.
 */
export function getNodeIdentifier(
  node: Node,
  context: { ts: typeof tsMod },
): Identifier | undefined {
  const { ts } = context;

  if (ts.isIdentifier(node)) {
    return node;
  } else if (
    (ts.isClassLike(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isVariableDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isFunctionDeclaration(node)) &&
    node.name != null &&
    ts.isIdentifier(node.name)
  ) {
    return node.name;
  }

  return undefined;
}

/**
 * Returns all decorators in either the node's `decorators` or `modifiers`.
 */
export function getDecorators(
  node: Node,
  context: { ts: typeof tsMod },
): ReadonlyArray<Decorator> {
  const { ts } = context;

  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

interface Context {
  ts: typeof tsMod;
  checker?: TypeChecker;
  depth?: number;
  strict?: boolean;
}

/**
 * Takes a node and tries to resolve a constant value from it.
 * Returns undefined if no constant value can be resolved.
 */
export function resolveNodeValue(
  node: Node | undefined,
  context: Context,
): { value: unknown; node: Node } | undefined {
  if (node == null) return undefined;

  const { ts, checker } = context;
  const depth = (context.depth || 0) + 1;

  // Always break when depth is larger than 10.
  // This ensures we cannot run into infinite recursion.
  if (depth > 10) return undefined;

  if (ts.isStringLiteralLike(node)) {
    return { value: node.text, node };
  } else if (ts.isNumericLiteral(node)) {
    return { value: Number(node.text), node };
  } else if (ts.isPrefixUnaryExpression(node)) {
    const value = resolveNodeValue(node.operand, { ...context, depth })?.value;
    return {
      value: applyPrefixUnaryOperatorToValue(value, node.operator, ts),
      node,
    };
  } else if (ts.isObjectLiteralExpression(node)) {
    const object: Record<string, unknown> = {};

    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        // Resolve the "key"
        const name =
          resolveNodeValue(prop.name, { ...context, depth })?.value ||
          prop.name.getText();

        // Resolve the "value
        const resolvedValue = resolveNodeValue(prop.initializer, {
          ...context,
          depth,
        });
        if (resolvedValue != null && typeof name === "string") {
          object[name] = resolvedValue.value;
        }
      }
    }

    return {
      value: object,
      node,
    };
  } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { value: true, node };
  } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { value: false, node };
  } else if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { value: null, node };
  } else if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { value: undefined, node };
  }

  // Resolve initializers for variable declarations
  if (ts.isVariableDeclaration(node)) {
    return resolveNodeValue(node.initializer, { ...context, depth });
  }

  // Resolve value of a property access expression. For example: MyEnum.RED
  else if (ts.isPropertyAccessExpression(node)) {
    return resolveNodeValue(node.name, { ...context, depth });
  }

  // Resolve [expression] parts of {[expression]: "value"}
  else if (ts.isComputedPropertyName(node)) {
    return resolveNodeValue(node.expression, { ...context, depth });
  }

  // Resolve initializer value of enum members.
  else if (ts.isEnumMember(node)) {
    if (node.initializer != null) {
      return resolveNodeValue(node.initializer, { ...context, depth });
    } else {
      return { value: `${node.parent.name.text}.${node.name.getText()}`, node };
    }
  }

  // Resolve values of variables.
  else if (ts.isIdentifier(node) && checker != null) {
    const declarations = resolveDeclarations(node, { checker, ts });
    if (declarations.length > 0) {
      const resolved = resolveNodeValue(declarations[0], { ...context, depth });
      if (context.strict || resolved != null) {
        return resolved;
      }
    }

    if (context.strict) {
      return undefined;
    }

    return { value: node.getText(), node };
  }

  // Fallthrough
  //  - "my-value" as string
  //  - <any>"my-value"
  //  - ("my-value")
  else if (
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return resolveNodeValue(node.expression, { ...context, depth });
  }

  // static get is() {
  //    return "my-element";
  // }
  else if (
    (ts.isGetAccessor(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isFunctionDeclaration(node)) &&
    node.body != null
  ) {
    for (const stm of node.body.statements) {
      if (ts.isReturnStatement(stm)) {
        return resolveNodeValue(stm.expression, { ...context, depth });
      }
    }
  }

  // [1, 2]
  else if (ts.isArrayLiteralExpression(node)) {
    return {
      node,
      value: node.elements.map(
        (el) => resolveNodeValue(el, { ...context, depth })?.value,
      ),
    };
  }

  if (ts.isTypeAliasDeclaration(node)) {
    return resolveNodeValue(node.type, { ...context, depth });
  }

  if (ts.isLiteralTypeNode(node)) {
    return resolveNodeValue(node.literal, { ...context, depth });
  }

  if (ts.isTypeReferenceNode(node)) {
    return resolveNodeValue(node.typeName, { ...context, depth });
  }

  return undefined;
}

function applyPrefixUnaryOperatorToValue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  operator: SyntaxKind,
  ts: typeof tsMod,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (typeof value === "object" && value != null) {
    return value;
  }

  switch (operator) {
    case ts.SyntaxKind.MinusToken:
      return -value;
    case ts.SyntaxKind.ExclamationToken:
      return !value;
    case ts.SyntaxKind.PlusToken:
      return +value;
  }

  return value;
}
