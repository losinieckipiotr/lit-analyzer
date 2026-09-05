export { analyzeHTMLElement } from "./analyze/analyze-html-element.js";
export { analyzeSourceFile } from "./analyze/analyze-source-file.js";

export { visitAllHeritageClauses } from "./analyze/util/component-declaration-util.js";

export type { AnalyzerResult } from "./analyze/types/analyzer-result.js";
export type {
  ComponentDeclaration,
  ComponentFeatures
} from "./analyze/types/component-declaration.js";
export type { ComponentDefinition } from "./analyze/types/component-definition.js";
export type { ComponentCssPart } from "./analyze/types/features/component-css-part.js";
export type { ComponentCssProperty } from "./analyze/types/features/component-css-property.js";
export type { ComponentEvent } from "./analyze/types/features/component-event.js";
export type { ComponentMember } from "./analyze/types/features/component-member.js";
export type { ComponentSlot } from "./analyze/types/features/component-slot.js";
export type { LitElementPropertyConfig } from "./analyze/types/features/lit-element-property-config.js";

export { setTypescriptModule } from "./simple-type.js";

export type {
  SimpleType,
  SimpleTypeAny,
  SimpleTypeComparisonOptions,
  SimpleTypeEnumMember,
  SimpleTypeStringLiteral,
  SimpleTypeUnion
} from "./simple-type.js";
