import * as tsMod from "typescript";
import {
  HtmlAttr,
  HtmlAttrTarget,
  HtmlCssPart,
  HtmlCssProperty,
  HtmlDataCollection,
  HtmlEvent,
  HtmlProp,
  HtmlSlot,
  HtmlTag,
  NamedHtmlDataCollection,
} from "../../parse/parse-html-data/html-tag.js";
import {
  HtmlNodeAttr,
  HtmlNodeAttrKind,
} from "../../types/html-node/html-node-attr-types.js";
import { HtmlNode } from "../../types/html-node/html-node-types.js";
import {
  HtmlDataSourceKind,
  HtmlDataSourceMerged,
} from "./html-data-source-merged.js";

export interface AnalyzerHtmlStore {
  getHtmlTag(htmlNode: HtmlNode | string): HtmlTag | undefined;
  getGlobalTags(): Iterable<HtmlTag>;
  getAllAttributesForTag(htmlNode: HtmlNode | string): Iterable<HtmlAttr>;
  getAllPropertiesForTag(htmlNode: HtmlNode | string): Iterable<HtmlProp>;
  getAllEventsForTag(htmlNode: HtmlNode | string): Iterable<HtmlEvent>;
  getAllSlotsForTag(htmlNode: HtmlNode | string): Iterable<HtmlSlot>;
  getAllCssPartsForTag(htmlNode: HtmlNode | string): Iterable<HtmlCssPart>;
  getAllCssPropertiesForTag(
    htmlNode: HtmlNode | string,
  ): Iterable<HtmlCssProperty>;
  getHtmlAttrTarget(htmlNodeAttr: HtmlNodeAttr): HtmlAttrTarget | undefined;
}

export class DefaultAnalyzerHtmlStore implements AnalyzerHtmlStore {
  private dataSource: HtmlDataSourceMerged;

  constructor(ts: typeof tsMod) {
    this.dataSource = new HtmlDataSourceMerged(ts);
  }

  absorbSubclassExtension(name: string, extension: HtmlTag): void {
    this.dataSource.absorbSubclassExtension(name, extension);
  }

  absorbCollection(
    collection: HtmlDataCollection,
    register: HtmlDataSourceKind,
  ): void {
    this.dataSource.absorbCollection(collection, register);
  }

  forgetCollection(
    collection: NamedHtmlDataCollection,
    register: HtmlDataSourceKind,
  ): void {
    this.dataSource.forgetCollection(collection, register);
  }

  getHtmlTag(htmlNode: HtmlNode | string): HtmlTag | undefined {
    return this.dataSource.getHtmlTag(
      typeof htmlNode === "string" ? htmlNode : htmlNode.tagName,
    );
  }

  getGlobalTags(): Iterable<HtmlTag> {
    return this.dataSource.globalTags.values();
  }

  getAllAttributesForTag(htmlNode: HtmlNode | string): Iterable<HtmlAttr> {
    return this.dataSource
      .getAllAttributesForTag(
        typeof htmlNode === "string" ? htmlNode : htmlNode.tagName,
      )
      .values();
  }

  getAllPropertiesForTag(htmlNode: HtmlNode | string): Iterable<HtmlProp> {
    return this.dataSource
      .getAllPropertiesForTag(
        typeof htmlNode === "string" ? htmlNode : htmlNode.tagName,
      )
      .values();
  }

  getAllEventsForTag(htmlNode: HtmlNode | string): Iterable<HtmlEvent> {
    return this.dataSource
      .getAllEventsForTag(
        typeof htmlNode === "string" ? htmlNode : htmlNode.tagName,
      )
      .values();
  }

  getAllSlotsForTag(htmlNode: HtmlNode | string): Iterable<HtmlSlot> {
    return this.dataSource
      .getAllSlotForTag(
        typeof htmlNode === "string" ? htmlNode : htmlNode.tagName,
      )
      .values();
  }

  getAllCssPartsForTag(htmlNode: HtmlNode | string): Iterable<HtmlCssPart> {
    return this.dataSource
      .getAllCssPartsForTag(
        typeof htmlNode === "string" ? htmlNode : htmlNode.tagName,
      )
      .values();
  }

  getAllCssPropertiesForTag(
    htmlNode: HtmlNode | string,
  ): Iterable<HtmlCssPart> {
    return this.dataSource
      .getAllCssPropertiesForTag(
        typeof htmlNode === "string" ? htmlNode : htmlNode.tagName,
      )
      .values();
  }

  getHtmlAttrTarget(htmlNodeAttr: HtmlNodeAttr): HtmlAttrTarget | undefined {
    const name = htmlNodeAttr.name.toLowerCase();

    switch (htmlNodeAttr.kind) {
      case HtmlNodeAttrKind.EVENT_LISTENER:
        return this.dataSource
          .getAllEventsForTag(htmlNodeAttr.htmlNode.tagName)
          .get(name);

      case HtmlNodeAttrKind.BOOLEAN_ATTRIBUTE:
      case HtmlNodeAttrKind.ATTRIBUTE:
        return this.dataSource
          .getAllAttributesForTag(htmlNodeAttr.htmlNode.tagName)
          .get(name);

      case HtmlNodeAttrKind.PROPERTY:
        return this.dataSource
          .getAllPropertiesForTag(htmlNodeAttr.htmlNode.tagName)
          .get(name);
    }
  }
}
