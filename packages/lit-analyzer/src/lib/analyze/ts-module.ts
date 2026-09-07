import * as tsModuleImport from "typescript";

export const tsModule: { ts: typeof tsModuleImport } = { ts: tsModuleImport };

export function setTypescriptModule(newModule: typeof tsModuleImport): void {
  tsModule.ts = newModule;
}
