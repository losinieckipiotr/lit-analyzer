import * as ts_module from "typescript";

export const tsModule: { ts: typeof ts_module } = { ts: ts_module };

export function setTypescriptModule(newModule: typeof ts_module): void {
  tsModule.ts = newModule;
}
