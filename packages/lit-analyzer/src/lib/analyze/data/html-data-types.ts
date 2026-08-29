export interface HTMLDataV1 {
  version: 1 | 1.1;
  tags?: ITagData[];
  globalAttributes?: IAttributeData[];
  valueSets?: IValueSet[];
}

export interface ITagData {
  name: string;
  description?: string | MarkupContent;
  attributes: IAttributeData[];
  references?: IReference[];
  void?: boolean;
  browsers?: string[];
  status?: BaselineStatus;
}

export interface IAttributeData {
  name: string;
  description?: string | MarkupContent;
  valueSet?: string;
  values?: IValueData[];
  references?: IReference[];
  browsers?: string[];
  status?: BaselineStatus;
}

export interface IValueSet {
  name: string;
  values: IValueData[];
}

export interface MarkupContent {
  /**
   * The type of the Markup
   */
  kind: MarkupKind;
  /**
   * The content itself
   */
  value: string;
}

export type MarkupKind = "plaintext" | "markdown";

export interface IReference {
  name: string;
  url: string;
}
export interface BaselineStatus {
  baseline: Baseline;
  baseline_low_date?: string;
  baseline_high_date?: string;
}

export type Baseline = false | "low" | "high";

export interface IValueData {
  name: string;
  description?: string | MarkupContent;
  references?: IReference[];
  browsers?: string[];
  status?: BaselineStatus;
}
