import * as tsModule from "typescript";
import {
  BigIntLiteralType,
  Declaration,
  Symbol as ESSymbol,
  GenericType,
  LiteralType,
  Node,
  ObjectType,
  Program,
  Signature,
  SignatureDeclaration,
  Symbol,
  TupleTypeReference,
  Type,
  TypeChecker,
  TypeFlags,
  TypeReference,
  UniqueESSymbolType
} from "typescript";

const DEFAULT_TYPE_CACHE = new WeakMap<Type, SimpleType>();

let selectedTSModule = tsModule;

export type SimpleTypeModifierKind =
  | "EXPORT"
  | "AMBIENT"
  | "PUBLIC"
  | "PRIVATE"
  | "PROTECTED"
  | "STATIC"
  | "READONLY"
  | "ABSTRACT"
  | "ASYNC"
  | "DEFAULT";

// TODO: remove not needed kinds
export enum SimpleTypeKind {
  STRING_LITERAL = "STRING_LITERAL",
  NUMBER_LITERAL = "NUMBER_LITERAL",
  BOOLEAN_LITERAL = "BOOLEAN_LITERAL",
  BIG_INT_LITERAL = "BIG_INT_LITERAL",
  ES_SYMBOL_UNIQUE = "ES_SYMBOL_UNIQUE",
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  BIG_INT = "BIG_INT",
  ES_SYMBOL = "ES_SYMBOL",
  NULL = "NULL",
  UNDEFINED = "UNDEFINED",
  VOID = "VOID",
  NEVER = "NEVER",
  ANY = "ANY",
  UNKNOWN = "UNKNOWN",
  ENUM = "ENUM",
  ENUM_MEMBER = "ENUM_MEMBER",
  NON_PRIMITIVE = "NON_PRIMITIVE",
  UNION = "UNION",
  INTERSECTION = "INTERSECTION",
  INTERFACE = "INTERFACE",
  OBJECT = "OBJECT",
  CLASS = "CLASS",
  FUNCTION = "FUNCTION",
  METHOD = "METHOD",
  GENERIC_ARGUMENTS = "GENERIC_ARGUMENTS",
  GENERIC_PARAMETER = "GENERIC_PARAMETER",
  ALIAS = "ALIAS",
  TUPLE = "TUPLE",
  ARRAY = "ARRAY",
  DATE = "DATE",
  PROMISE = "PROMISE"
}

const LITERAL_TYPE_KINDS: SimpleTypeKind[] = [
  SimpleTypeKind.NUMBER_LITERAL,
  SimpleTypeKind.STRING_LITERAL,
  SimpleTypeKind.BIG_INT_LITERAL,
  SimpleTypeKind.BOOLEAN_LITERAL,
  SimpleTypeKind.ES_SYMBOL_UNIQUE
];

export const PRIMITIVE_TYPE_KINDS: SimpleTypeKind[] = [
  ...LITERAL_TYPE_KINDS,
  SimpleTypeKind.BIG_INT,
  SimpleTypeKind.BOOLEAN,
  SimpleTypeKind.NULL,
  SimpleTypeKind.UNDEFINED,
  SimpleTypeKind.VOID,
  SimpleTypeKind.ES_SYMBOL,
  SimpleTypeKind.NUMBER,
  SimpleTypeKind.STRING
];

const SIMPLE_TYPE_KINDS = Object.values(SimpleTypeKind) as SimpleTypeKind[];

//#region Interfaces

export interface SimpleTypeBase {
  kind: SimpleTypeKind;
  name?: string;
}

interface SimpleTypeBigIntLiteral extends SimpleTypeBase {
  kind: SimpleTypeKind.BIG_INT_LITERAL;
  value: bigint;
}

export interface SimpleTypeString extends SimpleTypeBase {
  kind: SimpleTypeKind.STRING;
}

export interface SimpleTypeStringLiteral extends SimpleTypeBase {
  kind: SimpleTypeKind.STRING_LITERAL;
  value: string;
}

export interface SimpleTypeNumberLiteral extends SimpleTypeBase {
  kind: SimpleTypeKind.NUMBER_LITERAL;
  value: number;
}

export interface SimpleTypeBooleanLiteral extends SimpleTypeBase {
  kind: SimpleTypeKind.BOOLEAN_LITERAL;
  value: boolean;
}

interface SimpleTypeNumber extends SimpleTypeBase {
  kind: SimpleTypeKind.NUMBER;
}

interface SimpleTypeBoolean extends SimpleTypeBase {
  kind: SimpleTypeKind.BOOLEAN;
}

interface SimpleTypeBigInt extends SimpleTypeBase {
  kind: SimpleTypeKind.BIG_INT;
}

interface SimpleTypeESSymbol extends SimpleTypeBase {
  kind: SimpleTypeKind.ES_SYMBOL;
}

interface SimpleTypeESSymbolUnique extends SimpleTypeBase {
  kind: SimpleTypeKind.ES_SYMBOL_UNIQUE;
  value: string;
}

interface SimpleTypeNull extends SimpleTypeBase {
  kind: SimpleTypeKind.NULL;
}

export interface SimpleTypeNever extends SimpleTypeBase {
  kind: SimpleTypeKind.NEVER;
}

interface SimpleTypeUndefined extends SimpleTypeBase {
  kind: SimpleTypeKind.UNDEFINED;
}

export interface SimpleTypeAny extends SimpleTypeBase {
  kind: SimpleTypeKind.ANY;
}

interface SimpleTypeUnknown extends SimpleTypeBase {
  kind: SimpleTypeKind.UNKNOWN;
}

interface SimpleTypeVoid extends SimpleTypeBase {
  kind: SimpleTypeKind.VOID;
}

interface SimpleTypeNonPrimitive extends SimpleTypeBase {
  kind: SimpleTypeKind.NON_PRIMITIVE;
}

export interface SimpleTypeTuple extends SimpleTypeBase {
  kind: SimpleTypeKind.TUPLE;
  members: SimpleTypeMember[];
  rest?: boolean;
}

interface SimpleTypeArray extends SimpleTypeBase {
  kind: SimpleTypeKind.ARRAY;
  type: SimpleType;
}

interface SimpleTypeMember {
  optional: boolean;
  type: SimpleType;
  modifiers?: SimpleTypeModifierKind[];
}

export interface SimpleTypeMemberNamed extends SimpleTypeMember {
  name: string;
}

export type SimpleTypeFunctionParameter = {
  name: string;
  type: SimpleType;
  optional: boolean;
  rest: boolean;
  initializer: boolean;
};

interface SimpleTypeFunction extends SimpleTypeBase {
  kind: SimpleTypeKind.FUNCTION;
  parameters?: SimpleTypeFunctionParameter[];
  typeParameters?: SimpleTypeGenericParameter[];
  returnType?: SimpleType;
}

interface SimpleTypeMethod extends SimpleTypeBase {
  kind: SimpleTypeKind.METHOD;
  parameters: SimpleTypeFunctionParameter[];
  typeParameters?: SimpleTypeGenericParameter[];
  returnType: SimpleType;
}

export interface SimpleTypeObjectTypeBase extends SimpleTypeBase {
  members?: SimpleTypeMemberNamed[];
  ctor?: SimpleTypeFunction;
  call?: SimpleTypeFunction;
  typeParameters?: SimpleTypeGenericParameter[];
  indexType?: {
    ["STRING"]?: SimpleType;
    ["NUMBER"]?: SimpleType;
  };
}

interface SimpleTypeInterface extends SimpleTypeObjectTypeBase {
  kind: SimpleTypeKind.INTERFACE;
}

interface SimpleTypeClass extends SimpleTypeObjectTypeBase {
  kind: SimpleTypeKind.CLASS;
}

export interface SimpleTypeObject extends SimpleTypeObjectTypeBase {
  kind: SimpleTypeKind.OBJECT;
}

export interface SimpleTypeUnion extends SimpleTypeBase {
  kind: SimpleTypeKind.UNION;
  types: SimpleType[];
}

export interface SimpleTypeIntersection extends SimpleTypeBase {
  kind: SimpleTypeKind.INTERSECTION;
  types: SimpleType[];
}

export interface SimpleTypeEnumMember extends SimpleTypeBase {
  kind: SimpleTypeKind.ENUM_MEMBER;
  fullName: string;
  name: string;
  type: SimpleTypePrimitive;
}

interface SimpleTypeEnum extends SimpleTypeBase {
  name: string;
  kind: SimpleTypeKind.ENUM;
  types: SimpleTypeEnumMember[];
}

interface SimpleTypeDate extends SimpleTypeBase {
  kind: SimpleTypeKind.DATE;
}

interface SimpleTypePromise extends SimpleTypeBase {
  kind: SimpleTypeKind.PROMISE;
  type: SimpleType;
}

export interface SimpleTypeAlias extends SimpleTypeBase {
  kind: SimpleTypeKind.ALIAS;
  name: string;
  target: SimpleType;
  typeParameters?: SimpleTypeGenericParameter[];
}

export interface SimpleTypeGenericParameter extends SimpleTypeBase {
  name: string;
  kind: SimpleTypeKind.GENERIC_PARAMETER;
  default?: SimpleType;
}

export interface SimpleTypeGenericArguments extends SimpleTypeBase {
  kind: SimpleTypeKind.GENERIC_ARGUMENTS;
  name?: undefined;
  target: SimpleType;
  typeArguments: SimpleType[];
}

//#endregion

//#region SimpleType

export type SimpleTypeLiteral =
  | SimpleTypeBigIntLiteral
  | SimpleTypeBooleanLiteral
  | SimpleTypeStringLiteral
  | SimpleTypeNumberLiteral
  | SimpleTypeESSymbolUnique;

type SimpleTypePrimitive =
  | SimpleTypeLiteral
  | SimpleTypeString
  | SimpleTypeNumber
  | SimpleTypeBoolean
  | SimpleTypeBigInt
  | SimpleTypeNull
  | SimpleTypeUndefined
  | SimpleTypeESSymbol;

export type SimpleType =
  | SimpleTypePrimitive
  | SimpleTypeNonPrimitive
  | SimpleTypeVoid
  | SimpleTypeNever
  | SimpleTypeAny
  | SimpleTypeFunction
  | SimpleTypeMethod
  | SimpleTypeUnknown
  | SimpleTypeTuple
  | SimpleTypeArray
  | SimpleTypeInterface
  | SimpleTypeClass
  | SimpleTypeObject
  | SimpleTypeUnion
  | SimpleTypeIntersection
  | SimpleTypeEnum
  | SimpleTypeEnumMember
  | SimpleTypeAlias
  | SimpleTypeGenericArguments
  | SimpleTypeGenericParameter
  | SimpleTypeDate
  | SimpleTypePromise;

//#endregion

//#region Constants
const SIMPLE_TYPE_STRING: SimpleTypeString = {
  kind: SimpleTypeKind.STRING
};

const SIMPLE_TYPE_STRING_LITERAL: SimpleTypeStringLiteral = {
  kind: SimpleTypeKind.STRING_LITERAL,
  value: ""
};

const SIMPLE_TYPE_NUMBER: SimpleTypeNumber = {
  kind: SimpleTypeKind.NUMBER
};

const SIMPLE_TYPE_BOOLEAN: SimpleTypeBoolean = {
  kind: SimpleTypeKind.BOOLEAN
};

const SIMPLE_TYPE_NULL: SimpleTypeNull = {
  kind: SimpleTypeKind.NULL
};

const SIMPLE_TYPE_UNDEFINED: SimpleTypeUndefined = {
  kind: SimpleTypeKind.UNDEFINED
};

const SIMPLE_TYPE_ANY: SimpleTypeAny = { kind: SimpleTypeKind.ANY };

const SIMPLE_TYPE_ARRAY: SimpleTypeArray = {
  kind: SimpleTypeKind.ARRAY,
  type: SIMPLE_TYPE_ANY
};

const SIMPLE_TYPE_OBJECT: SimpleTypeObject = {
  kind: SimpleTypeKind.OBJECT,
  members: []
};

// TODO: probably not needed
Object.freeze(SIMPLE_TYPE_STRING);
Object.freeze(SIMPLE_TYPE_STRING_LITERAL);
Object.freeze(SIMPLE_TYPE_NUMBER);
Object.freeze(SIMPLE_TYPE_BOOLEAN);
Object.freeze(SIMPLE_TYPE_NULL);
Object.freeze(SIMPLE_TYPE_UNDEFINED);
Object.freeze(SIMPLE_TYPE_ANY);
Object.freeze(SIMPLE_TYPE_ARRAY);
Object.freeze(SIMPLE_TYPE_OBJECT);

export const SIMPLE_TYPES = {
  STRING: SIMPLE_TYPE_STRING,
  STRING_LITERAL: SIMPLE_TYPE_STRING_LITERAL,
  NUMBER: SIMPLE_TYPE_NUMBER,
  BOOLEAN: SIMPLE_TYPE_BOOLEAN,
  NULL: SIMPLE_TYPE_NULL,
  UNDEFINED: SIMPLE_TYPE_UNDEFINED,
  ANY: SIMPLE_TYPE_ANY,
  ARRAY: SIMPLE_TYPE_ARRAY,
  OBJECT: SIMPLE_TYPE_OBJECT
} as const;

//#endregion

//#region utils

export function or<T>(
  list: T[],
  match: (arg: T, i: number) => boolean
): boolean {
  return list.find((a, i) => match(a, i)) != null;
}

export function and<T>(
  list: T[],
  match: (arg: T, i: number) => boolean
): boolean {
  return list.find((a, i) => !match(a, i)) == null;
}

export function isTypeChecker(obj: unknown): obj is TypeChecker {
  return (
    obj != null && typeof obj === "object" && "getSymbolAtLocation" in obj!
  );
}

export function isProgram(obj: unknown): obj is Program {
  return (
    obj != null &&
    typeof obj === "object" &&
    "getTypeChecker" in obj! &&
    "getCompilerOptions" in obj!
  );
}

export function isNode(obj: unknown): obj is Node {
  return (
    obj != null &&
    typeof obj === "object" &&
    "kind" in obj! &&
    "flags" in obj! &&
    "pos" in obj! &&
    "end" in obj!
  );
}

function typeHasFlag(
  type: Type,
  flag: TypeFlags | TypeFlags[],
  op: "and" | "or" = "and"
): boolean {
  return hasFlag(type.flags, flag, op);
}

function hasFlag(
  flags: number,
  flag: number | number[],
  op: "and" | "or" = "and"
): boolean {
  if (Array.isArray(flag)) {
    return (op === "and" ? and : or)(flag, f => hasFlag(flags, f));
  }

  return (flags & flag) !== 0;
}

function isBoolean(type: Type, ts: typeof tsModule) {
  return (
    typeHasFlag(type, ts.TypeFlags.BooleanLike) ||
    type.symbol?.name === "Boolean"
  );
}

function isBooleanLiteral(
  type: Type,
  ts: typeof tsModule
): type is LiteralType {
  return typeHasFlag(type, ts.TypeFlags.BooleanLiteral);
}

function isBigIntLiteral(
  type: Type,
  ts: typeof tsModule
): type is BigIntLiteralType {
  return typeHasFlag(type, ts.TypeFlags.BigIntLiteral);
}

function isUniqueESSymbol(
  type: Type,
  ts: typeof tsModule
): type is UniqueESSymbolType {
  return typeHasFlag(type, ts.TypeFlags.UniqueESSymbol);
}

function isESSymbolLike(type: Type, ts: typeof tsModule) {
  return (
    typeHasFlag(type, ts.TypeFlags.ESSymbolLike) ||
    type.symbol?.name === "Symbol"
  );
}

function isLiteral(type: Type, ts: typeof tsModule): type is LiteralType {
  return (
    type.isLiteral() ||
    isBooleanLiteral(type, ts) ||
    isBigIntLiteral(type, ts) ||
    isUniqueESSymbol(type, ts)
  );
}

function isString(type: Type, ts: typeof tsModule) {
  return (
    typeHasFlag(type, ts.TypeFlags.StringLike) || type.symbol?.name === "String"
  );
}

function isNumber(type: Type, ts: typeof tsModule) {
  return (
    typeHasFlag(type, ts.TypeFlags.NumberLike) || type.symbol?.name === "Number"
  );
}

// TODO: remove
// function isAny(type: Type, ts: typeof tsModule) {
// 	return typeHasFlag(type, ts.TypeFlags.Any);
// }

function isEnum(type: Type, ts: typeof tsModule) {
  return typeHasFlag(type, ts.TypeFlags.EnumLike);
}

function isBigInt(type: Type, ts: typeof tsModule) {
  return (
    typeHasFlag(type, ts.TypeFlags.BigIntLike) || type.symbol?.name === "BigInt"
  );
}

function isObject(type: Type, ts: typeof tsModule): type is ObjectType {
  return (
    typeHasFlag(type, ts.TypeFlags.Object) || type.symbol?.name === "Object"
  );
}

function isNonPrimitive(type: Type, ts: typeof tsModule): type is ObjectType {
  return (
    typeHasFlag(type, ts.TypeFlags.NonPrimitive) ||
    type.symbol?.name === "object"
  );
}

function isThisType(type: Type, ts: typeof tsModule): type is ObjectType {
  const kind = type.getSymbol()?.valueDeclaration?.kind;
  if (kind == null) {
    return false;
  }

  return hasFlag(kind, ts.SyntaxKind.ThisKeyword);
}

function isUnknown(type: Type, ts: typeof tsModule) {
  return typeHasFlag(type, ts.TypeFlags.Unknown);
}

function isNull(type: Type, ts: typeof tsModule) {
  return typeHasFlag(type, ts.TypeFlags.Null);
}

function isUndefined(type: Type, ts: typeof tsModule) {
  return typeHasFlag(type, ts.TypeFlags.Undefined);
}

function isVoid(type: Type, ts: typeof tsModule) {
  return typeHasFlag(type, ts.TypeFlags.VoidLike);
}

function isNever(type: Type, ts: typeof tsModule): boolean {
  return typeHasFlag(type, ts.TypeFlags.Never);
}

function isObjectTypeReference(
  type: ObjectType,
  ts: typeof tsModule
): type is TypeReference {
  return hasFlag(type.objectFlags, ts.ObjectFlags.Reference);
}

function isSymbol(obj: object): obj is Symbol {
  return "flags" in obj && "name" in obj && "getDeclarations" in obj;
}

// function isType(obj: object): obj is Type {
// 	return "flags" in obj && "getSymbol" in obj;
// }

function isMethod(type: Type, ts: typeof tsModule): type is TypeReference {
  if (!isObject(type, ts)) return false;
  const symbol = type.getSymbol();
  if (symbol == null) return false;

  return hasFlag(symbol.flags, ts.SymbolFlags.Method);
}

function getDeclaration(
  symbol: Symbol,
  ts: typeof tsModule
): Declaration | undefined {
  const declarations = symbol.getDeclarations();
  if (declarations == null || declarations.length === 0)
    return symbol.valueDeclaration;
  return declarations[0];
}

function isArray(
  type: Type,
  checker: TypeChecker,
  ts: typeof tsModule
): type is TypeReference {
  if (!isObject(type, ts)) return false;
  const symbol = type.getSymbol();
  if (symbol == null) return false;
  return (
    getTypeArguments(type, checker, ts).length === 1 &&
    ["ArrayLike", "ReadonlyArray", "ConcatArray", "Array"].includes(
      symbol.getName()
    )
  );
}

function isPromise(
  type: Type,
  checker: TypeChecker,
  ts: typeof tsModule
): type is TypeReference {
  if (!isObject(type, ts)) return false;
  const symbol = type.getSymbol();
  if (symbol == null) return false;
  return (
    getTypeArguments(type, checker, ts).length === 1 &&
    ["PromiseLike", "Promise"].includes(symbol.getName())
  );
}

function isDate(type: Type, ts: typeof tsModule): type is ObjectType {
  if (!isObject(type, ts)) return false;
  const symbol = type.getSymbol();
  if (symbol == null) return false;
  return symbol.getName() === "Date";
}

function isTupleTypeReference(
  type: Type,
  ts: typeof tsModule
): type is TupleTypeReference {
  const target = getTargetType(type, ts);
  if (target == null) return false;
  return (target.objectFlags & ts.ObjectFlags.Tuple) !== 0;
}

function isFunction(type: Type, ts: typeof tsModule): type is ObjectType {
  if (!isObject(type, ts)) return false;
  const symbol = type.getSymbol();
  if (symbol == null) return false;
  return (
    (symbol.flags & ts.SymbolFlags.Function) !== 0 ||
    symbol.escapedName === "Function" ||
    (symbol.members != null && symbol.members.has("__call" as never))
  );
}

function getTypeArguments(
  type: ObjectType,
  checker: TypeChecker,
  ts: typeof tsModule
): Type[] {
  if (isObject(type, ts)) {
    if (isObjectTypeReference(type, ts)) {
      if ("getTypeArguments" in checker) {
        return Array.from(checker.getTypeArguments(type) || []);
      } else {
        return Array.from(type.typeArguments || []);
      }
    }
  }

  return [];
}

function getTargetType(
  type: Type,
  ts: typeof tsModule
): GenericType | undefined {
  if (isObject(type, ts) && isObjectTypeReference(type, ts)) {
    return type.target;
  }

  return undefined;
}

function getModifiersFromDeclaration(
  declaration: Declaration,
  ts: typeof tsModule
): SimpleTypeModifierKind[] {
  const tsModifiers = ts.getCombinedModifierFlags(declaration);
  const modifiers: SimpleTypeModifierKind[] = [];

  const map: Record<number, SimpleTypeModifierKind> = {
    [ts.ModifierFlags.Export]: "EXPORT",
    [ts.ModifierFlags.Ambient]: "AMBIENT",
    [ts.ModifierFlags.Public]: "PUBLIC",
    [ts.ModifierFlags.Private]: "PRIVATE",
    [ts.ModifierFlags.Protected]: "PROTECTED",
    [ts.ModifierFlags.Static]: "STATIC",
    [ts.ModifierFlags.Readonly]: "READONLY",
    [ts.ModifierFlags.Abstract]: "ABSTRACT",
    [ts.ModifierFlags.Async]: "ASYNC",
    [ts.ModifierFlags.Default]: "DEFAULT"
  };

  Object.entries(map).forEach(([tsModifier, modifierKind]) => {
    if ((tsModifiers & Number(tsModifier)) !== 0) {
      modifiers.push(modifierKind);
    }
  });

  return modifiers;
}

function isImplicitGeneric(
  type: Type,
  checker: TypeChecker,
  ts: typeof tsModule
): boolean {
  return (
    isArray(type, checker, ts) ||
    isTupleTypeReference(type, ts) ||
    isPromise(type, checker, ts)
  );
}

function isMethodSignature(type: Type, ts: typeof tsModule): boolean {
  const symbol = type.getSymbol();
  if (symbol == null) return false;
  if (!isObject(type, ts)) return false;
  if (type.getCallSignatures().length === 0) return false;

  const decl = getDeclaration(symbol, ts);
  if (decl == null) return false;
  return decl.kind === ts.SyntaxKind.MethodSignature;
}

//#endregion

//#region Functions

export function isSimpleTypeLiteral(
  type: SimpleType
): type is SimpleTypeLiteral {
  return LITERAL_TYPE_KINDS.includes(type.kind);
}

export function isSimpleType(type: unknown): type is SimpleType {
  if (typeof type === "object" && type) {
    const { kind } = type as { kind: SimpleTypeKind };

    if (kind) {
      return SIMPLE_TYPE_KINDS.includes(kind);
    }
  }

  return false;
}

export function isSimpleTypePrimitive(
  type: SimpleType
): type is SimpleTypePrimitive {
  return PRIMITIVE_TYPE_KINDS.includes(type.kind);
}

interface ToSimpleTypeInternalOptions {
  cache: WeakMap<Type, SimpleType>;
  checker: TypeChecker;
  ts: typeof tsModule;
  eager?: boolean;
}

function getRealSymbolName(
  symbol: ESSymbol,
  ts: typeof tsModule
): string | undefined {
  const name = symbol.getName();
  if (
    name != null &&
    [
      ts.InternalSymbolName.Type,
      ts.InternalSymbolName.Object,
      ts.InternalSymbolName.Function
    ].includes(name as never)
  ) {
    return undefined;
  }

  return name;
}

function getTypeParameters(
  obj: ESSymbol | Declaration | undefined,
  options: ToSimpleTypeInternalOptions
): SimpleTypeGenericParameter[] | undefined {
  if (obj == null) return undefined;

  if (isSymbol(obj)) {
    const decl = getDeclaration(obj, options.ts);
    return getTypeParameters(decl, options);
  }

  if (
    options.ts.isClassDeclaration(obj) ||
    options.ts.isFunctionDeclaration(obj) ||
    options.ts.isFunctionTypeNode(obj) ||
    options.ts.isTypeAliasDeclaration(obj) ||
    options.ts.isMethodDeclaration(obj) ||
    options.ts.isMethodSignature(obj)
  ) {
    return obj.typeParameters == null
      ? undefined
      : Array.from(obj.typeParameters)
          .map(td => options.checker.getTypeAtLocation(td))
          .map(
            t =>
              toSimpleTypeCached(
                t,
                options
              ) as unknown as SimpleTypeGenericParameter
          );
  }

  return undefined;
}

/**
 * Tries to lift a potential generic type and wrap the result in a "GENERIC_ARGUMENTS" simple type and/or "ALIAS" type.
 * Returns the "simpleType" otherwise.
 * @param simpleType
 * @param type
 * @param options
 */
function liftGenericType(
  type: Type,
  options: ToSimpleTypeInternalOptions
): { generic: (target: SimpleType) => SimpleType; target: Type } | undefined {
  // Check for alias reference
  if (type.aliasSymbol != null) {
    const aliasDeclaration = getDeclaration(type.aliasSymbol, options.ts);
    const typeParameters = getTypeParameters(aliasDeclaration, options);

    return {
      target: type,
      generic: target => {
        // Lift the simple type to an ALIAS type.
        const aliasType: SimpleTypeAlias = {
          kind: SimpleTypeKind.ALIAS,
          name: type.aliasSymbol!.getName() || "",
          target,
          typeParameters
        };

        // Lift the alias type if it uses generic arguments.
        if (type.aliasTypeArguments != null) {
          const typeArguments = Array.from(type.aliasTypeArguments || []).map(
            t => toSimpleTypeCached(t, options)
          );

          return {
            kind: SimpleTypeKind.GENERIC_ARGUMENTS,
            target: aliasType,
            typeArguments
          };
        }

        return target;
      }
    };
  }

  // Check if the type is a generic interface/class reference and lift it.
  else if (
    isObject(type, options.ts) &&
    isObjectTypeReference(type, options.ts) &&
    type.typeArguments != null &&
    type.typeArguments.length > 0
  ) {
    // Special case for array, tuple and promise, they are generic in themselves
    if (isImplicitGeneric(type, options.checker, options.ts)) {
      return undefined;
    }

    return {
      target: type.target,
      generic: target => {
        const typeArguments = Array.from(type.typeArguments || []).map(t =>
          toSimpleTypeCached(t, options)
        );

        return {
          kind: SimpleTypeKind.GENERIC_ARGUMENTS,
          target,
          typeArguments
        };
      }
    };
  }

  return undefined;
}

function primitiveLiteralToSimpleType(
  type: Type,
  checker: TypeChecker,
  ts: typeof tsModule
): SimpleTypeLiteral | undefined {
  if (type.isNumberLiteral()) {
    return {
      kind: SimpleTypeKind.NUMBER_LITERAL,
      value: type.value
    };
  } else if (type.isStringLiteral()) {
    return {
      kind: SimpleTypeKind.STRING_LITERAL,
      value: type.value
    };
  } else if (isBooleanLiteral(type, ts)) {
    // See https://github.com/Microsoft/TypeScript/issues/22269 for more information
    return {
      kind: SimpleTypeKind.BOOLEAN_LITERAL,
      value: checker.typeToString(type) === "true"
    };
  } else if (isBigIntLiteral(type, ts)) {
    return {
      kind: SimpleTypeKind.BIG_INT_LITERAL,
      /* global BigInt */
      value: BigInt(
        `${type.value.negative ? "-" : ""}${type.value.base10Value}`
      )
    };
  } else if (isUniqueESSymbol(type, ts)) {
    return {
      kind: SimpleTypeKind.ES_SYMBOL_UNIQUE,
      value:
        String(type.escapedName) ||
        Math.floor(Math.random() * 100000000).toString()
    };
  }

  return undefined;
}

function simplifySimpleTypes(types: SimpleType[]): SimpleType[] {
  let newTypes: SimpleType[] = [...types];
  const NULLABLE_TYPE_KINDS = ["UNDEFINED", "NULL"];

  // Only include one instance of primitives and literals
  newTypes = newTypes.filter((type, i) => {
    // Only include one of each literal with specific value
    if (isSimpleTypeLiteral(type)) {
      return !newTypes
        .slice(0, i)
        .some(
          newType => newType.kind === type.kind && newType.value === type.value
        );
    }

    if (
      PRIMITIVE_TYPE_KINDS.includes(type.kind) ||
      NULLABLE_TYPE_KINDS.includes(type.kind)
    ) {
      // Remove this type from the array if there is already a primitive in the array
      return !newTypes.slice(0, i).some(t => t.kind === type.kind);
    }

    return true;
  });

  // Simplify boolean literals
  const booleanLiteralTypes = newTypes.filter(
    (t): t is SimpleTypeBooleanLiteral => t.kind === "BOOLEAN_LITERAL"
  );
  if (
    booleanLiteralTypes.find(t => t.value === true) != null &&
    booleanLiteralTypes.find(t => t.value === false) != null
  ) {
    newTypes = [
      ...newTypes.filter(type => type.kind !== SimpleTypeKind.BOOLEAN_LITERAL),
      { kind: SimpleTypeKind.BOOLEAN }
    ];
  }

  // Reorder "NULL" and "UNDEFINED" to be last
  const nullableTypes = newTypes.filter(
    (t): t is SimpleTypeUndefined | SimpleTypeNull =>
      NULLABLE_TYPE_KINDS.includes(t.kind)
  );
  if (nullableTypes.length > 0) {
    newTypes = [
      ...newTypes.filter(t => !NULLABLE_TYPE_KINDS.includes(t.kind)),
      ...nullableTypes.sort((t1, t2) =>
        t1.kind === "NULL"
          ? t2.kind === "UNDEFINED"
            ? -1
            : 0
          : t2.kind === "NULL"
            ? 1
            : 0
      )
    ];
  }

  return newTypes;
}

function getSimpleFunctionFromSignatureDeclaration(
  signatureDeclaration: SignatureDeclaration,
  options: ToSimpleTypeInternalOptions,
  fallbackName?: string
): SimpleTypeFunction | SimpleTypeMethod | undefined {
  const { checker } = options;

  const symbol = checker.getSymbolAtLocation(signatureDeclaration);

  const parameters = signatureDeclaration.parameters.map(parameterDecl => {
    const argType = checker.getTypeAtLocation(parameterDecl);

    return {
      name: parameterDecl.name.getText() || fallbackName,
      optional: parameterDecl.questionToken != null,
      type: toSimpleTypeCached(argType, options),
      rest: parameterDecl.dotDotDotToken != null,
      initializer: parameterDecl.initializer != null
    } as SimpleTypeFunctionParameter;
  });

  const name = symbol != null ? symbol.getName() : undefined;

  const type = checker.getTypeAtLocation(signatureDeclaration);

  const kind = isMethod(type, options.ts) ? "METHOD" : "FUNCTION";

  const signature = checker.getSignatureFromDeclaration(signatureDeclaration);

  const returnType =
    signature == null
      ? undefined
      : toSimpleTypeCached(
          checker.getReturnTypeOfSignature(signature),
          options
        );

  const typeParameters = getTypeParameters(signatureDeclaration, options);

  return { name, kind, returnType, parameters, typeParameters } as
    SimpleTypeFunction | SimpleTypeMethod;
}

function getSimpleFunctionFromCallSignatures(
  signatures: readonly Signature[],
  options: ToSimpleTypeInternalOptions,
  fallbackName?: string
): SimpleTypeFunction | SimpleTypeMethod | undefined {
  if (signatures.length === 0) {
    return undefined;
  }

  const signature = signatures[signatures.length - 1];

  const signatureDeclaration = signature.getDeclaration();

  return getSimpleFunctionFromSignatureDeclaration(
    signatureDeclaration,
    options,
    fallbackName
  );
}

function toSimpleTypeInternal(
  type: Type,
  options: ToSimpleTypeInternalOptions
): SimpleType {
  const { checker, ts } = options;

  const symbol: ESSymbol | undefined = type.getSymbol();
  const name = symbol != null ? getRealSymbolName(symbol, ts) : undefined;

  let simpleType: SimpleType | undefined;

  const generic = liftGenericType(type, options);
  if (generic != null) {
    type = generic.target;
  }

  if (isLiteral(type, ts)) {
    const literalSimpleType = primitiveLiteralToSimpleType(type, checker, ts);
    if (literalSimpleType != null) {
      // Enum members
      if (symbol != null && symbol.flags & ts.SymbolFlags.EnumMember) {
        const parentSymbol = (
          symbol as ESSymbol & { parent: ESSymbol | undefined }
        ).parent;

        if (parentSymbol != null) {
          return {
            name: name || "",
            fullName: `${parentSymbol.name}.${name}`,
            kind: SimpleTypeKind.ENUM_MEMBER,
            type: literalSimpleType
          };
        }
      }

      // Literals types
      return literalSimpleType;
    }
  }

  // Primitive types
  else if (isString(type, ts)) {
    simpleType = { kind: SimpleTypeKind.STRING, name };
  } else if (isNumber(type, ts)) {
    simpleType = { kind: SimpleTypeKind.NUMBER, name };
  } else if (isBoolean(type, ts)) {
    simpleType = { kind: SimpleTypeKind.BOOLEAN, name };
  } else if (isBigInt(type, ts)) {
    simpleType = { kind: SimpleTypeKind.BIG_INT, name };
  } else if (isESSymbolLike(type, ts)) {
    simpleType = { kind: SimpleTypeKind.ES_SYMBOL, name };
  } else if (isUndefined(type, ts)) {
    simpleType = { kind: SimpleTypeKind.UNDEFINED, name };
  } else if (isNull(type, ts)) {
    simpleType = { kind: SimpleTypeKind.NULL, name };
  } else if (isUnknown(type, ts)) {
    simpleType = { kind: SimpleTypeKind.UNKNOWN, name };
  } else if (isVoid(type, ts)) {
    simpleType = { kind: SimpleTypeKind.VOID, name };
  } else if (isNever(type, ts)) {
    simpleType = { kind: SimpleTypeKind.NEVER, name };
  }

  // Enum
  else if (isEnum(type, ts) && type.isUnion()) {
    simpleType = {
      name: name || "",
      kind: SimpleTypeKind.ENUM,
      types: type.types.map(
        t => toSimpleTypeCached(t, options) as SimpleTypeEnumMember
      )
    };
  }

  // Promise
  else if (isPromise(type, checker, ts)) {
    simpleType = {
      kind: SimpleTypeKind.PROMISE,
      name,
      type: toSimpleTypeCached(getTypeArguments(type, checker, ts)[0], options)
    };
  }

  // Unions and intersections
  else if (type.isUnion()) {
    simpleType = {
      kind: SimpleTypeKind.UNION,
      types: simplifySimpleTypes(
        type.types.map(t => toSimpleTypeCached(t, options))
      ),
      name
    };
  } else if (type.isIntersection()) {
    simpleType = {
      kind: SimpleTypeKind.INTERSECTION,
      types: simplifySimpleTypes(
        type.types.map(t => toSimpleTypeCached(t, options))
      ),
      name
    };
  }

  // Date
  else if (isDate(type, ts)) {
    simpleType = {
      kind: SimpleTypeKind.DATE,
      name
    };
  }

  // Array
  else if (isArray(type, checker, ts)) {
    simpleType = {
      kind: SimpleTypeKind.ARRAY,
      type: toSimpleTypeCached(getTypeArguments(type, checker, ts)[0], options),
      name
    };
  } else if (isTupleTypeReference(type, ts)) {
    const types = getTypeArguments(type, checker, ts);

    const minLength = type.target.minLength;

    simpleType = {
      kind: SimpleTypeKind.TUPLE,
      rest: type.target.hasRestElement || false,
      members: types.map((childType, i) => {
        return {
          optional: i >= minLength,
          type: toSimpleTypeCached(childType, options)
        };
      }),
      name
    };
  }

  // Method signatures
  else if (isMethodSignature(type, ts)) {
    const callSignatures = type.getCallSignatures();
    simpleType = getSimpleFunctionFromCallSignatures(callSignatures, options);
  }

  // Class
  else if (type.isClass() && symbol != null) {
    const classDecl = getDeclaration(symbol, ts);

    if (classDecl != null && ts.isClassDeclaration(classDecl)) {
      const ctor = (() => {
        const ctorSymbol =
          symbol != null && symbol.members != null
            ? symbol.members.get("__constructor" as never)
            : undefined;
        if (ctorSymbol != null && symbol != null) {
          const ctorDecl =
            ctorSymbol.declarations !== undefined &&
            ctorSymbol.declarations?.length > 0
              ? ctorSymbol.declarations[0]
              : ctorSymbol.valueDeclaration;

          if (ctorDecl != null && ts.isConstructorDeclaration(ctorDecl)) {
            return getSimpleFunctionFromSignatureDeclaration(
              ctorDecl,
              options
            ) as SimpleTypeFunction;
          }
        }

        return undefined;
      })();

      const call = getSimpleFunctionFromCallSignatures(
        type.getCallSignatures(),
        options
      ) as SimpleTypeFunction;

      const members = checker
        .getPropertiesOfType(type)
        .map(symbol => {
          const declaration = getDeclaration(symbol, ts);

          // Some instance properties may have an undefined declaration.
          // Since we can't do too much without a declaration, filtering
          // these out seems like the best strategy for the moment.
          //
          // See https://github.com/runem/web-component-analyzer/issues/60 for
          // more info.
          if (declaration == null) return null;

          return {
            name: symbol.name,
            optional: (symbol.flags & ts.SymbolFlags.Optional) !== 0,
            modifiers: getModifiersFromDeclaration(declaration, ts),
            type: toSimpleTypeCached(
              checker.getTypeAtLocation(declaration),
              options
            )
          } as SimpleTypeMemberNamed;
        })
        .filter(
          (member): member is NonNullable<typeof member> => member != null
        );

      const typeParameters = getTypeParameters(
        getDeclaration(symbol, ts),
        options
      );

      simpleType = {
        kind: SimpleTypeKind.CLASS,
        name,
        call,
        ctor,
        typeParameters,
        members
      };
    }
  }

  // Interface
  else if (
    (type.isClassOrInterface() || isObject(type, ts)) &&
    !(symbol?.name === "Function")
  ) {
    // Handle the empty object
    if (isObject(type, ts) && symbol?.name === "Object") {
      return {
        kind: SimpleTypeKind.OBJECT
      };
    }

    const members = type.getProperties().map(symbol => {
      const declaration = getDeclaration(symbol, ts);

      return {
        name: symbol.name,
        optional: (symbol.flags & ts.SymbolFlags.Optional) !== 0,
        modifiers:
          declaration != null
            ? getModifiersFromDeclaration(declaration, ts)
            : [],
        type: toSimpleTypeCached(
          checker.getTypeAtLocation(symbol.valueDeclaration!),
          options
        )
      };
    });

    const ctor = getSimpleFunctionFromCallSignatures(
      type.getConstructSignatures(),
      options
    ) as SimpleTypeFunction;

    const call = getSimpleFunctionFromCallSignatures(
      type.getCallSignatures(),
      options
    ) as SimpleTypeFunction;

    const typeParameters =
      (type.isClassOrInterface() && type.typeParameters != null
        ? type.typeParameters.map(
            t => toSimpleTypeCached(t, options) as SimpleTypeGenericParameter
          )
        : undefined) ||
      (symbol != null
        ? getTypeParameters(getDeclaration(symbol, ts), options)
        : undefined);

    let indexType: SimpleTypeInterface["indexType"] = {};
    if (type.getStringIndexType()) {
      indexType["STRING"] = toSimpleTypeCached(
        type.getStringIndexType()!,
        options
      );
    }
    if (type.getNumberIndexType()) {
      indexType["NUMBER"] = toSimpleTypeCached(
        type.getNumberIndexType()!,
        options
      );
    }
    if (Object.keys(indexType).length === 0) {
      indexType = undefined;
    }

    // Simplify: if there is only a single "call" signature and nothing else, just return the call signature
    /*if (call != null && members.length === 0 && ctor == null && indexType == null) {
			return { ...call, name, typeParameters };
		}*/

    simpleType = {
      kind: type.isClassOrInterface() ? "INTERFACE" : "OBJECT",
      typeParameters,
      ctor,
      members,
      name,
      indexType,
      call
    } as SimpleTypeInterface | SimpleTypeObject;
  }

  // Handle "object" type
  else if (isNonPrimitive(type, ts)) {
    return {
      kind: SimpleTypeKind.NON_PRIMITIVE
    };
  }

  // Function
  else if (symbol != null && (isFunction(type, ts) || isMethod(type, ts))) {
    simpleType = getSimpleFunctionFromCallSignatures(
      type.getCallSignatures(),
      options,
      name
    );

    if (simpleType == null) {
      simpleType = {
        kind: SimpleTypeKind.FUNCTION,
        name
      };
    }
  }

  // Type Parameter
  else if (type.isTypeParameter() && symbol != null) {
    // This type
    if (isThisType(type, ts) && symbol.valueDeclaration != null) {
      return toSimpleTypeCached(
        checker.getTypeAtLocation(symbol.valueDeclaration),
        options
      );
    }

    const defaultType = type.getDefault();
    const defaultSimpleType =
      defaultType != null
        ? toSimpleTypeCached(defaultType, options)
        : undefined;

    simpleType = {
      kind: SimpleTypeKind.GENERIC_PARAMETER,
      name: symbol.getName(),
      default: defaultSimpleType
    } as SimpleTypeGenericParameter;
  }

  // If no type was found, return "ANY"
  if (simpleType == null) {
    simpleType = {
      kind: SimpleTypeKind.ANY,
      name
    };
  }

  // Lift generic types and aliases if possible
  if (generic != null) {
    return generic.generic(simpleType);
  }

  return simpleType;
}

function toSimpleTypeCached(
  type: Type,
  options: ToSimpleTypeInternalOptions
): SimpleType {
  // This function will resolve the type and assign the content to "target".
  // This way we can cache "target" before calling "toSimpleTypeInternal" recursively
  const resolveType = (target: SimpleType): void => {
    // Construct the simple type recursively
    //const simpleTypeOverwrite = options.cache.has(type) ? options.cache.get(type)! : toSimpleTypeInternal(type, options);
    const simpleTypeOverwrite = toSimpleTypeInternal(type, options);

    // Strip undefined keys to make the output cleaner
    Object.entries(simpleTypeOverwrite).forEach(([k, v]) => {
      if (v == null)
        delete simpleTypeOverwrite[k as keyof typeof simpleTypeOverwrite];
    });

    // Transfer properties on the simpleType to the placeholder
    // This makes it possible to keep on using the reference "placeholder".
    Object.assign(target, simpleTypeOverwrite);
  };

  if (options.eager === true) {
    // Make and cache placeholder
    const placeholder = {} as SimpleType;
    options.cache.set(type, placeholder);

    // Resolve type into placeholder
    resolveType(placeholder);

    Object.freeze(placeholder);
    return placeholder;
  } else {
    const placeholder = {} as SimpleType;

    // A function that only resolves the type once
    let didResolve = false;
    const ensureResolved = () => {
      if (!didResolve) {
        resolveType(placeholder);
        didResolve = true;
      }
    };

    // Use "toStringTag" as a hook into resolving the type.
    // If we don't have this hook, console.log would always print "{}" because the type hasn't been resolved
    Object.defineProperty(placeholder, Symbol.toStringTag, {
      get(): string {
        resolveType(placeholder);
        // Don't return any tag. Only use this function as a hook for calling "resolveType"
        return undefined as never;
      }
    });

    // Return a proxy with the purpose of resolving the type lazy
    const proxy = new Proxy(placeholder, {
      ownKeys(target: SimpleType) {
        ensureResolved();
        return [
          ...Object.getOwnPropertyNames(target),
          ...Object.getOwnPropertySymbols(target)
        ];
      },
      has(target: SimpleType, p: PropertyKey) {
        // Always return true if we test for "kind", but don't resolve the type
        // This way "isSimpleType" (which checks for "kind") will succeed without resolving the type
        if (p === "kind") {
          return true;
        }

        ensureResolved();
        return p in target;
      },
      getOwnPropertyDescriptor(target: SimpleType, p: keyof SimpleType) {
        ensureResolved();
        return Object.getOwnPropertyDescriptor(target, p);
      },
      get: (target: SimpleType, p: keyof SimpleType) => {
        ensureResolved();
        return target[p];
      },
      set: (target: SimpleType, p: keyof SimpleType) => {
        throw new TypeError(`Cannot assign to read only property '${p}'`);
      }
    });

    options.cache.set(type, proxy);

    return proxy;
  }
}

export function setTypescriptModule(ts: typeof tsModule) {
  selectedTSModule = ts;
}

export function getTypescriptModule(): typeof tsModule {
  return selectedTSModule;
}

interface ToSimpleTypeOptions {
  eager?: boolean;
  cache?: WeakMap<Type, SimpleType>;
}

export function toSimpleType(
  type: Type | Node | SimpleType,
  checker?: TypeChecker,
  options: ToSimpleTypeOptions = {}
): SimpleType {
  if (isSimpleType(type)) {
    return type;
  }

  checker = checker!;

  if (isNode(type)) {
    // "type" is a "Node", convert it to a "Type" and continue.
    return toSimpleType(checker.getTypeAtLocation(type), checker);
  }

  return toSimpleTypeCached(type, {
    checker,
    eager: options.eager,
    cache: options.cache || DEFAULT_TYPE_CACHE,
    ts: getTypescriptModule()
  });
}

export interface SimpleTypeComparisonOptions {
  strict?: boolean;
  strictNullChecks?: boolean;
  strictFunctionTypes?: boolean;
  noStrictGenericChecks?: boolean;
  isAssignable?: (
    typeA: SimpleType,
    typeB: SimpleType,
    options: SimpleTypeComparisonOptions
  ) => boolean | undefined | void;
  debug?: boolean;
  debugLog?: (text: string) => void;
  cache?: WeakMap<SimpleType, WeakMap<SimpleType, boolean>>;
  maxDepth?: number;
  maxOps?: number;
}

export const DEFAULT_GENERIC_PARAMETER_TYPE: SimpleTypeUnknown = {
  kind: SimpleTypeKind.UNKNOWN
};

// TODO: added by me, probably not needed
Object.freeze(DEFAULT_GENERIC_PARAMETER_TYPE);

export function validateType(
  type: SimpleType,
  callback: (simpleType: SimpleType) => boolean | undefined | void
): boolean {
  return validateTypeInternal(type, callback, new Map());
}

export function resolveType(
  simpleType: SimpleType,
  parameterMap: Map<string, SimpleType> = new Map()
): Exclude<
  SimpleType,
  SimpleTypeGenericParameter | SimpleTypeGenericArguments
> {
  switch (simpleType.kind) {
    case "GENERIC_PARAMETER": {
      const resolvedArgument = parameterMap?.get(simpleType.name);
      return resolveType(
        resolvedArgument ||
          /*simpleType.default ||*/ DEFAULT_GENERIC_PARAMETER_TYPE,
        parameterMap
      );
    }
    case "GENERIC_ARGUMENTS": {
      const updatedGenericParameterMap = extendTypeParameterMap(
        simpleType,
        parameterMap
      );
      return resolveType(simpleType.target, updatedGenericParameterMap);
    }
    default:
      return simpleType;
  }
}

export function extendTypeParameterMap(
  genericType: SimpleTypeGenericArguments,
  existingMap: Map<string, SimpleType>
) {
  const target = resolveType(genericType.target, existingMap);

  if ("typeParameters" in target) {
    const parameterEntries = (target.typeParameters || []).map(
      (parameter, i) => {
        const typeArg = genericType.typeArguments[i];
        const resolvedTypeArg =
          typeArg == null
            ? /*parameter.default || */ DEFAULT_GENERIC_PARAMETER_TYPE
            : resolveType(typeArg, existingMap);

        //return [parameter.name, genericType.typeArguments[i] || parameter.default || { kind: "ANY" }] as [string, SimpleType];
        return [parameter.name, resolvedTypeArg] as [string, SimpleType];
      }
    );
    const allParameterEntries = [...existingMap.entries(), ...parameterEntries];

    return new Map(allParameterEntries);
  }

  return existingMap;
}

function validateTypeInternal(
  type: SimpleType,
  callback: (simpleType: SimpleType) => boolean | undefined | void,
  parameterMap: Map<string, SimpleType>
): boolean {
  const res = callback(type);

  if (res != null) {
    return res;
  }

  switch (type.kind) {
    case "ENUM":
    case "UNION": {
      return or(type.types, childType =>
        validateTypeInternal(childType, callback, parameterMap)
      );
    }

    case "ALIAS": {
      return validateTypeInternal(type.target, callback, parameterMap);
    }

    case "INTERSECTION": {
      return and(type.types, childType =>
        validateTypeInternal(childType, callback, parameterMap)
      );
    }

    case "GENERIC_PARAMETER": {
      const resolvedArgument = parameterMap?.get(type.name);
      return validateTypeInternal(
        resolvedArgument || DEFAULT_GENERIC_PARAMETER_TYPE,
        callback,
        parameterMap
      );
    }

    case "GENERIC_ARGUMENTS": {
      const updatedGenericParameterMap = extendTypeParameterMap(
        type,
        parameterMap
      );
      return validateTypeInternal(
        type.target,
        callback,
        updatedGenericParameterMap
      );
    }
  }

  return false;
}

interface SimpleTypeKindComparisonOptions {
  matchAny?: boolean;
}

export function isAssignableToSimpleTypeKind(
  type: Type | SimpleType,
  kind: SimpleTypeKind | SimpleTypeKind[],
  optionsOrChecker?: TypeChecker | SimpleTypeKindComparisonOptions,
  options: SimpleTypeKindComparisonOptions = {}
): boolean {
  const checker = isTypeChecker(optionsOrChecker)
    ? optionsOrChecker
    : undefined;
  options =
    (isTypeChecker(optionsOrChecker) || optionsOrChecker == null
      ? options
      : optionsOrChecker) || {};

  if (!isSimpleType(type)) {
    const result = isAssignableToSimpleTypeKind(
      toSimpleType(type, checker!),
      kind,
      options
    );

    return result;
  }

  const result = validateType(type, simpleType => {
    if (
      Array.isArray(kind) &&
      or(kind, itemKind => simpleType.kind === itemKind)
    ) {
      return true;
    }

    if (simpleType.kind === kind) {
      return true;
    }

    switch (simpleType.kind) {
      // Make sure that an object without members are treated as ANY
      case "OBJECT": {
        if (simpleType.members == null || simpleType.members.length === 0) {
          return isAssignableToSimpleTypeKind(SIMPLE_TYPE_ANY, kind, options);
        }
        break;
      }

      case "ANY": {
        return options.matchAny || false;
      }

      case "ENUM_MEMBER": {
        return isAssignableToSimpleTypeKind(simpleType.type, kind, options);
      }

      // TODO: what about other types?
    }

    return false;
  });

  return result;
}

function functionArgTypesToString(
  argTypes: SimpleTypeFunctionParameter[],
  visitTypeSet: Set<SimpleType>
): string {
  return argTypes
    .map(arg => {
      return `${arg.rest ? "..." : ""}${arg.name}${arg.optional ? "?" : ""}: ${simpleTypeToStringInternal(arg.type, visitTypeSet)}`;
    })
    .join(", ");
}

export function typeToString(
  type: SimpleType | Type,
  checker?: TypeChecker
): string {
  if (isSimpleType(type)) {
    return simpleTypeToString(type);
  }

  // Use the typescript checker to return a string for a type
  return checker!.typeToString(type);
}

function truncateAndJoinList(
  items: string[],
  combine: string,
  {
    maxLength,
    maxContentLength
  }: { maxLength?: number; maxContentLength?: number }
): string {
  const text = items.join(combine);

  // Truncate if too long
  let slice = 0;
  if (maxContentLength != null && text.length > maxContentLength) {
    let curLength = 0;
    for (const item of items) {
      curLength += item.length;
      slice++;

      if (curLength > maxContentLength) {
        break;
      }
    }
  } else if (maxLength != null && items.length > maxLength) {
    slice = maxLength;
  }

  if (slice !== 0) {
    return [
      ...items.slice(0, slice),
      `... ${items.length - slice} more ...`
    ].join(combine);
  }

  return text;
}

function simpleTypeToStringInternal(
  type: SimpleType,
  visitTypeSet: Set<SimpleType>
): string {
  if (!isSimpleTypePrimitive(type)) {
    if (visitTypeSet.has(type)) {
      return "";
    }
    visitTypeSet = new Set([...visitTypeSet, type]);
  }

  switch (type.kind) {
    case "BOOLEAN_LITERAL":
      return String(type.value);
    case "NUMBER_LITERAL":
      return String(type.value);
    case "STRING_LITERAL":
      return `"${type.value}"`;
    case "BIG_INT_LITERAL":
      return `${type.value}n`;
    case "ES_SYMBOL":
      return `Symbol()`;
    case "ES_SYMBOL_UNIQUE":
      return `Symbol(${type.name})`;
    case "STRING":
      return "string";
    case "BOOLEAN":
      return "boolean";
    case "NUMBER":
      return "number";
    case "BIG_INT":
      return "bigint";
    case "UNDEFINED":
      return "undefined";
    case "NULL":
      return "null";
    case "ANY":
      return "any";
    case "UNKNOWN":
      return "unknown";
    case "VOID":
      return "void";
    case "NEVER":
      return "never";
    case "FUNCTION":
    case "METHOD": {
      if (type.kind === "FUNCTION" && type.name != null) return type.name;
      const argText = functionArgTypesToString(
        type.parameters || [],
        visitTypeSet
      );
      return `${type.typeParameters != null ? `<${type.typeParameters.map(tp => tp.name).join(",")}>` : ""}(${argText})${
        type.returnType != null
          ? ` => ${simpleTypeToStringInternal(type.returnType, visitTypeSet)}`
          : ""
      }`;
    }
    case "ARRAY": {
      const hasMultipleTypes = ["UNION", "INTERSECTION"].includes(
        type.type.kind
      );
      let memberType = simpleTypeToStringInternal(type.type, visitTypeSet);
      if (
        type.name != null &&
        ["ArrayLike", "ReadonlyArray"].includes(type.name)
      )
        return `${type.name}<${memberType}>`;
      if (hasMultipleTypes && type.type.name == null)
        memberType = `(${memberType})`;
      return `${memberType}[]`;
    }
    case "UNION": {
      if (type.name != null) return type.name;
      return truncateAndJoinList(
        type.types.map(t => simpleTypeToStringInternal(t, visitTypeSet)),
        " | ",
        { maxContentLength: 200 }
      );
    }
    case "ENUM":
      return type.name;
    case "ENUM_MEMBER":
      return type.fullName;
    case "INTERSECTION":
      if (type.name != null) return type.name;
      return truncateAndJoinList(
        type.types.map(t => simpleTypeToStringInternal(t, visitTypeSet)),
        " & ",
        { maxContentLength: 200 }
      );
    case "INTERFACE":
      if (type.name != null) return type.name;
    // eslint-disable-next-line no-fallthrough
    case "OBJECT": {
      if (type.members == null || type.members.length === 0) {
        if (type.call == null && type.ctor == null) {
          return "{}";
        }

        if (type.call != null && type.ctor == null) {
          return simpleTypeToStringInternal(type.call, visitTypeSet);
        }
      }

      const entries: string[] = (type.members || []).map(member => {
        // this check needs to change in the future
        if (member.type.kind === "FUNCTION" || member.type.kind === "METHOD") {
          const result = simpleTypeToStringInternal(member.type, visitTypeSet);
          return `${member.name}${result.replace(" => ", ": ")}`;
        }

        return `${member.name}: ${simpleTypeToStringInternal(member.type, visitTypeSet)}`;
      });

      if (type.ctor != null) {
        entries.push(
          `new${simpleTypeToStringInternal(type.ctor, visitTypeSet)}`
        );
      }

      if (type.call != null) {
        entries.push(simpleTypeToStringInternal(type.call, visitTypeSet));
      }

      return `{ ${entries.join("; ")}${entries.length > 0 ? ";" : ""} }`;
    }
    case "TUPLE":
      return `[${type.members.map(member => `${simpleTypeToStringInternal(member.type, visitTypeSet)}${member.optional ? "?" : ""}`).join(", ")}]`;
    case "GENERIC_ARGUMENTS": {
      const { target, typeArguments } = type;
      return typeArguments.length === 0
        ? target.name || ""
        : `${target.name}<${typeArguments.map(t => simpleTypeToStringInternal(t, visitTypeSet)).join(", ")}>`;
    }
    case "PROMISE":
      return `${type.name || "Promise"}<${simpleTypeToStringInternal(type.type, visitTypeSet)}>`;
    case "DATE":
      return "Date";
    default:
      return type.name || "";
  }
}

export function simpleTypeToString(type: SimpleType): string {
  return simpleTypeToStringInternal(type, new Set());
}

//#endregion
