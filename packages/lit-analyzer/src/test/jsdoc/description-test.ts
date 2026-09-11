import { inspect } from "util";
import { getDiagnostics } from "../helpers/analyze.js";
import { TestFile } from "../helpers/compile-files.js";
import { tsTest } from "../helpers/ts-test.js";

function getDeclaration(inputFiles: TestFile | TestFile[]) {
  const { sourceFile, context } = getDiagnostics(inputFiles);

  const definitions =
    context.definitionStore.getAnalysisResultForFile(sourceFile)
      ?.componentDefinitions ?? [];

  return definitions[0].declaration ?? undefined;
}

tsTest("jsdoc: Correctly discovers the description in the jsdoc", (t) => {
  const declaration = getDeclaration(`
  /**
   * layout to full document height as follows:
   * \`\`\`
   * \\@media screen {
   *   html, body {
   *     height: 100%;
   *   }
   * }
   * \`\`\`
   * This is an example
   * @element
   */
   class MyElement extends HTMLElement {
   }
   `);

  const description = declaration?.jsDoc?.description ?? "";
  const allowed = new Set<string>([
    `layout to full document height as follows:
\`\`\`
@media screen {
  html, body {
    height: 100%;
  }
}
\`\`\`
This is an example`,
    `layout to full document height as follows:
\`\`\`
@media screen {
   html, body {
     height: 100%;
   }
}
\`\`\`
This is an example`,
  ]);

  t.true(
    allowed.has(description),
    `Expected ${inspect(description)} to be one of ${inspect(allowed)}`,
  );
});
