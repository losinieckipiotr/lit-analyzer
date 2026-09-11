import { getDiagnostics } from "../helpers/analyze.js";
import { tsTest } from "../helpers/ts-test.js";

tsTest("jsdoc: Discovers custom elements with @element", (t) => {
  const { sourceFile, context } = getDiagnostics(
    [
      'import { html, LitElement, render } from "lit";',
      "",
      "/** @element my-element */",
      "class MyElement extends LitElement { }",
      "",
      "render(html`<my-element></my-element>`, document.body);",
    ].join("\n"),
  );

  const definitions =
    context.definitionStore.getAnalysisResultForFile(sourceFile)
      ?.componentDefinitions ?? [];

  t.is(definitions.length, 1, "Expected one component definition");
  t.is(
    definitions[0].tagName,
    "my-element",
    "Expected the tag name to be 'my-element'",
  );
});

tsTest("jsdoc: report 'no-unknown-tag-name' without @element", (t) => {
  const { sourceFile, context } = getDiagnostics(
    [
      'import { html, LitElement, render } from "lit";',
      "",
      "class MyElement extends LitElement { }",
      "",
      "render(html`<my-element></my-element>`, document.body);",
    ].join("\n"),
  );

  const definitions =
    context.definitionStore.getAnalysisResultForFile(sourceFile)
      ?.componentDefinitions ?? [];

  t.is(
    definitions.length,
    0,
    "Expected no component definitions for unknown custom element",
  );
});

tsTest(
  "jsdoc: Discovers custom elements with @element in multiline comment",
  (t) => {
    const { sourceFile, context } = getDiagnostics(
      [
        'import { html, LitElement, render } from "lit";',
        "",
        "/**",
        " * @element my-element",
        " */",
        "class MyElement extends LitElement { }",
        "",
        "render(html`<my-element></my-element>`, document.body);",
      ].join("\n"),
    );

    const definitions =
      context.definitionStore.getAnalysisResultForFile(sourceFile)
        ?.componentDefinitions ?? [];

    t.is(definitions.length, 1, "Expected one component definition");
    t.is(
      definitions[0].tagName,
      "my-element",
      "Expected the tag name to be 'my-element'",
    );
  },
);

tsTest(
  "jsdoc: Discovers custom elements with @element but without tag name",
  (t) => {
    const { sourceFile, context } = getDiagnostics(`
	/**
	 * @element
	 */
	 class MyElement extends HTMLElement { 
	 }
	 `);

    const definitions =
      context.definitionStore.getAnalysisResultForFile(sourceFile)
        ?.componentDefinitions ?? [];

    t.is(definitions.length, 1);
    t.is(definitions[0].tagName, "");
  },
);
