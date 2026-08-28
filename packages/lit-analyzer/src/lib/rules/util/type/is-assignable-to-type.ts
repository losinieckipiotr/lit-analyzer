import { Type } from "typescript";
import {
  isAssignableToType as _isAssignableToType,
  SimpleType,
  SimpleTypeComparisonOptions,
} from "../../../../web-component-analyzer/src/api.js";
import { RuleModuleContext } from "../../../analyze/types/rule/rule-module-context.js";

export function isAssignableToType(
  { typeA, typeB }: { typeA: SimpleType | Type; typeB: SimpleType | Type },
  context: RuleModuleContext,
  options?: SimpleTypeComparisonOptions,
): boolean {
  const inJsFile = context.file.fileName.endsWith(".js");
  const expandedOptions = {
    ...(inJsFile ? { strict: false } : {}),
    options: context.ts,
    ...(options || {}),
  };
  return _isAssignableToType(typeA, typeB, context.program, expandedOptions);
}
