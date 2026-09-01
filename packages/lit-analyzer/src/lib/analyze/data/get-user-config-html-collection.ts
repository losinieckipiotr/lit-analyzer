import { existsSync, readFileSync } from "fs";
import { SimpleTypeContext } from "../../../web-component-analyzer/src/simple-type.js";
import type { HTMLDataV1 } from "../data/html-data-types.js";
import { LitAnalyzerConfig } from "../lit-analyzer-config.js";
import { LitAnalyzerLogger } from "../lit-analyzer-logger.js";
import {
  HtmlAttr,
  HtmlDataCollection,
  HtmlEvent,
  HtmlTag,
  mergeHtmlAttrs,
  mergeHtmlEvents,
  mergeHtmlTags,
} from "../parse/parse-html-data/html-tag.js";
import { parseVscodeHtmlData } from "../parse/parse-html-data/parse-vscode-html-data.js";

export function getUserConfigHtmlCollection(
  simpleTypeContext: SimpleTypeContext,
  logger: LitAnalyzerLogger,
  config: LitAnalyzerConfig,
): HtmlDataCollection {
  const {
    customHtmlData: configCustomHtmlData,
    globalTags,
    globalAttributes,
    globalEvents,
  } = config;

  const { checker } = simpleTypeContext;

  const collection = (() => {
    let collection: HtmlDataCollection = { tags: [], global: {} };

    for (const customHtmlData of Array.isArray(configCustomHtmlData)
      ? configCustomHtmlData
      : [configCustomHtmlData]) {
      try {
        const data: HTMLDataV1 =
          typeof customHtmlData === "string" && existsSync(customHtmlData)
            ? JSON.parse(readFileSync(customHtmlData, "utf8").toString())
            : customHtmlData;

        const parsedCollection = parseVscodeHtmlData(data, simpleTypeContext);
        collection = {
          tags: mergeHtmlTags([...collection.tags, ...parsedCollection.tags]),
          global: {
            attributes: mergeHtmlAttrs([
              ...(collection.global.attributes || []),
              ...(parsedCollection.global.attributes || []),
            ]),
            events: mergeHtmlEvents([
              ...(collection.global.events || []),
              ...(parsedCollection.global.events || []),
            ]),
          },
        };
      } catch (e) {
        logger.error(
          "Error parsing user configuration 'customHtmlData'",
          e,
          customHtmlData,
        );
      }
    }

    return collection;
  })();

  const tags = globalTags.map(
    (tagName) =>
      ({
        tagName: tagName,
        properties: [],
        attributes: [],
        events: [],
        slots: [],
        cssParts: [],
        cssProperties: [],
      }) as HtmlTag,
  );

  const attrs = globalAttributes.map((attrName) => {
    const attr: HtmlAttr = {
      name: attrName,
      kind: "attribute",
      getType: () => checker.getAnyType(),
    };

    return attr;
  });

  const events = globalEvents.map((eventName) => {
    const htmlEvent: HtmlEvent = {
      name: eventName,
      getType: () => checker.getAnyType(),
    };

    return htmlEvent;
  });

  return {
    tags: [...tags, ...collection.tags],
    global: {
      attributes: [...attrs, ...(collection.global.attributes || [])],
      events: [...events, ...(collection.global.events || [])],
    },
  };
}
