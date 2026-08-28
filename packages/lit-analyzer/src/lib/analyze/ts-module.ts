import * as tsModuleType from "typescript";
import { setTypescriptModule as tsSimpleTypeSetTypescriptModule } from "../../web-component-analyzer/src/api.js";

export const tsModule: { ts: typeof tsModuleType } = { ts: tsModuleType };

export function setTypescriptModule(newModule: typeof tsModuleType): void {
  tsModule.ts = newModule;

  tsSimpleTypeSetTypescriptModule(newModule);
}
