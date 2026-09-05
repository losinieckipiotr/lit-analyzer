import { TypeChecker } from "typescript";
import { MyUnionType } from "../../web-component-analyzer/src/simple-type.js";

export function isBooleanStringUnion(
  type: MyUnionType,
  checker: TypeChecker,
): boolean {
  const trueStrType = checker.getStringLiteralType("true");
  const falseStrType = checker.getStringLiteralType("false");

  return (
    type.types.length == 2 &&
    type.types.every(
      (t) =>
        checker.isTypeAssignableTo(t, trueStrType) ||
        checker.isTypeAssignableTo(t, falseStrType),
    )
  );
}
