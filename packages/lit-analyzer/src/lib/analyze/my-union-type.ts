import * as tsMod from "typescript";
import { Type, TypeChecker } from "typescript";

const UnionSymbol = Symbol("MyUnionType");

export type MyUnionType = {
  readonly [UnionSymbol]: true;
  types: Type[];
  name?: string;
};

export function isMyUnionType(type: Type | MyUnionType): type is MyUnionType {
  return (type as MyUnionType)[UnionSymbol] === true;
}

export function isType(type: Type | MyUnionType): type is Type {
  return !isMyUnionType(type);
}

export function getUnionType(types: Type[], name?: string): MyUnionType {
  if (types.length < 2) {
    throw new Error("Cannot create a union type with less than 2 types.");
  }

  return {
    [UnionSymbol]: true,
    types,
    name,
  };
}

export function isBooleanStringUnion(
  type: MyUnionType,
  ts: typeof tsMod,
  checker: TypeChecker,
): boolean {
  const types = type.types.filter(
    (t) =>
      !(t.flags & ts.TypeFlags.Undefined) && !(t.flags & ts.TypeFlags.Null),
  );

  const trueStrType = checker.getStringLiteralType("true");
  const falseStrType = checker.getStringLiteralType("false");

  return (
    types.length == 2 &&
    types.every(
      (t) =>
        checker.isTypeAssignableTo(t, trueStrType) ||
        checker.isTypeAssignableTo(t, falseStrType),
    )
  );
}
