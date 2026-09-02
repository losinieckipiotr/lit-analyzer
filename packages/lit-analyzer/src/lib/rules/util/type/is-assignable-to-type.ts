import { Type } from "typescript";
import {
  isAssignableToType as _isAssignableToType,
  SimpleType,
  SimpleTypeComparisonOptions,
} from "../../../../web-component-analyzer/src/api.js";
import { RuleModuleContext } from "../../../analyze/rule-collection.js";

// TODO: remove this function

export function isAssignableToType(
  { typeA, typeB }: { typeA: SimpleType | Type; typeB: SimpleType | Type },
  context: RuleModuleContext,
  options?: SimpleTypeComparisonOptions,
): boolean {
  const simpleTypeContext = {
    checker: context.program.getTypeChecker(),
    ts: context.ts,
  };
  const inJsFile = context.file.fileName.endsWith(".js");
  const expandedOptions = {
    ...(inJsFile ? { strict: false } : {}),
    options: context.ts,
    ...(options || {}),
  };
  return _isAssignableToType(typeA, typeB, simpleTypeContext, expandedOptions);
}
