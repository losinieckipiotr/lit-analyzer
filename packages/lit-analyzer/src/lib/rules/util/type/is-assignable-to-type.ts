import { isAssignableToType as _isAssignableToType } from "web-component-analyzer/is-assignable-to-type.js";
import {
  SimpleType,
  SimpleTypeComparisonOptions,
} from "web-component-analyzer/simple-type.js";
import { RuleModuleContext } from "../../../analyze/types/rule/rule-module-context.js";

export function isAssignableToType(
  { typeA, typeB }: { typeA: SimpleType; typeB: SimpleType },
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
