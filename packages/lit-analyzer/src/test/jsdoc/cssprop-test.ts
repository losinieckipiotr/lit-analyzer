import { getDiagnostics } from "../helpers/analyze.js";
import { TestFile } from "../helpers/compile-files.js";
import { tsTest } from "../helpers/ts-test.js";

function getCssProperties(inputFiles: TestFile | TestFile[]) {
  const { sourceFile, context } = getDiagnostics(inputFiles);

  const definitions =
    context.definitionStore.getAnalysisResultForFile(sourceFile)
      ?.componentDefinitions ?? [];

  return definitions[0].declaration?.cssProperties ?? [];
}

tsTest("jsdoc: Discovers css properties with @cssprop", (t) => {
  const cssProperties = getCssProperties(`
  /**
   * @element
   * @cssprop --this-is-a-css-prop  - This is a comment
   */
   class MyElement extends HTMLElement { 
   }
   `);

  t.is(cssProperties.length, 1);
  t.is(cssProperties[0].name, "--this-is-a-css-prop");
  t.is(cssProperties[0].jsDoc!.description, "This is a comment");
});

tsTest("jsdoc: Discovers css properties with @cssproperty", (t) => {
  const cssProperties = getCssProperties(`
  /**
   * @element
   * @cssproperty --this-is-a-css-prop  - This is a comment
   */
   class MyElement extends HTMLElement { 
   }
   `);

  t.is(cssProperties.length, 1);
  t.is(cssProperties[0].name, "--this-is-a-css-prop");
  t.is(cssProperties[0].jsDoc?.description, "This is a comment");
});

tsTest("jsdoc: Discovers css properties with @cssproperty and default", (t) => {
  const cssProperties = getCssProperties(`
  /**
   * @element
   * @cssproperty [--element-color=red] - This is a comment
   */
   class MyElement extends HTMLElement { 
   }
   `);

  t.is(cssProperties.length, 1);
  t.is(cssProperties[0].name, "--element-color");
  t.is(cssProperties[0].default, "red");
  t.is(cssProperties[0].jsDoc?.description, "This is a comment");
});
