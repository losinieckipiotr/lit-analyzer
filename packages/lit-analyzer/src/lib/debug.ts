/* eslint-disable no-console */
// TODO: remove this file?
import { prepareAnalyzer } from "../test/helpers/analyze.js";
import { parseAllIndirectImports } from "./analyze/parse/parse-dependencies/parse-dependencies.js";

function main() {
  const { sourceFile, context } = prepareAnalyzer([
    { fileName: "file1.ts", text: `` },
    { fileName: "file2.ts", text: `` },
    { fileName: "file3.ts", text: `` },
    { fileName: "file4.ts", text: `` },
    {
      fileName: "file5.ts",
      text: `
        import "./file1";
        import * as f2 from "./file2";
        import { } from "./file3";

        (async () => {
          await import("./file4");
        })();
    `,
      entry: true,
    },
  ]);

  const dependencies = parseAllIndirectImports(sourceFile, context);
  const sortedFileNames = Array.from(dependencies)
    .map((file) => file.fileName)
    .sort();

  console.log({ sortedFileNames });
}

main();
