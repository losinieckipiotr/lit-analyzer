import * as tsMod from "typescript";

export const tsModule: { ts: typeof tsMod } = { ts: tsMod };

export function setTypescriptModule(newModule: typeof tsMod): void {
  tsModule.ts = newModule;
}
