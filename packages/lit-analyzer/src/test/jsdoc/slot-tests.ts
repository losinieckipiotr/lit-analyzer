import { SourceFile } from "typescript";
import { LitAnalyzerContext } from "../../lib/analyze/default-lit-analyzer-context.js";
import { getDiagnostics } from "../helpers/analyze.js";
import { tsTest } from "../helpers/ts-test.js";

function getSlots(sourceFile: SourceFile, context: LitAnalyzerContext) {
  const definitions =
    context.definitionStore.getAnalysisResultForFile(sourceFile)
      ?.componentDefinitions ?? [];

  return definitions[0].declaration?.slots ?? [];
}

tsTest("jsdoc: Discovers slots with @slots", (t) => {
  const { sourceFile, context } = getDiagnostics(`
    /**
     * @element
     * @slot myslot - This is a comment
     */
    class MyElement extends HTMLElement { }
  `);

  const slots = getSlots(sourceFile, context);

  t.is(slots.length, 1);
  t.is(slots[0].name, "myslot");
  t.is(slots[0].jsDoc?.description, "This is a comment");
});

tsTest("jsdoc: Discovers unnamed slots with @slots", (t) => {
  const { sourceFile, context } = getDiagnostics(`
    /**
     * @element
     * @slot - This is a comment
     */
    class MyElement extends HTMLElement { }
  `);

  const slots = getSlots(sourceFile, context);

  t.is(slots.length, 1);
  t.is(slots[0].name, undefined);
  t.is(slots[0].jsDoc?.description, "This is a comment");
});

tsTest("jsdoc: Discovers permitted tag names on @slot", (t) => {
  const { sourceFile, context } = getDiagnostics(`
    /**
     * @element
     * @slot {"div"|"span"} myslot1
     * @slot {"li"} myslot2
     */
    class MyElement extends HTMLElement { 
    }
  `);

  const [slot1, slot2] = getSlots(sourceFile, context);

  t.is(slot1.permittedTagNames!.length, 2);
  t.deepEqual(slot1.permittedTagNames, ["div", "span"]);

  t.is(slot2.permittedTagNames!.length, 1);
  t.deepEqual(slot2.permittedTagNames, ["li"]);
});
